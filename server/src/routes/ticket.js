import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { processEntry } from '../services/ticketService.js';
import { addJob } from '../services/queueService.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * POST /api/ticket
 * Used by Google Forms (Apps Script) to create a single ticket.
 * Auth: API key header → resolves to user.
 */
router.post('/ticket', apiLimiter, apiKeyAuth, async (req, res) => {
  try {
    const { userProfile } = req;
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Apply user's column mapping to extract name + email from raw form data
    const mapping = userProfile.column_mapping || {};
    const nameField = mapping.name_field || 'name';
    const emailField = mapping.email_field || 'email';

    const name = body[nameField] || body.name || body.Name || '';
    const email = body[emailField] || body.email || body.Email || '';

    if (!name || !email) {
      return res.status(400).json({
        error: `Missing required fields. Expected '${nameField}' and '${emailField}'. Got keys: ${Object.keys(body).join(', ')}`,
      });
    }

    // All other fields become metadata
    const metadata = { ...body };
    delete metadata[nameField];
    delete metadata[emailField];

    // Process through the unified pipeline
    const result = await processEntry({
      name,
      email,
      metadata,
      userId: req.userId,
      source: 'form',
      institutionName: userProfile.institution_name || '',
      eventName: body.event_name || userProfile.default_event || '',
      year: body.year || '',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Queue email sending
    if (userProfile.smtp_config) {
      const visibleFields = (mapping.fields || []).filter((f) => f.visible_on_ticket);
      addJob({
        ticketId: result.ticketId,
        to: email,
        name,
        metadata,
        verifyURL: result.verifyURL,
        userProfile,
        visibleFields,
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
