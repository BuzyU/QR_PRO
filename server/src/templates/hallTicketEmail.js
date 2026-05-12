/**
 * Build the HTML email template for a hall ticket.
 * Dynamically renders fields from the event's custom_fields config.
 *
 * @param {Object} params
 * @param {string} params.name - attendee name
 * @param {Object} params.metadata - custom field values { key: value }
 * @param {Array}  params.visibleFields - fields marked for email [{key, label, ...}]
 * @param {string} params.verifyURL - verification URL
 * @param {string} params.eventName - event name
 * @param {string} params.institution - institution name (from user profile)
 * @returns {string} HTML email content
 */
export function buildEmailHTML({ name, metadata, visibleFields, verifyURL, eventName, institution }) {
  // Build dynamic field rows from event's custom fields
  const fieldRows = (visibleFields || [])
    .map((field) => {
      const value = metadata[field.key] || metadata[field.source] || metadata[field.label] || '—';
      return `
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0f0;width:40%;">
            ${field.label || field.key}
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#1a1a2e;font-weight:600;border-bottom:1px solid #f0f0f0;">
            ${value}
          </td>
        </tr>
      `;
    })
    .join('');

  const headerTitle = institution || eventName || 'QR PRO';
  const headerSubtitle = eventName && institution ? eventName : 'Hall Ticket';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5fa;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2a2478 0%,#6c63ff 100%);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
        ${headerTitle}
      </h1>
      <p style="margin:8px 0 0;color:#c8c3ff;font-size:13px;">${headerSubtitle}</p>
    </div>

    <!-- Body Card -->
    <div style="background:#fff;border:1px solid #e8e8f0;border-top:none;border-radius:0 0 16px 16px;padding:28px 24px;">

      <!-- Greeting -->
      <p style="margin:0 0 20px;font-size:15px;color:#333;">
        Dear <strong>${name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">
        Your hall ticket has been generated. Please find your details and QR code below.
        Present this QR code at the venue for verification.
      </p>

      <!-- Details Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #f0f0f0;border-radius:8px;">
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0f0;width:40%;">
            Name
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#1a1a2e;font-weight:600;border-bottom:1px solid #f0f0f0;">
            ${name}
          </td>
        </tr>
        ${fieldRows}
      </table>

      <!-- QR Code -->
      <div style="text-align:center;margin:28px 0;">
        <img src="https://quickchart.io/qr?text=${encodeURIComponent(verifyURL)}&size=180&margin=1" alt="QR Code" width="180" height="180"
          style="border:4px solid #f0f0f5;border-radius:12px;">
        <p style="margin:12px 0 0;font-size:11px;color:#aaa;">Scan to verify authenticity</p>
      </div>

      <!-- Verify Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${verifyURL}"
          style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6c63ff,#e056a0);
          color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">
          Verify Online
        </a>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #f0f0f0;padding-top:20px;margin-top:24px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#bbb;line-height:1.5;">
          This is a computer-generated hall ticket from ${headerTitle}.<br>
          Do not reply to this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
