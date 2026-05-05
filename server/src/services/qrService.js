import QRCode from 'qrcode';

/**
 * Generate a QR code as base64 data URL.
 * @param {string} text - URL to encode
 * @param {number} size - width/height in pixels
 * @returns {Promise<string>} base64 PNG data URL
 */
export async function generateQRDataURL(text, size = 250) {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}

/**
 * Generate QR code as a Buffer (for email attachment).
 * @param {string} text
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
export async function generateQRBuffer(text, size = 250) {
  return QRCode.toBuffer(text, {
    width: size,
    margin: 1,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}
