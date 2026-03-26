import axios from 'axios';
import SecureKeyStore from './SecureKeyStore';
import TOTPGenerator from './TOTPGenerator';
import ConnectivityManager from './ConnectivityDetection';

export class HandshakeVerifier {
  constructor(backendUrl = 'http://10.0.2.2:5000') {
    this.backendUrl = backendUrl;
    this.connectivityManager = new ConnectivityManager(
      `${backendUrl}/health`
    );
  }

  /**
   * Perform online handshake - JWT validation
   * @param {Object} payload - { studentId, resourceId, qrData }
   * @returns {Promise<Object>} verification result
   */
  async verifyOnlineHandshake(payload) {
    try {
      const response = await axios.post(
        `${this.backendUrl}/verify-handshake`,
        {
          type: 'ONLINE_JWT',
          ...payload,
          timestamp: Date.now(),
        },
        { timeout: 5000 }
      );

      if (response.data.success) {
        console.log('[HandshakeVerifier] Online verification successful');
        return {
          success: true,
          mode: 'ONLINE',
          jwt: response.data.token,
          expiresAt: response.data.expiresAt,
        };
      }

      return { success: false, error: 'Verification failed' };
    } catch (error) {
      console.log('[HandshakeVerifier] Online verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Perform offline handshake - TOTP-signed token
   * @param {Object} payload - { studentId, resourceId }
   * @returns {Promise<Object>} offline token
   */
  async verifyOfflineHandshake(payload) {
    try {
      // Retrieve private key from secure storage
      const privateKey = await SecureKeyStore.getPrivateKey(payload.studentId);

      if (!privateKey) {
        return {
          success: false,
          error: 'No private key found. Must authenticate online first.',
        };
      }

      // Generate offline TOTP token
      const offlineToken = TOTPGenerator.generateOfflineToken(
        payload,
        privateKey
      );

      console.log('[HandshakeVerifier] Offline token generated');

      return {
        success: true,
        mode: 'OFFLINE',
        token: offlineToken,
        warning: 'Using offline mode - limited functionality',
      };
    } catch (error) {
      console.error('[HandshakeVerifier] Offline verification failed:', error);
      return {
        success: false,
        error: 'Offline verification failed',
      };
    }
  }

  /**
   * Smart handshake - attempts online, falls back to offline
   * @param {Object} payload - { studentId, resourceId }
   * @returns {Promise<Object>} verification result
   */
  async performSmartHandshake(payload) {
    try {
      // Check connectivity
      const isOnline = await this.connectivityManager.checkConnectivity();

      if (isOnline) {
        console.log('[HandshakeVerifier] Using ONLINE mode');
        return await this.verifyOnlineHandshake(payload);
      } else {
        console.log('[HandshakeVerifier] Falling back to OFFLINE mode');
        return await this.verifyOfflineHandshake(payload);
      }
    } catch (error) {
      console.log('[HandshakeVerifier] Online failed, attempting offline...');
      return await this.verifyOfflineHandshake(payload);
    }
  }

  /**
   * Verify handshake on backend (for server-side validation)
   * @param {Object} token - Token to verify
   * @returns {Promise<Object>} verification result
   */
  async verifyHandshakeOnBackend(token) {
    try {
      const response = await axios.post(
        `${this.backendUrl}/verify-handshake`,
        { token },
        { timeout: 5000 }
      );

      return {
        success: response.data.success,
        data: response.data,
      };
    } catch (error) {
      console.error('[HandshakeVerifier] Backend verification failed:', error);
      return {
        success: false,
        error: 'Backend verification failed',
      };
    }
  }

  /**
   * Store JWT from successful online authentication
   * Also stores the TOTP secret for offline use
   * @param {string} studentId - Student ID
   * @param {string} totpSecret - TOTP secret from server
   * @returns {Promise<boolean>}
   */
  async storeAuthenticationSecrets(studentId, totpSecret) {
    try {
      await SecureKeyStore.storePrivateKey(studentId, totpSecret);
      console.log('[HandshakeVerifier] Secrets stored securely');
      return true;
    } catch (error) {
      console.error('[HandshakeVerifier] Failed to store secrets:', error);
      return false;
    }
  }
}

export default HandshakeVerifier;
