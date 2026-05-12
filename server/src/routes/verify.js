import { Router } from 'express';
import { verifyLimiter } from '../middleware/rateLimiter.js';
import { verifySignature } from '../services/tokenService.js';
import { supabase } from '../config/supabase.js';

const router = Router();

/**
 * GET /api/verify?token=XYZ
 * Public endpoint — verifies a ticket token via HMAC.
 * Auto-marks attendance on first valid scan.
 */
router.get('/verify', verifyLimiter, async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ status: 'INVALID', error: 'No token provided' });
    }

    // Look up ticket by token
    const { data: ticket, error } = await supabase
      .from('students')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !ticket) {
      return res.json({ status: 'NOT_FOUND', error: 'Token does not match any ticket' });
    }

    // Verify HMAC signature
    if (!ticket.signature || !verifySignature(token, ticket.signature)) {
      return res.json({ status: 'INVALID', error: 'Signature verification failed' });
    }

    // Fetch event info (if ticket has an event)
    let eventInfo = null;
    if (ticket.event_id) {
      const { data: event } = await supabase
        .from('events')
        .select('name, description, custom_fields')
        .eq('id', ticket.event_id)
        .single();

      if (event) {
        eventInfo = event;
      }
    }

    const isFirstScan = (ticket.scan_count || 0) === 0;
    const newScanCount = (ticket.scan_count || 0) + 1;

    // Update scan count + auto-mark present on first scan
    const updates = {
      scan_count: newScanCount,
      last_scanned_at: new Date().toISOString(),
    };

    if (isFirstScan && ticket.attendance_status !== 'present') {
      updates.attendance_status = 'present';
      updates.attended_at = new Date().toISOString();
    }

    await supabase
      .from('students')
      .update(updates)
      .eq('id', ticket.id);

    // Log the scan
    await supabase.from('scan_logs').insert({
      ticket_id: ticket.id,
      ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
    });

    // Build visible fields from event config
    const visibleFields = [];
    if (eventInfo && eventInfo.custom_fields) {
      for (const field of eventInfo.custom_fields) {
        if (field.on_ticket) {
          visibleFields.push({
            label: field.label,
            value: ticket.metadata?.[field.key] || '—',
          });
        }
      }
    }

    // Return ticket details
    res.json({
      status: 'VERIFIED',
      isFirstScan,
      ticket: {
        name: ticket.student_name,
        email: ticket.email,
        event: eventInfo?.name || ticket.event_name || '',
        fields: visibleFields,
        metadata: ticket.metadata || {},
        scanCount: newScanCount,
        attendanceStatus: isFirstScan ? 'present' : ticket.attendance_status,
        attendedAt: isFirstScan ? updates.attended_at : ticket.attended_at,
        lastScanned: updates.last_scanned_at,
        createdAt: ticket.created_at,
      },
    });
  } catch (err) {
    console.error('[GET /api/verify] Error:', err.message);
    res.status(500).json({ status: 'ERROR', error: 'Verification failed' });
  }
});

export default router;
