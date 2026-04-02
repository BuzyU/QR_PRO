import QRCode from 'qrcode';

/**
 * Generate a QR code as a base64 data URL.
 * @param {string} text - The URL or text to encode
 * @param {number} size - Width/height in pixels
 * @returns {Promise<string>} - base64 PNG data URL
 */
export async function generateQRDataURL(text, size = 200) {
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
 * Build the verification URL for a student.
 * @param {string} studentId - UUID from Supabase
 * @returns {string}
 */
export function buildVerifyURL(studentId) {
  return `${window.location.origin}/verify?id=${studentId}`;
}
