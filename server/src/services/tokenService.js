import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

/**
 * Generate a cryptographically random token (UUID v4).
 * @returns {string}
 */
export function generateToken() {
  return randomUUID();
}

/**
 * Generate HMAC-SHA256 signature for a token.
 * @param {string} token
 * @returns {string} hex signature
 */
export function generateSignature(token) {
  return createHmac('sha256', env.hmacSecret).update(token).digest('hex');
}

/**
 * Verify a token's HMAC signature (constant-time comparison).
 * @param {string} token
 * @param {string} signature - claimed signature
 * @returns {boolean}
 */
export function verifySignature(token, signature) {
  const expected = generateSignature(token);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
