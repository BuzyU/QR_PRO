/**
 * Server-side template rendering service.
 * Takes an event's template config + ticket data and produces final HTML.
 *
 * Used by:
 * - emailService.js (to build the email HTML body)
 * - pdfService.js (to generate PDF from ticket HTML)
 */

import { buildEmailHTML } from '../templates/hallTicketEmail.js';

/**
 * Replace {{variable}} placeholders with actual data.
 * @param {string} text
 * @param {Object} data - key-value pairs
 * @returns {string}
 */
export function interpolate(text, data) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

/**
 * Render the email HTML for a ticket, using the event's email template config.
 *
 * @param {Object} params
 * @param {Object} params.event - event object with email_template, custom_fields, name
 * @param {Object} params.ticket - student record with student_name, email, metadata
 * @param {string} params.verifyURL - verification URL
 * @param {Object} params.userProfile - host's user profile (for institution, etc.)
 * @returns {Object} { subject: string, html: string }
 */
export function renderEmail({ event, ticket, verifyURL, userProfile }) {
  const template = event.email_template || {};
  const customFields = event.custom_fields || [];
  const metadata = ticket.metadata || {};

  // Get visible fields for email
  const visibleFields = customFields
    .filter((f) => f.in_email)
    .map((f) => ({
      key: f.key,
      label: f.label,
      value: metadata[f.key] || '—',
    }));

  // Data for placeholder interpolation
  const templateData = {
    name: ticket.student_name,
    event_name: event.name,
    institution: userProfile?.institution_name || userProfile?.display_name || '',
    year: new Date().getFullYear().toString(),
  };

  // If custom raw_html is set (Code mode), use it
  if (template.mode === 'code' && template.raw_html) {
    const subject = interpolate(template.subject || 'Your Hall Ticket', templateData);
    const html = interpolate(template.raw_html, templateData);
    return { subject, html };
  }

  // Otherwise, use the default template with visual/template config
  const subject = interpolate(template.subject || 'Your Hall Ticket — {{event_name}}', templateData);

  const html = buildEmailHTML({
    name: ticket.student_name,
    metadata,
    visibleFields,
    verifyURL,
    eventName: event.name,
    institution: templateData.institution,
  });

  return { subject, html };
}

/**
 * Render ticket/PDF HTML for a ticket, using the event's ticket template config.
 *
 * @param {Object} params
 * @param {Object} params.event - event object with ticket_template, custom_fields
 * @param {Object} params.ticket - student record
 * @param {string} params.qrDataURL - base64 QR code image or URL
 * @param {Object} params.userProfile - host's user profile
 * @returns {string} HTML string for the ticket/PDF
 */
export function renderTicketHTML({ event, ticket, qrDataURL, userProfile }) {
  const template = event.ticket_template || {};
  const customFields = event.custom_fields || [];
  const metadata = ticket.metadata || {};

  const institution = userProfile?.institution_name || userProfile?.display_name || '';

  const templateData = {
    name: ticket.student_name,
    event_name: event.name,
    institution,
    year: new Date().getFullYear().toString(),
  };

  // If custom raw_html (Code mode), use it with placeholder replacement
  if (template.mode === 'code' && template.raw_html) {
    let html = interpolate(template.raw_html, templateData);
    // Replace QR code placeholder if exists
    html = html.replace(/QR\s*Code/gi, `<img src="${qrDataURL}" width="120" height="120" alt="QR Code">`);
    return html;
  }

  // Build from config
  const primaryColor = template.primary_color || '#2a2478';
  const accentColor = template.accent_color || '#6c63ff';
  const headerText = interpolate(template.header_text || '{{event_name}}', templateData);
  const subHeader = interpolate(template.sub_header || 'Hall Ticket', templateData);
  const layout = template.layout || 'centered';
  const fontFamily = template.font_style === 'serif' ? 'Georgia, Times, serif' : 'Arial, Helvetica, sans-serif';
  const showBorder = template.show_border !== false;
  const isLeftAligned = layout === 'left-aligned';

  // Build visible fields
  const visibleFields = customFields
    .filter((f) => f.on_ticket)
    .map((f) => ({
      label: f.label,
      value: metadata[f.key] || '—',
    }));

  const fieldRows = visibleFields
    .map((f) => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">${f.label}</span>
        <span style="font-size:13px;color:#222;font-weight:600;">${f.value}</span>
      </div>
    `)
    .join('');

  return `
<div style="max-width:480px;margin:0 auto;font-family:${fontFamily};background:#fff;border:${showBorder ? '2px solid ' + primaryColor : '1px solid #e0e0e0'};border-radius:12px;overflow:hidden;position:relative;">
  ${template.show_watermark ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.03);font-weight:900;white-space:nowrap;">HALL TICKET</div>` : ''}
  <div style="background:linear-gradient(135deg,${primaryColor},${accentColor});padding:20px 24px;text-align:${isLeftAligned ? 'left' : 'center'};">
    <h2 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${headerText}</h2>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">${subHeader}</p>
  </div>
  <div style="padding:20px 24px;display:${isLeftAligned ? 'flex' : 'block'};gap:20px;${isLeftAligned ? 'align-items:flex-start;' : ''}">
    <div style="${isLeftAligned ? 'flex:1;' : ''}">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Name</span>
        <span style="font-size:13px;color:#222;font-weight:600;">${ticket.student_name}</span>
      </div>
      ${fieldRows}
    </div>
    <div style="text-align:center;${isLeftAligned ? 'flex-shrink:0;' : 'margin-top:16px;'}">
      <img src="${qrDataURL}" width="120" height="120" alt="QR Code" style="border-radius:8px;">
    </div>
  </div>
  <div style="background:#f8f8fa;padding:10px 24px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;font-size:10px;color:#999;">This is a computer-generated ticket. Present at venue for verification.</p>
  </div>
</div>
  `.trim();
}
