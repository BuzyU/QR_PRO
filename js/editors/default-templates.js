/**
 * Default template library for QR PRO.
 * Each template type (email, ticket) has 4 predefined designs.
 * Templates use {{variable}} placeholders that get replaced with real data.
 */

// ─── Email Templates ────────────────────────────────────────────────

export const EMAIL_TEMPLATES = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, simple design with essential info only.',
    preview_color: '#2a2478',
    config: {
      subject: 'Your Hall Ticket — {{event_name}}',
      greeting: 'Dear {{name}},',
      body_text: 'Your hall ticket has been generated. Present the QR code below at the venue for verification.',
      primary_color: '#2a2478',
      accent_color: '#6c63ff',
      show_logo: false,
      show_footer: true,
      footer_text: 'This is a computer-generated ticket. Do not reply.',
    },
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Formal layout with institution branding.',
    preview_color: '#1a365d',
    config: {
      subject: '{{event_name}} — Official Hall Ticket',
      greeting: 'Dear {{name}},',
      body_text: 'We are pleased to confirm your registration for {{event_name}}. Please find your official hall ticket details and QR verification code below. Present this at the venue entrance.',
      primary_color: '#1a365d',
      accent_color: '#3182ce',
      show_logo: true,
      show_footer: true,
      footer_text: 'Issued by {{institution}}. For queries, contact the event organizer.',
    },
  },

  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Vibrant gradient design with rounded elements.',
    preview_color: '#7c3aed',
    config: {
      subject: '🎟️ {{event_name}} — Your Ticket is Ready!',
      greeting: 'Hey {{name}}! 👋',
      body_text: 'Great news — your ticket for {{event_name}} is confirmed! Below is your unique QR code. Just show it at the entrance, and you\'re in.',
      primary_color: '#7c3aed',
      accent_color: '#ec4899',
      show_logo: false,
      show_footer: true,
      footer_text: 'See you at the event! 🎉',
    },
  },

  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional bordered layout with serif accents.',
    preview_color: '#065f46',
    config: {
      subject: 'Hall Ticket — {{event_name}} ({{year}})',
      greeting: 'Dear {{name}},',
      body_text: 'This is to certify that you are a registered participant for {{event_name}}. The following hall ticket serves as your entry pass. Please carry a valid photo ID along with this ticket.',
      primary_color: '#065f46',
      accent_color: '#059669',
      show_logo: true,
      show_footer: true,
      footer_text: 'Official Document — {{institution}}',
    },
  },
};

// ─── Ticket/PDF Templates ───────────────────────────────────────────

export const TICKET_TEMPLATES = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean card with QR code and key details.',
    preview_color: '#2a2478',
    config: {
      header_text: '{{event_name}}',
      sub_header: 'Hall Ticket',
      primary_color: '#2a2478',
      accent_color: '#6c63ff',
      layout: 'centered',
      show_border: false,
      show_watermark: false,
      font_style: 'sans-serif',
    },
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Formal layout with institution header and bordered fields.',
    preview_color: '#1a365d',
    config: {
      header_text: '{{institution}}',
      sub_header: '{{event_name}} — Hall Ticket',
      primary_color: '#1a365d',
      accent_color: '#3182ce',
      layout: 'left-aligned',
      show_border: true,
      show_watermark: true,
      font_style: 'serif',
    },
  },

  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Gradient header with rounded card elements.',
    preview_color: '#7c3aed',
    config: {
      header_text: '{{event_name}}',
      sub_header: 'Entry Pass',
      primary_color: '#7c3aed',
      accent_color: '#ec4899',
      layout: 'centered',
      show_border: false,
      show_watermark: false,
      font_style: 'sans-serif',
    },
  },

  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional exam hall ticket with ruled borders.',
    preview_color: '#065f46',
    config: {
      header_text: '{{institution}}',
      sub_header: 'Admit Card — {{event_name}}',
      primary_color: '#065f46',
      accent_color: '#059669',
      layout: 'left-aligned',
      show_border: true,
      show_watermark: true,
      font_style: 'serif',
    },
  },
};

// ─── Template Rendering ─────────────────────────────────────────────

/**
 * Replace {{variable}} placeholders with actual data.
 */
export function interpolate(text, data) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

/**
 * Build email HTML from a template config + data.
 * Used for the live preview in the editor.
 */
export function renderEmailPreview(config, data) {
  const c = config || {};
  const d = {
    name: data.name || 'John Doe',
    event_name: data.event_name || 'Sample Event',
    institution: data.institution || 'Sample Institution',
    year: data.year || '2026',
    ...data,
  };

  const greeting = interpolate(c.greeting || 'Dear {{name}},', d);
  const bodyText = interpolate(c.body_text || 'Your hall ticket has been generated.', d);
  const footerText = interpolate(c.footer_text || '', d);
  const primaryColor = c.primary_color || '#2a2478';
  const accentColor = c.accent_color || '#6c63ff';

  // Build field rows from sample data
  const fields = data.fields || [];
  const fieldRows = fields
    .map((f) => `
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0f0;width:40%;">${f.label}</td>
        <td style="padding:10px 16px;font-size:14px;color:#1a1a2e;font-weight:600;border-bottom:1px solid #f0f0f0;">${f.value}</td>
      </tr>
    `)
    .join('');

  return `
<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;background:#f5f5fa;padding:24px 12px;">
  <div style="background:linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%);border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">${interpolate(c.header_text || '{{institution}}', d) || d.institution}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">${interpolate(c.sub_header || '{{event_name}}', d) || d.event_name}</p>
  </div>
  <div style="background:#fff;border:1px solid #e8e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#333;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">${bodyText}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #f0f0f0;">
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;border-bottom:1px solid #f0f0f0;width:40%;">Name</td>
        <td style="padding:10px 16px;font-size:14px;color:#1a1a2e;font-weight:600;border-bottom:1px solid #f0f0f0;">${d.name}</td>
      </tr>
      ${fieldRows}
    </table>
    <div style="text-align:center;margin:24px 0;">
      <div style="width:160px;height:160px;background:#f0f0f5;border-radius:12px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:12px;color:#aaa;border:2px dashed #ddd;">QR Code</div>
      <p style="margin:10px 0 0;font-size:11px;color:#aaa;">Scan to verify</p>
    </div>
    <div style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${primaryColor},${accentColor});color:#fff;font-size:14px;font-weight:700;border-radius:10px;">Verify Online</span>
    </div>
    ${c.show_footer !== false && footerText ? `
    <div style="border-top:1px solid #f0f0f0;padding-top:16px;margin-top:20px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#bbb;">${footerText}</p>
    </div>` : ''}
  </div>
</div>
  `.trim();
}

/**
 * Build ticket/PDF preview HTML from a template config + data.
 */
export function renderTicketPreview(config, data) {
  const c = config || {};
  const d = {
    name: data.name || 'John Doe',
    event_name: data.event_name || 'Sample Event',
    institution: data.institution || 'Sample Institution',
    ...data,
  };

  const primaryColor = c.primary_color || '#2a2478';
  const accentColor = c.accent_color || '#6c63ff';
  const headerText = interpolate(c.header_text || '{{event_name}}', d);
  const subHeader = interpolate(c.sub_header || 'Hall Ticket', d);
  const layout = c.layout || 'centered';
  const fontFamily = c.font_style === 'serif' ? 'Georgia, Times, serif' : 'Arial, Helvetica, sans-serif';
  const showBorder = c.show_border !== false;

  const fields = data.fields || [];
  const isLeftAligned = layout === 'left-aligned';

  const fieldRows = fields
    .map((f) => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">${f.label}</span>
        <span style="font-size:13px;color:#222;font-weight:600;">${f.value}</span>
      </div>
    `)
    .join('');

  return `
<div style="max-width:480px;margin:0 auto;font-family:${fontFamily};background:#fff;border:${showBorder ? '2px solid ' + primaryColor : '1px solid #e0e0e0'};border-radius:12px;overflow:hidden;position:relative;">
  ${c.show_watermark ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.03);font-weight:900;white-space:nowrap;">HALL TICKET</div>` : ''}
  <div style="background:linear-gradient(135deg,${primaryColor},${accentColor});padding:20px 24px;text-align:${isLeftAligned ? 'left' : 'center'};">
    <h2 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${headerText}</h2>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">${subHeader}</p>
  </div>
  <div style="padding:20px 24px;display:${isLeftAligned ? 'flex' : 'block'};gap:20px;${isLeftAligned ? 'align-items:flex-start;' : ''}">
    <div style="${isLeftAligned ? 'flex:1;' : ''}">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Name</span>
        <span style="font-size:13px;color:#222;font-weight:600;">${d.name}</span>
      </div>
      ${fieldRows}
    </div>
    <div style="text-align:center;${isLeftAligned ? 'flex-shrink:0;' : 'margin-top:16px;'}">
      <div style="width:120px;height:120px;background:#f5f5f5;border-radius:8px;margin:0 ${isLeftAligned ? '0' : 'auto'};display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa;border:2px dashed #ddd;">QR Code</div>
    </div>
  </div>
  <div style="background:#f8f8fa;padding:10px 24px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;font-size:10px;color:#999;">This is a computer-generated ticket. Present at venue for verification.</p>
  </div>
</div>
  `.trim();
}
