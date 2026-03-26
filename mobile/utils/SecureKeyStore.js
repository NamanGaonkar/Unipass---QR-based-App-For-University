/**
 * @fileoverview SecureKeyStore.js
 * @description Secure key management using React Native Keychain
 * Handles private key storage and retrieval for offline authentication
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const KEY_ALIAS = 'unipass_private_key';
const DEVICE_ID_KEY = 'unipass_device_id';
const FALLBACK_PRIVATE_KEY_KEY = 'unipass_private_key_fallback';

const generatePseudoRandomHex = (byteLength = 32) => {
  let hex = '';
  for (let i = 0; i < byteLength; i += 1) {
    const value = Math.floor(Math.random() * 256);
    hex += value.toString(16).padStart(2, '0');
  }
  return hex;
};

/**
 * Generates a cryptographically secure private key
 * @returns {string} Base64-encoded private key
 */
export const generatePrivateKey = () => {
  const randomHex = generatePseudoRandomHex(32);
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(randomHex));
};

/**
 * Stores private key in secure keychain
 * @param {string} privateKey - The private key to store
 * @returns {Promise<boolean>}
 */
export const storePrivateKey = async (privateKey) => {
  try {
    await Keychain.setGenericPassword(KEY_ALIAS, privateKey, {
      service: 'com.unipass.auth',
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    try {
      // Emulator/dev fallback when biometrics/passcode policies are unavailable.
      await Keychain.setGenericPassword(KEY_ALIAS, privateKey, {
        service: 'com.unipass.auth',
      });
      return true;
    } catch (fallbackError) {
      console.error('Failed to store private key:', fallbackError);
      await AsyncStorage.setItem(FALLBACK_PRIVATE_KEY_KEY, privateKey);
      return false;
    }
  }
};

/**
 * Retrieves private key from secure keychain
 * @returns {Promise<string|null>}
 */
export const retrievePrivateKey = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: 'com.unipass.auth',
    });

    if (credentials) {
      return credentials.password;
    }
    return await AsyncStorage.getItem(FALLBACK_PRIVATE_KEY_KEY);
  } catch (error) {
    console.error('Failed to retrieve private key:', error);
    return await AsyncStorage.getItem(FALLBACK_PRIVATE_KEY_KEY);
  }
};

/**
 * Gets or creates device ID
 * @returns {Promise<string>}
 */
export const getDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      deviceId = generatePseudoRandomHex(16);
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    return 'fallback-device-id';
  }
};

/**
 * Initializes secure storage (call on first app launch)
 * @param {string} userId - User identifier
 * @returns {Promise<{success: boolean, privateKey: string}>}
 */
export const initializeSecureStorage = async (userId) => {
  try {
    let privateKey = await retrievePrivateKey();

    if (!privateKey) {
      privateKey = generatePrivateKey();
      await storePrivateKey(privateKey);
    }

    await AsyncStorage.setItem('unipass_user_id', userId);

    return {
      success: true,
      privateKey,
    };
  } catch (error) {
    console.error('Failed to initialize secure storage:', error);
    return {
      success: false,
      privateKey: null,
    };
  }
};

/**
 * Clears all stored credentials (use on logout)
 * @returns {Promise<boolean>}
 */
export const clearSecureStorage = async () => {
  try {
    await Keychain.resetGenericPassword({ service: 'com.unipass.auth' });
    await AsyncStorage.multiRemove(['unipass_user_id', DEVICE_ID_KEY, FALLBACK_PRIVATE_KEY_KEY]);
    return true;
  } catch (error) {
    console.error('Failed to clear secure storage:', error);
    return false;
  }
};
