/**
 * @fileoverview verifyHandshake.js
 * @description Token verification logic for both JWT and TOTP tokens
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const TOTP_STEP_SECONDS = parseInt(process.env.TOTP_STEP || '60', 10);
const TOTP_WINDOW = parseInt(process.env.TOTP_WINDOW || '1', 10);
const TOTP_DIGITS = 8;

const deriveSecretHex = (privateKey, userId) =>
  crypto.createHmac('sha256', privateKey).update(userId).digest('hex');

const hotp = (secretHex, counter, digits = TOTP_DIGITS) => {
  const normalizedCounter = Math.max(0, Math.floor(counter));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(normalizedCounter));

  const hmacHex = crypto
    .createHmac('sha1', Buffer.from(secretHex, 'hex'))
    .update(counterBuffer)
    .digest('hex');

  const offset = parseInt(hmacHex.slice(-1), 16);
  const binaryCode = parseInt(hmacHex.substr(offset * 2, 8), 16) & 0x7fffffff;
  const mod = Math.pow(10, digits);

  return String(binaryCode % mod).padStart(digits, '0');
};

/**
 * Verifies JWT token from online authentication
 * @param {Object} tokenData - Parsed token data
 * @param {string} secret - JWT secret
 * @returns {Object} Verification result
 */
const verifyJWTToken = (tokenData, secret) => {
  try {
    const { token, userId, deviceId, timestamp } = tokenData;

    // Verify JWT signature
    const decoded = jwt.verify(token, secret);

    // Validate claims match
    if (decoded.userId !== userId) {
      return {
        valid: false,
        reason: 'User ID mismatch',
        errorCode: 'USERID_MISMATCH',
      };
    }

    if (decoded.deviceId !== deviceId) {
      return {
        valid: false,
        reason: 'Device ID mismatch',
        errorCode: 'DEVICEID_MISMATCH',
      };
    }

    // Check timestamp freshness (within 60 seconds)
    const currentTime = Date.now();
    const tokenAge = currentTime - timestamp;

    if (tokenAge > 60000) {
      return {
        valid: false,
        reason: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
      };
    }

    return {
      valid: true,
      authType: 'online',
      userId: decoded.userId,
      deviceId: decoded.deviceId,
      studentName: decoded.studentName,
      role: decoded.role,
      department: decoded.department,
      departmentCode: decoded.departmentCode,
      resource: decoded.resource,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error.message,
      errorCode: 'JWT_VERIFY_FAILED',
    };
  }
};

/**
 * Verifies TOTP token from offline authentication
 * @param {Object} tokenData - Parsed token data
 * @param {Function} getPrivateKey - Async function to retrieve user's private key
 * @returns {Promise<Object>} Verification result
 */
const verifyTOTPToken = async (tokenData, getPrivateKey) => {
  try {
    const {
      userId,
      deviceId,
      timestamp,
      totp,
      top,
      signature,
      studentName,
      role,
      department,
      resource,
    } = tokenData;
    const tokenValue = totp || top;

    if (!tokenValue) {
      return {
        valid: false,
        reason: 'Missing TOTP value',
        errorCode: 'TOTP_MISSING',
      };
    }

    // Retrieve user's private key from database
    const privateKey = await getPrivateKey(userId, deviceId);

    if (!privateKey) {
      return {
        valid: false,
        reason: 'User or device not found',
        errorCode: 'USER_NOT_FOUND',
      };
    }

    // Verify signature
    const message = `${userId}:${timestamp}:${tokenValue}`;
    const expectedSignature = crypto
      .createHmac('sha256', privateKey)
      .update(message)
      .digest('hex');

    if (signature !== expectedSignature) {
      return {
        valid: false,
        reason: 'Invalid signature',
        errorCode: 'SIGNATURE_INVALID',
      };
    }

    // Verify TOTP using the same algorithm implemented in mobile/utils/TOTPGenerator.js
    const secretHex = deriveSecretHex(privateKey, userId);
    const currentCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);

    let isValidTOTP = false;
    for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
      if (hotp(secretHex, currentCounter + drift) === String(tokenValue)) {
        isValidTOTP = true;
        break;
      }
    }

    if (!isValidTOTP) {
      return {
        valid: false,
        reason: 'Invalid TOTP',
        errorCode: 'TOTP_INVALID',
      };
    }

    // Check timestamp (within 60 seconds)
    const currentTime = Date.now();
    const tokenAge = currentTime - timestamp;

    if (tokenAge > 60000 || tokenAge < -60000) {
      return {
        valid: false,
        reason: 'Token timestamp out of range',
        errorCode: 'TIMESTAMP_INVALID',
      };
    }

    return {
      valid: true,
      authType: 'offline',
      userId,
      studentName,
      role,
      department,
      resource,
      deviceId,
      timestamp,
      verifiedAt: currentTime,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error.message,
      errorCode: 'TOTP_VERIFY_FAILED',
    };
  }
};

/**
 * Main verification handler - routes to appropriate verifier
 * @param {string} qrDataString - Raw QR code data
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Verification result
 */
const verifyHandshake = async (qrDataString, config = {}) => {
  try {
    // Parse QR data
    const tokenData = JSON.parse(qrDataString);

    // Validate required fields
    if (!tokenData.version || !tokenData.type || !tokenData.userId) {
      return {
        valid: false,
        reason: 'Invalid token format',
        errorCode: 'INVALID_FORMAT',
      };
    }

    // Version check
    if (tokenData.version !== '1.0') {
      return {
        valid: false,
        reason: 'Unsupported token version',
        errorCode: 'VERSION_MISMATCH',
      };
    }

    // Route to appropriate verifier
    let result;

    if (tokenData.type === 'online') {
      result = verifyJWTToken(tokenData, config.jwtSecret);
    } else if (tokenData.type === 'offline') {
      result = await verifyTOTPToken(tokenData, config.getPrivateKey);
    } else {
      return {
        valid: false,
        reason: 'Unknown token type',
        errorCode: 'UNKNOWN_TYPE',
      };
    }

    // Add metadata
    return {
      ...result,
      verifiedAt: new Date().toISOString(),
      tokenVersion: tokenData.version,
    };
  } catch (error) {
    return {
      valid: false,
      reason: 'Failed to parse token',
      errorCode: 'PARSE_ERROR',
      details: error.message,
    };
  }
};

module.exports = {
  verifyHandshake,
  verifyJWTToken,
  verifyTOTPToken,
};
