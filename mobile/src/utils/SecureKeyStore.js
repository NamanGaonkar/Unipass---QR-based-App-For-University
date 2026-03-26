import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const SECURE_KEY_KEY = 'unipass_secure_key';
const ENCRYPTION_SALT = 'unipass_salt_2024';

export class SecureKeyStore {
  /**
   * Store private key securely in device's keychain
   * @param {string} studentId - Student identifier
   * @param {string} privateKey - Private key to store
   * @returns {Promise<boolean>}
   */
  static async storePrivateKey(studentId, privateKey) {
    try {
      // Try Keychain first (most secure)
      await Keychain.setGenericPassword(
        `${SECURE_KEY_KEY}_${studentId}`,
        privateKey,
        {
          service: `com.unipass.${studentId}`,
          accessibilitySharing: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        }
      );
      console.log('[SecureKeyStore] Private key stored in Keychain');
      return true;
    } catch (error) {
      console.log('[SecureKeyStore] Keychain failed, using AsyncStorage fallback');
      // Fallback to encrypted AsyncStorage
      const encrypted = this.encrypt(privateKey);
      await AsyncStorage.setItem(
        `${SECURE_KEY_KEY}_${studentId}`,
        encrypted
      );
      return true;
    }
  }

  /**
   * Retrieve private key from secure storage
   * @param {string} studentId - Student identifier
   * @returns {Promise<string|null>}
   */
  static async getPrivateKey(studentId) {
    try {
      // Try Keychain first
      const credentials = await Keychain.getGenericPassword(
        `com.unipass.${studentId}`
      );
      
      if (credentials && credentials.password) {
        console.log('[SecureKeyStore] Private key retrieved from Keychain');
        return credentials.password;
      }
    } catch (error) {
      console.log('[SecureKeyStore] Keychain retrieval failed');
    }

    try {
      // Fallback to encrypted AsyncStorage
      const encrypted = await AsyncStorage.getItem(
        `${SECURE_KEY_KEY}_${studentId}`
      );
      
      if (encrypted) {
        const decrypted = this.decrypt(encrypted);
        console.log('[SecureKeyStore] Private key retrieved from AsyncStorage');
        return decrypted;
      }
    } catch (error) {
      console.log('[SecureKeyStore] AsyncStorage retrieval failed', error);
    }

    return null;
  }

  /**
   * Delete private key from secure storage
   * @param {string} studentId - Student identifier
   * @returns {Promise<boolean>}
   */
  static async deletePrivateKey(studentId) {
    try {
      await Keychain.resetGenericPassword(
        `com.unipass.${studentId}`
      );
    } catch (error) {
      console.log('[SecureKeyStore] Keychain delete failed');
    }

    try {
      await AsyncStorage.removeItem(`${SECURE_KEY_KEY}_${studentId}`);
    } catch (error) {
      console.log('[SecureKeyStore] AsyncStorage delete failed');
    }

    return true;
  }

  /**
   * Encrypt data using AES-256
   * @param {string} data - Data to encrypt
   * @returns {string} encrypted data
   */
  static encrypt(data) {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_SALT).toString();
  }

  /**
   * Decrypt data using AES-256
   * @param {string} encrypted - Encrypted data
   * @returns {string} decrypted data
   */
  static decrypt(encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_SALT);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Check if key exists in storage
   * @param {string} studentId - Student identifier
   * @returns {Promise<boolean>}
   */
  static async hasPrivateKey(studentId) {
    const key = await this.getPrivateKey(studentId);
    return key !== null;
  }
}

export default SecureKeyStore;
