/**
 * @fileoverview TOTPGenerator.js
 * @description TOTP token generation for offline authentication
 * Implements RFC 6238 time-based one-time passwords
 */

import CryptoJS from 'crypto-js';

const TOTP_DIGITS = 8;
const TOTP_STEP_SECONDS = 60;
const TOTP_WINDOW = 1;

const hotp = (secretHex, counter, digits = TOTP_DIGITS) => {
  const normalizedCounter = Math.max(0, Math.floor(counter));
  const counterHex = normalizedCounter.toString(16).padStart(16, '0');
  const counterWordArray = CryptoJS.enc.Hex.parse(counterHex);
  const secretWordArray = CryptoJS.enc.Hex.parse(secretHex);
  const hmacHex = CryptoJS.HmacSHA1(counterWordArray, secretWordArray).toString(CryptoJS.enc.Hex);

  const offset = parseInt(hmacHex.slice(-1), 16);
  const binaryCode = parseInt(hmacHex.substr(offset * 2, 8), 16) & 0x7fffffff;
  const mod = Math.pow(10, digits);

  return String(binaryCode % mod).padStart(digits, '0');
};

const deriveSecretHex = (privateKey, userId) =>
  CryptoJS.HmacSHA256(userId, privateKey).toString(CryptoJS.enc.Hex);

/**
 * Generates TOTP token from private key
 * @param {string} privateKey - Base64-encoded private key
 * @param {string} userId - User identifier
 * @returns {string} TOTP token
 */
export const generateTOTP = (privateKey, userId) => {
  try {
    const secretHex = deriveSecretHex(privateKey, userId);
    const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
    return hotp(secretHex, counter);
  } catch (error) {
    console.error('Failed to generate TOTP:', error);
    throw new Error('TOTP generation failed');
  }
};

/**
 * Creates offline authentication token
 * @param {string} privateKey - Private key from secure storage
 * @param {string} userId - User identifier
 * @param {string} deviceId - Device identifier
 * @returns {Object} Offline token payload
 */
export const createOfflineToken = (privateKey, userId, deviceId) => {
  const timestamp = Date.now();
  const totp = generateTOTP(privateKey, userId);

  // Create signature: HMAC(privateKey, userId + timestamp + totp)
  const message = `${userId}:${timestamp}:${totp}`;
  const signature = CryptoJS.HmacSHA256(message, privateKey).toString(CryptoJS.enc.Hex);

  return {
    version: '1.0',
    type: 'offline',
    userId,
    deviceId,
    timestamp,
    totp,
    signature,
    expiresAt: timestamp + 60000, // 60 seconds validity
  };
};

/**
 * Verifies TOTP token (for client-side validation)
 * @param {string} token - TOTP token to verify
 * @param {string} privateKey - Private key
 * @param {string} userId - User identifier
 * @returns {boolean}
 */
export const verifyTOTP = (token, privateKey, userId) => {
  try {
    const secretHex = deriveSecretHex(privateKey, userId);
    const currentCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);

    for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
      if (hotp(secretHex, currentCounter + drift) === token) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Failed to verify TOTP:', error);
    return false;
  }
};

/**
 * Gets remaining validity time for token
 * @returns {number} Seconds until next rotation
 */
export const getTimeRemaining = () => {
  const now = Math.floor(Date.now() / 1000);
  return TOTP_STEP_SECONDS - (now % TOTP_STEP_SECONDS);
};
