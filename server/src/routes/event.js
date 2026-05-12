import { Router } from 'express';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import {
  generateAuthUrl,
  exchangeCode,
  sendViaGmail,
  getGmailProfile,
  decryptEmailConfig,
  encryptEmailConfig,
} from '../services/gmailService.js';
import { sendTestEmail as sendResendTestEmail } from '../services/emailService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { processEntry } from '../services/ticketService.js';
import { addJob } from '../services/queueService.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ─── Public Route (no auth) ─────────────────────────────────────────
// Gmail OAuth callback — Google redirects the browser here directly.
// Must be registered BEFORE the firebaseAuth middleware.
router.get('/events/gmail/callback', async (req, res) => {
  try {
    const { code, state: eventId, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${env.frontendUrl}/#/event/${eventId}?gmail=error&reason=${oauthError}`);
    }

    if (!code || !eventId) {
      return res.status(400).send('Missing code or event ID');
    }

    const { data: event } = await supabase
      .from('events')
      .select('id, email_config, user_id')
      .eq('id', eventId)
      .single();

    if (!event || !event.email_config) {
      return res.status(404).send('Event not found');
    }

    const config = decryptEmailConfig(event.email_config);
    if (!config || !config.gmail_client_id || !config.gmail_client_secret) {
      return res.status(400).send('Gmail credentials not configured for this event');
    }

    const redirectUri = `${env.serverUrl || req.protocol + '://' + req.get('host')}/api/events/gmail/callback`;

    const tokens = await exchangeCode({
      code,
      clientId: config.gmail_client_id,
      clientSecret: config.gmail_client_secret,
      redirectUri,
    });

    const gmailEmail = await getGmailProfile({
      clientId: config.gmail_client_id,
      clientSecret: config.gmail_client_secret,
      accessToken: tokens.access_token,
    });

    const updatedConfig = {
      ...config,
      gmail_refresh_token: tokens.refresh_token || config.gmail_refresh_token,
      gmail_access_token: tokens.access_token,
      gmail_email: gmailEmail || '',
      gmail_connected_at: new Date().toISOString(),
    };

    const encrypted = encryptEmailConfig(updatedConfig);

    await supabase
      .from('events')
      .update({ email_config: encrypted, updated_at: new Date().toISOString() })
      .eq('id', eventId);

    res.redirect(`${env.frontendUrl}/#/event/${eventId}?gmail=success&email=${gmailEmail || ''}`);
  } catch (err) {
    console.error('[GET /api/events/gmail/callback]', err.message);
    const eventId = req.query.state || '';
    res.redirect(`${env.frontendUrl}/#/event/${eventId}?gmail=error&reason=${encodeURIComponent(err.message)}`);
  }
});

// All remaining event routes require Firebase authentication
router.use(firebaseAuth);

/**
 * GET /api/events — list user's events
 */
router.get('/events', async (req, res) => {
  try {
    // Fetch events with ticket counts
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Get ticket stats for each event
    const eventIds = (events || []).map((e) => e.id);
    let ticketStats = {};

    if (eventIds.length > 0) {
      const { data: stats } = await supabase
        .from('students')
        .select('event_id, email_sent, attendance_status')
        .in('event_id', eventIds);

      if (stats) {
        for (const s of stats) {
          if (!ticketStats[s.event_id]) {
            ticketStats[s.event_id] = { total: 0, sent: 0, present: 0 };
          }
          ticketStats[s.event_id].total++;
          if (s.email_sent) ticketStats[s.event_id].sent++;
          if (s.attendance_status === 'present') ticketStats[s.event_id].present++;
        }
      }
    }

    const enriched = (events || []).map((e) => ({
      ...e,
      stats: ticketStats[e.id] || { total: 0, sent: 0, present: 0 },
    }));

    res.json({ events: enriched });
  } catch (err) {
    console.error('[GET /api/events]', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:id — get single event details
 */
router.get('/events/:id', async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get ticket stats
    const { data: tickets } = await supabase
      .from('students')
      .select('id, email_sent, attendance_status, scan_count')
      .eq('event_id', event.id);

    const stats = { total: 0, sent: 0, present: 0, scanned: 0 };
    if (tickets) {
      stats.total = tickets.length;
      stats.sent = tickets.filter((t) => t.email_sent).length;
      stats.present = tickets.filter((t) => t.attendance_status === 'present').length;
      stats.scanned = tickets.filter((t) => (t.scan_count || 0) > 0).length;
    }

    res.json({ event, stats });
  } catch (err) {
    console.error('[GET /api/events/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * POST /api/events — create a new event
 */
router.post('/events', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        description: (description || '').trim(),
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, event: data });
  } catch (err) {
    console.error('[POST /api/events]', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * PUT /api/events/:id — update event details
 */
router.put('/events/:id', async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (status !== undefined) {
      if (!['draft', 'active', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.status = status;
    }

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/events/:id]', err.message);
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * PUT /api/events/:id/fields — save custom field definitions
 */
router.put('/events/:id/fields', async (req, res) => {
  try {
    const { custom_fields } = req.body;

    if (!Array.isArray(custom_fields)) {
      return res.status(400).json({ error: 'custom_fields must be an array' });
    }

    // Validate each field
    for (const field of custom_fields) {
      if (!field.key || !field.label) {
        return res.status(400).json({ error: 'Each field must have a key and label' });
      }
    }

    const { error } = await supabase
      .from('events')
      .update({
        custom_fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/events/:id/fields]', err.message);
    res.status(500).json({ error: 'Failed to save fields' });
  }
});

/**
 * PUT /api/events/:id/column-mapping — save column mapping for CSV/Forms
 */
router.put('/events/:id/column-mapping', async (req, res) => {
  try {
    const { name_field, email_field, field_map } = req.body;

    if (!name_field || !email_field) {
      return res.status(400).json({ error: 'name_field and email_field are required' });
    }

    const { error } = await supabase
      .from('events')
      .update({
        column_mapping: { name_field, email_field, field_map: field_map || {} },
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/events/:id/column-mapping]', err.message);
    res.status(500).json({ error: 'Failed to save mapping' });
  }
});

/**
 * PUT /api/events/:id/email-template — save email template config
 */
router.put('/events/:id/email-template', async (req, res) => {
  try {
    const { email_template } = req.body;

    if (!email_template || typeof email_template !== 'object') {
      return res.status(400).json({ error: 'email_template must be an object' });
    }

    const { error } = await supabase
      .from('events')
      .update({
        email_template,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/events/:id/email-template]', err.message);
    res.status(500).json({ error: 'Failed to save email template' });
  }
});

/**
 * PUT /api/events/:id/ticket-template — save ticket/PDF template config
 */
router.put('/events/:id/ticket-template', async (req, res) => {
  try {
    const { ticket_template, pdf_template } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (ticket_template) updates.ticket_template = ticket_template;
    if (pdf_template) updates.pdf_template = pdf_template;

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/events/:id/ticket-template]', err.message);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

/**
 * DELETE /api/events/:id — delete an event (and all its tickets)
 */
router.delete('/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;

    // Verify ownership
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('user_id', req.userId)
      .single();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete scan logs for this event's tickets
    const { data: tickets } = await supabase
      .from('students')
      .select('id')
      .eq('event_id', eventId);

    if (tickets && tickets.length > 0) {
      const ticketIds = tickets.map((t) => t.id);
      await supabase.from('scan_logs').delete().in('ticket_id', ticketIds);
    }

    // Delete tickets
    await supabase.from('students').delete().eq('event_id', eventId);

    // Delete upload batches
    await supabase.from('upload_batches').delete().eq('event_id', eventId);

    // Delete the event
    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/events/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/**
 * GET /api/events/:id/tickets — list tickets for an event
 */
router.get('/events/:id/tickets', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = (page - 1) * limit;

    // Verify ownership
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { data, error, count } = await supabase
      .from('students')
      .select(
        'id, student_name, email, urn, metadata, source, email_sent, email_sent_at, email_retries, scan_count, attendance_status, attended_at, created_at',
        { count: 'exact' }
      )
      .eq('event_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      tickets: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('[GET /api/events/:id/tickets]', err.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

/**
 * GET /api/events/:id/attendance — attendance summary for an event
 */
router.get('/events/:id/attendance', async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { data: tickets } = await supabase
      .from('students')
      .select('id, student_name, email, metadata, attendance_status, attended_at, scan_count')
      .eq('event_id', req.params.id)
      .order('student_name', { ascending: true });

    const all = tickets || [];
    const present = all.filter((t) => t.attendance_status === 'present');
    const absent = all.filter((t) => t.attendance_status !== 'present');

    res.json({
      total: all.length,
      presentCount: present.length,
      absentCount: absent.length,
      attendees: all,
    });
  } catch (err) {
    console.error('[GET /api/events/:id/attendance]', err.message);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PER-EVENT EMAIL DELIVERY CONFIG (Authenticated routes)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/events/:id/email-config — get email delivery status (no secrets exposed)
 */
router.get('/events/:id/email-config', async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, email_config')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.email_config) {
      return res.json({ configured: false, provider: null });
    }

    const config = decryptEmailConfig(event.email_config);
    if (!config) {
      return res.json({ configured: false, provider: null });
    }

    // Return status without exposing secrets
    res.json({
      configured: true,
      provider: config.provider || 'none',
      from_name: config.from_name || '',
      from_email: config.from_email || config.gmail_email || '',
      gmail_connected: !!(config.gmail_refresh_token && config.gmail_email),
      gmail_email: config.gmail_email || '',
      resend_configured: !!config.resend_key,
    });
  } catch (err) {
    console.error('[GET /api/events/:id/email-config]', err.message);
    res.status(500).json({ error: 'Failed to get email config' });
  }
});

/**
 * PUT /api/events/:id/email-config — save email delivery config
 * Host provides: provider, from_name, and either Resend key or Gmail Client ID/Secret
 */
router.put('/events/:id/email-config', async (req, res) => {
  try {
    const { provider, from_name, resend_key, from_email, gmail_client_id, gmail_client_secret } = req.body;

    // Verify ownership
    const { data: event } = await supabase
      .from('events')
      .select('id, email_config')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Merge with existing config (preserve gmail tokens if already connected)
    let existing = {};
    if (event.email_config) {
      existing = decryptEmailConfig(event.email_config) || {};
    }

    const newConfig = {
      ...existing,
      provider: provider || existing.provider || 'resend',
      from_name: from_name !== undefined ? from_name : existing.from_name || '',
    };

    if (provider === 'resend') {
      if (resend_key) newConfig.resend_key = resend_key;
      if (from_email) newConfig.from_email = from_email;
    } else if (provider === 'gmail') {
      if (gmail_client_id) newConfig.gmail_client_id = gmail_client_id;
      if (gmail_client_secret) newConfig.gmail_client_secret = gmail_client_secret;
    }

    const encrypted = encryptEmailConfig(newConfig);

    const { error } = await supabase
      .from('events')
      .update({ email_config: encrypted, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/events/:id/email-config]', err.message);
    res.status(500).json({ error: 'Failed to save email config' });
  }
});

/**
 * GET /api/events/:id/gmail/auth-url — generate Gmail OAuth consent URL
 * Uses the host's own Client ID + Secret stored in the event
 */
router.get('/events/:id/gmail/auth-url', async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('id, email_config')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const config = decryptEmailConfig(event.email_config);
    if (!config || !config.gmail_client_id || !config.gmail_client_secret) {
      return res.status(400).json({
        error: 'Save your Gmail Client ID and Client Secret first before connecting.',
      });
    }

    const redirectUri = `${env.serverUrl || req.protocol + '://' + req.get('host')}/api/events/gmail/callback`;

    const authUrl = generateAuthUrl({
      clientId: config.gmail_client_id,
      clientSecret: config.gmail_client_secret,
      redirectUri,
      eventId: req.params.id,
    });

    res.json({ authUrl, redirectUri });
  } catch (err) {
    console.error('[GET /api/events/:id/gmail/auth-url]', err.message);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/events/gmail/callback — Gmail OAuth callback
 * Google redirects here after consent. Exchanges code for tokens.
 * NOTE: This route does NOT require firebaseAuth (Google redirects the browser here).
 */
router.get('/events/gmail/callback', async (req, res) => {
  try {
    const { code, state: eventId, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${env.frontendUrl}/#/event/${eventId}?gmail=error&reason=${oauthError}`);
    }

    if (!code || !eventId) {
      return res.status(400).send('Missing code or event ID');
    }

    // Fetch event (no user auth check — we validate via the encrypted config)
    const { data: event } = await supabase
      .from('events')
      .select('id, email_config, user_id')
      .eq('id', eventId)
      .single();

    if (!event || !event.email_config) {
      return res.status(404).send('Event not found');
    }

    const config = decryptEmailConfig(event.email_config);
    if (!config || !config.gmail_client_id || !config.gmail_client_secret) {
      return res.status(400).send('Gmail credentials not configured for this event');
    }

    const redirectUri = `${env.serverUrl || req.protocol + '://' + req.get('host')}/api/events/gmail/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCode({
      code,
      clientId: config.gmail_client_id,
      clientSecret: config.gmail_client_secret,
      redirectUri,
    });

    // Get the Gmail email address
    const gmailEmail = await getGmailProfile({
      clientId: config.gmail_client_id,
      clientSecret: config.gmail_client_secret,
      refreshToken: tokens.refresh_token,
    });

    // Store tokens in event config
    const updatedConfig = {
      ...config,
      gmail_refresh_token: tokens.refresh_token,
      gmail_access_token: tokens.access_token,
      gmail_email: gmailEmail || '',
      gmail_connected_at: new Date().toISOString(),
    };

    const encrypted = encryptEmailConfig(updatedConfig);

    await supabase
      .from('events')
      .update({ email_config: encrypted, updated_at: new Date().toISOString() })
      .eq('id', eventId);

    // Redirect back to the event detail page
    res.redirect(`${env.frontendUrl}/#/event/${eventId}?gmail=success&email=${gmailEmail || ''}`);
  } catch (err) {
    console.error('[GET /api/events/gmail/callback]', err.message);
    const eventId = req.query.state || '';
    res.redirect(`${env.frontendUrl}/#/event/${eventId}?gmail=error&reason=${encodeURIComponent(err.message)}`);
  }
});

// ─── Webhook Route (API Key Auth) ───────────────────────────────────

/**
 * POST /api/events/:id/webhook
 * Ingest ticket requests directly from Google Forms (or Zapier).
 * Uses API Key authentication.
 */
router.post('/events/:id/webhook', uploadLimiter, apiKeyAuth, async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { userId, userProfile } = req;
    const row = req.body; // Expects JSON object representing a single row/submission

    if (!row || typeof row !== 'object') {
      return res.status(400).json({ error: 'Invalid payload. Expected JSON object.' });
    }

    // Fetch event config
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, name, status, column_mapping, custom_fields')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status === 'completed') {
      return res.status(400).json({ error: `Event "${event.name}" is completed. No new tickets.` });
    }

    // Column mapping
    const mapping = event.column_mapping || {};
    const nameField = mapping.name_field;
    const emailField = mapping.email_field;
    const fieldMap = mapping.field_map || {};

    if (!nameField || !emailField) {
      return res.status(400).json({ error: 'Event mapping is incomplete. Setup Name and Email mapping first.' });
    }

    const name = row[nameField];
    const email = row[emailField];

    if (!name || !email) {
      return res.status(400).json({ 
        error: `Missing required fields in payload. Expected '${nameField}' and '${emailField}'.` 
      });
    }

    // Map custom fields
    const metadata = {};
    for (const [fieldId, externalKey] of Object.entries(fieldMap)) {
      if (row[externalKey] !== undefined) {
        metadata[fieldId] = String(row[externalKey]);
      }
    }

    // Process ticket
    const result = await processEntry({
      name: String(name),
      email: String(email),
      metadata,
      userId,
      eventId,
      source: 'webhook',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Add to email queue
    const visibleFields = (mapping.fields || []).filter((f) => f.visible_on_ticket);

    addJob({
      ticketId: result.ticketId,
      to: result.email,
      name: result.name,
      metadata: result.metadata,
      verifyURL: result.verifyURL,
      userProfile,
      visibleFields,
      eventId,
    });

    res.json({ success: true, message: 'Ticket generated and queued', ticketId: result.ticketId });
  } catch (err) {
    console.error('[POST /api/events/:id/webhook]', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/events/:id/email-config/test — send a test email using event's config
 */
router.post('/events/:id/email-config/test', async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('id, email_config, name')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!event || !event.email_config) {
      return res.status(400).json({ error: 'Email not configured for this event' });
    }

    const config = decryptEmailConfig(event.email_config);
    if (!config) {
      return res.status(400).json({ error: 'Failed to decrypt email config' });
    }

    const testTo = req.body.to || config.gmail_email || config.from_email;
    if (!testTo) {
      return res.status(400).json({ error: 'No recipient email for test' });
    }

    if (config.provider === 'gmail') {
      if (!config.gmail_refresh_token) {
        return res.status(400).json({ error: 'Gmail not connected yet. Click "Connect Gmail" first.' });
      }

      const result = await sendViaGmail({
        emailConfig: config,
        to: testTo,
        subject: `[Test] ${event.name} — QR PRO Email Delivery`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;text-align:center;">
            <h2 style="color:#6c63ff;">Email Delivery Test ✅</h2>
            <p style="color:#555;">Gmail is working correctly for <strong>${event.name}</strong>.</p>
            <p style="color:#999;font-size:12px;">Sent via QR PRO at ${new Date().toLocaleString()}</p>
          </div>
        `,
        fromName: config.from_name || event.name,
      });

      return res.json(result);
    } else if (config.provider === 'resend') {
      if (!config.resend_key) {
        return res.status(400).json({ error: 'Resend API key not configured' });
      }

      const result = await sendResendTestEmail(config.resend_key, config.from_email);
      return res.json(result);
    }

    res.status(400).json({ error: 'Unknown provider' });
  } catch (err) {
    console.error('[POST /api/events/:id/email-config/test]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/events/:id/gmail/disconnect — remove Gmail connection
 */
router.delete('/events/:id/gmail/disconnect', async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('id, email_config')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!event || !event.email_config) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const config = decryptEmailConfig(event.email_config);
    if (config) {
      delete config.gmail_refresh_token;
      delete config.gmail_access_token;
      delete config.gmail_email;
      delete config.gmail_connected_at;

      const encrypted = encryptEmailConfig(config);
      await supabase
        .from('events')
        .update({ email_config: encrypted, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/events/:id/gmail/disconnect]', err.message);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

export default router;
