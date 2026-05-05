import { Router } from 'express';
import { verifyLimiter } from '../middleware/rateLimiter.js';
import { verifySignature } from '../services/tokenService.js';
import { supabase } from '../config/supabase.js';

const router = Router();

/**
 * GET /api/verify?token=XYZ
 * Public endpoint — verifies a ticket token via HMAC.
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

    // Increment scan count
    await supabase
      .from('students')
      .update({
        scan_count: (ticket.scan_count || 0) + 1,
        last_scanned_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    // Log the scan
    await supabase.from('scan_logs').insert({
      ticket_id: ticket.id,
      ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
    });

    // Return ticket details (strip sensitive fields)
    res.json({
      status: 'VERIFIED',
      ticket: {
        name: ticket.student_name,
        urn: ticket.urn,
        institution: ticket.institution_name,
        event: ticket.event_name,
        year: ticket.year,
        batch: ticket.batch_number,
        timeSlot: ticket.time_slot,
        metadata: ticket.metadata || {},
        scanCount: (ticket.scan_count || 0) + 1,
        lastScanned: new Date().toISOString(),
        createdAt: ticket.created_at,
      },
    });
  } catch (err) {
    console.error('[GET /api/verify] Error:', err.message);
    res.status(500).json({ status: 'ERROR', error: 'Verification failed' });
  }
});

export default router;
