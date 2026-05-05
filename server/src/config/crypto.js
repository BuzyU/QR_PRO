import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from './env.js';

const ALGORITHM = 'aes-256-gcm';

let _key = null;

/**
 * Get the 32-byte encryption key from env var.
 * If hex string (64 chars), decode it. Otherwise hash to 32 bytes.
 */
function key() {
  if (!_key) {
    const raw = env.encryptionKey;
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      _key = Buffer.from(raw, 'hex');
    } else {
      _key = createHash('sha256').update(raw).digest();
    }
  }
  return _key;
}

/**
 * Encrypt plaintext string with AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} JSON string containing iv, encrypted, and tag (all hex)
 */
export function encrypt(plaintext) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ iv: iv.toString('hex'), encrypted, tag });
}

/**
 * Decrypt a previously encrypted string.
 * @param {string} cipherData - JSON string from encrypt()
 * @returns {string} plaintext
 */
export function decrypt(cipherData) {
  const { iv, encrypted, tag } = JSON.parse(cipherData);
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
