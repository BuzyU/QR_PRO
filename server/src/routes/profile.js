import { Router } from 'express';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { supabase } from '../config/supabase.js';
import { encrypt, decrypt } from '../config/crypto.js';
import { sendTestEmail } from '../services/emailService.js';

const router = Router();

// All profile routes require Firebase authentication
router.use(firebaseAuth);

/**
 * GET /api/profile — get current user's profile
 */
router.get('/profile', (req, res) => {
  const profile = { ...req.userProfile };
  // Never expose raw SMTP credentials — just show if configured
  if (profile.smtp_config) {
    try {
      const parsed = JSON.parse(decrypt(profile.smtp_config));
      profile.smtp_configured = true;
      profile.smtp_email = parsed.from_email ? maskEmail(parsed.from_email) : null;
    } catch {
      profile.smtp_configured = !!profile.smtp_config;
      profile.smtp_email = null;
    }
  } else {
    profile.smtp_configured = false;
    profile.smtp_email = null;
  }
  delete profile.smtp_config;
  res.json({ profile });
});

/**
 * PUT /api/profile — update profile fields
 */
router.put('/profile', async (req, res) => {
  try {
    const { display_name, institution_name } = req.body;
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (institution_name !== undefined) updates.institution_name = institution_name;

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', req.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * PUT /api/profile/smtp — save SMTP credentials (encrypted)
 */
router.put('/profile/smtp', async (req, res) => {
  try {
    const { from_email, resend_key } = req.body;

    if (!from_email || !resend_key) {
      return res.status(400).json({ error: 'From Email and Resend API Key required' });
    }

    // Encrypt credentials
    const encrypted = encrypt(JSON.stringify({
      from_email,
      resend_key,
    }));

    const { error } = await supabase
      .from('user_profiles')
      .update({ smtp_config: encrypted })
      .eq('id', req.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: 'SMTP credentials saved (encrypted)' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save SMTP config' });
  }
});

/**
 * POST /api/profile/smtp/test — send a test email
 */
router.post('/profile/smtp/test', async (req, res) => {
  try {
    const { from_email, resend_key } = req.body;

    if (!from_email || !resend_key) {
      return res.status(400).json({ error: 'From Email and Resend API Key required' });
    }

    const result = await sendTestEmail(resend_key, from_email);
    if (result.success) {
      res.json({ success: true, message: 'Test email sent! Check your inbox.' });
    } else {
      res.status(400).json({ error: `Email test failed: ${result.error}` });
    }
  } catch (err) {
    res.status(500).json({ error: 'Test failed' });
  }
});

/**
 * POST /api/profile/api-key/rotate — generate a new API key
 */
router.post('/profile/api-key/rotate', async (req, res) => {
  try {
    const newKey = generateApiKey();
    const { error } = await supabase
      .from('user_profiles')
      .update({ api_key: newKey })
      .eq('id', req.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, api_key: newKey });
  } catch (err) {
    res.status(500).json({ error: 'Key rotation failed' });
  }
});

/**
 * PUT /api/profile/column-mapping — save column mapping configuration
 *
 * Expected body:
 * {
 *   name_field: "Student Name",
 *   email_field: "Email ID",
 *   fields: [
 *     { source: "Roll No", label: "Roll Number", visible_on_ticket: true },
 *     { source: "Department", label: "Department", visible_on_ticket: true },
 *     { source: "Phone", label: "Phone Number", visible_on_ticket: false }
 *   ]
 * }
 */
router.put('/profile/column-mapping', async (req, res) => {
  try {
    const { name_field, email_field, fields } = req.body;

    if (!name_field || !email_field) {
      return res.status(400).json({ error: 'name_field and email_field are required' });
    }

    const mapping = {
      name_field,
      email_field,
      fields: fields || [],
    };

    const { error } = await supabase
      .from('user_profiles')
      .update({ column_mapping: mapping })
      .eq('id', req.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: 'Column mapping saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save mapping' });
  }
});

/**
 * PUT /api/profile/ticket-template — save custom ticket HTML/CSS template
 */
router.put('/profile/ticket-template', async (req, res) => {
  try {
    const { html, css, type } = req.body;

    const template = {
      type: type || 'custom', // 'default' | 'custom'
      html: html || '',
      css: css || '',
    };

    const { error } = await supabase
      .from('user_profiles')
      .update({ ticket_template: template })
      .eq('id', req.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save template' });
  }
});

/**
 * GET /api/profile/ticket-template — get user's ticket template
 */
router.get('/profile/ticket-template', (req, res) => {
  res.json({
    template: req.userProfile.ticket_template || { type: 'default', html: '', css: '' },
  });
});

// --- Helpers ---

function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'qrp_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function maskEmail(email) {
  const [user, domain] = email.split('@');
  if (!domain) return '****';
  return user.slice(0, 2) + '****@' + domain;
}

export default router;
