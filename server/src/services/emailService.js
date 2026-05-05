import { Resend } from 'resend';
import { supabase } from '../config/supabase.js';
import { decrypt } from '../config/crypto.js';
import { generateQRBuffer } from './qrService.js';
import { buildEmailHTML } from '../templates/hallTicketEmail.js';

/**
 * Send a hall ticket email using Resend (HTTP-based, works on all hosting).
 *
 * Users configure a Resend API key + their "from" email in their profile.
 * Resend uses HTTPS — no SMTP port blocking issues on Render/Vercel/etc.
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
  const emailConfig = userProfile.smtp_config;
  if (!emailConfig) {
    return { success: false, error: 'Email not configured' };
  }

  let config;
  try {
    config = JSON.parse(decrypt(emailConfig));
  } catch {
    return { success: false, error: 'Failed to decrypt email credentials' };
  }

  const institution = userProfile.institution_name || 'QR PRO';

  // Build email HTML
  const html = buildEmailHTML({
    name,
    metadata,
    visibleFields,
    verifyURL,
    institution,
  });

  // Retry up to 3 times
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resend = new Resend(config.resend_key);

      const { data, error } = await resend.emails.send({
        from: `${institution} <${config.from_email || 'tickets@resend.dev'}>`,
        to: [to],
        subject: `Your Hall Ticket — ${institution}`,
        html,
      });

      if (error) {
        if (error.statusCode === 429 || error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('rate limit')) {
          throw new Error('QUOTA_EXCEEDED');
        }
        throw new Error(error.message || 'Unknown Resend error');
      }

      // Mark as sent
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
      // Don't retry if it's a hard quota limit
      if (lastError === 'QUOTA_EXCEEDED') break;
      
      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // If quota exceeded, mark with retries = -1 to defer until tomorrow
  if (lastError === 'QUOTA_EXCEEDED') {
    await supabase
      .from('students')
      .update({ 
        email_retries: -1, 
        email_sent_at: new Date().toISOString() // record when it hit the limit
      })
      .eq('id', ticketId);
  } else {
    // Normal failure after 3 retries
    await supabase
      .from('students')
      .update({ email_retries: 3 })
      .eq('id', ticketId);
  }

  return { success: false, error: lastError };
}

/**
 * Send a test email to verify Resend configuration.
 */
export async function sendTestEmail(resendKey, fromEmail) {
  try {
    const resend = new Resend(resendKey);

    const { data, error } = await resend.emails.send({
      from: `QR PRO Test <${fromEmail || 'onboarding@resend.dev'}>`,
      to: [fromEmail || 'delivered@resend.dev'],
      subject: 'QR PRO — Email Test Successful',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;text-align:center;">
          <h2 style="color:#6c63ff;">Email Configuration Verified ✅</h2>
          <p style="color:#555;">Your Resend API key is working correctly with QR PRO.</p>
          <p style="color:#999;font-size:12px;">This is an automated test email.</p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, emailId: data?.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
