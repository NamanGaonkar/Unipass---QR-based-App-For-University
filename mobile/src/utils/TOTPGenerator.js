import { totp } from 'otplib';

export class TOTPGenerator {
  /**
   * Generate a TOTP token using a secret key
   * @param {string} secret - Base32-encoded TOTP secret
   * @param {Object} options - Configuration options
   * @returns {string} 6-digit TOTP code
   */
  static generate(secret, options = {}) {
    const defaultOptions = {
      digits: 6,
      algorithm: 'SHA1',
      window: 1,
    };

    const config = { ...defaultOptions, ...options };

    try {
      totp.options = config;
      const token = totp.generate(secret);
      console.log('[TOTPGenerator] Generated TOTP token');
      return token;
    } catch (error) {
      console.error('[TOTPGenerator] Failed to generate TOTP:', error);
      throw new Error('TOTP generation failed');
    }
  }

  /**
   * Verify a TOTP token
   * @param {string} token - Token to verify
   * @param {string} secret - Base32-encoded TOTP secret
   * @param {Object} options - Configuration options
   * @returns {boolean} whether token is valid
   */
  static verify(token, secret, options = {}) {
    const defaultOptions = {
      digits: 6,
      algorithm: 'SHA1',
      window: 1,
    };

    const config = { ...defaultOptions, ...options };

    try {
      totp.options = config;
      const isValid = totp.check(token, secret);
      return isValid;
    } catch (error) {
      console.error('[TOTPGenerator] Failed to verify TOTP:', error);
      return false;
    }
  }

  /**
   * Generate offline authentication token
   * Combines TOTP with metadata for offline verification
   * @param {Object} payload - Token payload { studentId, resourceId }
   * @param {string} secret - TOTP secret
   * @returns {Object} offline token
   */
  static generateOfflineToken(payload, secret) {
    const totpCode = this.generate(secret);
    const timestamp = Date.now();

    return {
      type: 'OFFLINE_TOTP',
      studentId: payload.studentId,
      resourceId: payload.resourceId,
      totp: totpCode,
      timestamp,
      ttl: 300, // 5 minutes validity
      signature: this.createSignature(payload, totpCode, timestamp),
    };
  }

  /**
   * Create signature for offline token
   * @param {Object} payload - Token payload
   * @param {string} totp - TOTP code
   * @param {number} timestamp - Timestamp
   * @returns {string} signature
   */
  static createSignature(payload, totp, timestamp) {
    const dataToSign = `${payload.studentId}:${payload.resourceId}:${totp}:${timestamp}`;
    // In production, use HMAC with a secret
    return btoa(dataToSign); // Base64 encoding for demo
  }

  /**
   * Verify offline token validity
   * @param {Object} token - Offline token
   * @returns {boolean} whether token is valid
   */
  static verifyOfflineToken(token) {
    const now = Date.now();
    const elapsed = (now - token.timestamp) / 1000; // seconds

    if (elapsed > token.ttl) {
      console.log('[TOTPGenerator] Token expired');
      return false;
    }

    // Verify signature
    const expectedSignature = this.createSignature(
      { studentId: token.studentId, resourceId: token.resourceId },
      token.totp,
      token.timestamp
    );

    if (token.signature !== expectedSignature) {
      console.log('[TOTPGenerator] Invalid signature');
      return false;
    }

    return true;
  }
}

export default TOTPGenerator;
