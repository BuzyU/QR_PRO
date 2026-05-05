import { createTransport } from 'nodemailer';
import { supabase } from '../config/supabase.js';
import { decrypt } from '../config/crypto.js';
import { generateQRBuffer } from './qrService.js';
import { buildEmailHTML } from '../templates/hallTicketEmail.js';

/**
 * Send a hall ticket email using the user's configured SMTP credentials.
 *
 * @param {Object} params
 * @param {string} params.ticketId - ticket UUID
 * @param {string} params.to - recipient email
 * @param {string} params.name - recipient name
 * @param {Object} params.metadata - all custom fields
 * @param {string} params.verifyURL - verification URL
 * @param {Object} params.userProfile - user_profiles row (has smtp_config)
 * @param {Object} params.visibleFields - fields marked visible on ticket
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendTicketEmail({
  ticketId,
  to,
  name,
  metadata,
  verifyURL,
  userProfile,
  visibleFields,
}) {
  // Decrypt SMTP credentials
  const smtpConfig = userProfile.smtp_config;
  if (!smtpConfig) {
    return { success: false, error: 'SMTP not configured' };
  }

  let smtpUser, smtpPass;
  try {
    const decrypted = JSON.parse(decrypt(smtpConfig));
    smtpUser = decrypted.user;
    smtpPass = decrypted.pass;
  } catch {
    return { success: false, error: 'Failed to decrypt SMTP credentials' };
  }

  // Create transporter — use port 465 (SSL) for cloud hosting compatibility
  const transporter = createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Generate QR code buffer for inline attachment
  const qrBuffer = await generateQRBuffer(verifyURL);

  // Build email HTML
  const institution = userProfile.institution_name || 'QR PRO';
  const html = buildEmailHTML({
    name,
    metadata,
    visibleFields,
    verifyURL,
    institution,
  });

  const mailOptions = {
    from: `"${institution}" <${smtpUser}>`,
    to,
    subject: `Your Hall Ticket — ${institution}`,
    html,
    attachments: [
      {
        filename: 'qrcode.png',
        content: qrBuffer,
        cid: 'qrcode',
      },
    ],
  };

  // Retry up to 3 times with exponential backoff
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transporter.sendMail(mailOptions);

      // Mark as sent in database
      await supabase
        .from('students')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          email_retries: attempt,
        })
        .eq('id', ticketId);

      return { success: true };
    } catch (err) {
      lastError = err.message;
      console.error(`[Email] Attempt ${attempt}/3 failed for ${to}: ${err.message}`);
      if (attempt < 3) {
        await sleep(Math.pow(4, attempt) * 1000); // 4s, 16s
      }
    }
  }

  // All retries failed — update DB
  await supabase
    .from('students')
    .update({ email_retries: 3 })
    .eq('id', ticketId);

  return { success: false, error: lastError };
}

/**
 * Send a test email to verify SMTP configuration.
 * @param {string} smtpUser
 * @param {string} smtpPass
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendTestEmail(smtpUser, smtpPass) {
  const transporter = createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({
      from: `"QR PRO Test" <${smtpUser}>`,
      to: smtpUser,
      subject: 'QR PRO — SMTP Test Successful',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;text-align:center;">
          <h2 style="color:#6c63ff;">SMTP Configuration Verified</h2>
          <p style="color:#555;">Your Gmail SMTP is working correctly with QR PRO.</p>
          <p style="color:#999;font-size:12px;">This is an automated test email.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
