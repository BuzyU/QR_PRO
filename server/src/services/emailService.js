import { Resend } from 'resend';
import { supabase } from '../config/supabase.js';
import { decrypt } from '../config/crypto.js';
import { renderEmail } from './templateService.js';
import { sendViaGmail, decryptEmailConfig } from './gmailService.js';

/**
 * Send a hall ticket email using the event's per-event delivery config.
 *
 * Supports two providers:
 *   1. Gmail API — uses the host's own OAuth2 credentials stored in event.email_config
 *   2. Resend — uses the host's Resend API key stored in event.email_config
 *
 * Falls back to user profile's smtp_config (legacy) if no per-event config exists.
 *
 * @param {Object} params
 * @param {string} params.ticketId
 * @param {string} params.to
 * @param {string} params.name
 * @param {Object} params.metadata
 * @param {string} params.verifyURL
 * @param {Object} params.userProfile
 * @param {Array}  params.visibleFields
 * @param {string} params.eventName
 * @param {Object} [params.event] - full event object (for template + per-event delivery)
 */
export async function sendTicketEmail({
  ticketId,
  to,
  name,
  metadata,
  verifyURL,
  userProfile,
  visibleFields,
  eventName,
  event,
}) {
  const institution = userProfile.institution_name || 'QR PRO';

  // Build email subject + HTML
  let subject, html;

  if (event) {
    const rendered = renderEmail({
      event,
      ticket: { student_name: name, email: to, metadata },
      verifyURL,
      userProfile,
    });
    subject = rendered.subject;
    html = rendered.html;
  } else {
    const { buildEmailHTML } = await import('../templates/hallTicketEmail.js');
    subject = `Your Hall Ticket — ${eventName || institution}`;
    html = buildEmailHTML({
      name,
      metadata,
      visibleFields,
      verifyURL,
      eventName: eventName || '',
      institution,
    });
  }

  // === Determine email provider ===
  // Priority: per-event email_config > user profile smtp_config (legacy)
  let emailConfig = null;

  if (event?.email_config) {
    emailConfig = decryptEmailConfig(event.email_config);
  }

  // Legacy fallback: user profile smtp_config (Resend)
  if (!emailConfig && userProfile.smtp_config) {
    try {
      const legacy = JSON.parse(decrypt(userProfile.smtp_config));
      emailConfig = {
        provider: 'resend',
        resend_key: legacy.resend_key,
        from_email: legacy.from_email,
        from_name: institution,
      };
    } catch {
      // ignore
    }
  }

  if (!emailConfig) {
    return { success: false, error: 'Email not configured for this event' };
  }

  const fromName = emailConfig.from_name || eventName || institution;

  // === Send via the configured provider ===
  if (emailConfig.provider === 'gmail') {
    return sendViaGmailWithRetry({
      ticketId, to, subject, html, fromName, emailConfig,
    });
  } else {
    return sendViaResendWithRetry({
      ticketId, to, subject, html, fromName, emailConfig, institution,
    });
  }
}

// ─── Gmail Send with Retry ──────────────────────────────────────────

async function sendViaGmailWithRetry({ ticketId, to, subject, html, fromName, emailConfig }) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await sendViaGmail({
        emailConfig,
        to,
        subject,
        html,
        fromName,
      });

      if (result.success) {
        await supabase
          .from('students')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
            email_retries: attempt,
          })
          .eq('id', ticketId);

        return { success: true };
      }

      lastError = result.error;
      console.error(`[Email/Gmail] Attempt ${attempt}/3 failed for ${to}: ${result.error}`);
    } catch (err) {
      lastError = err.message;
      console.error(`[Email/Gmail] Attempt ${attempt}/3 error for ${to}: ${err.message}`);
    }

    if (attempt < 3) {
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }

  await supabase
    .from('students')
    .update({ email_retries: 3 })
    .eq('id', ticketId);

  return { success: false, error: lastError };
}

// ─── Resend Send with Retry ─────────────────────────────────────────

async function sendViaResendWithRetry({ ticketId, to, subject, html, fromName, emailConfig, institution }) {
  const resendKey = emailConfig.resend_key;
  const fromEmail = emailConfig.from_email || 'tickets@resend.dev';

  if (!resendKey) {
    return { success: false, error: 'Resend API key not configured' };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resend = new Resend(resendKey);

      const { data, error } = await resend.emails.send({
        from: `${fromName || institution} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      });

      if (error) {
        if (error.statusCode === 429 || error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('rate limit')) {
          throw new Error('QUOTA_EXCEEDED');
        }
        throw new Error(error.message || 'Unknown Resend error');
      }

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
      console.error(`[Email/Resend] Attempt ${attempt}/3 failed for ${to}: ${err.message}`);

      if (lastError === 'QUOTA_EXCEEDED') break;

      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  if (lastError === 'QUOTA_EXCEEDED') {
    await supabase
      .from('students')
      .update({
        email_retries: -1,
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', ticketId);
  } else {
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
