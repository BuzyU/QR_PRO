import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { processEntry } from '../services/ticketService.js';
import { addJob } from '../services/queueService.js';
import { supabase } from '../config/supabase.js';

const router = Router();

/**
 * POST /api/ticket
 * Used by Google Forms (Apps Script) to create a single ticket.
 * Auth: API key header → resolves to user.
 *
 * The request body must include `event_id` to link the ticket to an event.
 * The event's column_mapping determines which fields are name/email.
 * The event's custom_fields determines which extra fields are expected.
 */
router.post('/ticket', apiLimiter, apiKeyAuth, async (req, res) => {
  try {
    const { userProfile } = req;
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Event ID is required — no default event
    const eventId = body.event_id || body.eventId;
    if (!eventId) {
      return res.status(400).json({
        error: 'Missing event_id. Each ticket must belong to an event. Add event_id to your form data or Apps Script.',
      });
    }

    // Fetch event config (column mapping + custom fields)
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, column_mapping, custom_fields, name, status')
      .eq('id', eventId)
      .eq('user_id', req.userId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ error: `Event not found for ID: ${eventId}` });
    }

    if (event.status === 'completed') {
      return res.status(400).json({ error: `Event "${event.name}" is completed. No new tickets.` });
    }

    // Apply event's column mapping to extract name + email
    const mapping = event.column_mapping || {};
    const nameField = mapping.name_field || 'name';
    const emailField = mapping.email_field || 'email';

    const name = body[nameField] || body.name || body.Name || '';
    const email = body[emailField] || body.email || body.Email || '';

    if (!name || !email) {
      return res.status(400).json({
        error: `Missing required fields. Expected '${nameField}' and '${emailField}'. Got keys: ${Object.keys(body).join(', ')}`,
      });
    }

    // Build metadata from custom fields using field_map
    const fieldMap = mapping.field_map || {};
    const metadata = {};

    for (const field of (event.custom_fields || [])) {
      // Look up the column name for this field key
      const columnName = fieldMap[field.key] || field.key;
      const value = body[columnName] ?? body[field.key] ?? body[field.label] ?? '';
      metadata[field.key] = value;
    }

    // Process through the unified pipeline
    const result = await processEntry({
      name,
      email,
      metadata,
      userId: req.userId,
      eventId,
      source: 'form',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Queue email sending
    if (userProfile.smtp_config || userProfile.gmail_tokens) {
      const visibleFields = (event.custom_fields || []).filter((f) => f.in_email);
      addJob({
        ticketId: result.ticketId,
        to: email,
        name,
        metadata,
        verifyURL: result.verifyURL,
        userProfile,
        visibleFields,
        eventName: event.name,
        event,
      });
    }

    res.json({
      success: true,
      ticketId: result.ticketId,
      token: result.token,
    });
  } catch (err) {
    console.error('[POST /api/ticket] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
