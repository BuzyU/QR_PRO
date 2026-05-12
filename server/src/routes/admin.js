import { Router } from 'express';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { supabase } from '../config/supabase.js';
import { addJob, getStats } from '../services/queueService.js';

const router = Router();

// All admin routes require Firebase authentication inline

/**
 * GET /api/tickets — list user's tickets with pagination
 */
router.get('/tickets', firebaseAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('students')
      .select('id, student_name, email, urn, event_name, year, batch_number, time_slot, metadata, source, email_sent, email_sent_at, scan_count, created_at', { count: 'exact' })
      .eq('user_id', req.userId)
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
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

/**
 * POST /api/resend/:id — re-queue email for a specific ticket
 */
router.post('/resend/:id', firebaseAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch ticket (ensure it belongs to this user)
    const { data: ticket, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!ticket.email) {
      return res.status(400).json({ error: 'Ticket has no email address' });
    }

    if (!req.userProfile.smtp_config) {
      return res.status(400).json({ error: 'SMTP not configured' });
    }

    // Reset email status
    await supabase
      .from('students')
      .update({ email_sent: false, email_retries: 0 })
      .eq('id', id);

    // Get visible fields from column mapping
    const mapping = req.userProfile.column_mapping || {};
    const visibleFields = (mapping.fields || []).filter((f) => f.visible_on_ticket);

    const verifyURL = `${process.env.FRONTEND_URL || ''}/verify?token=${ticket.token}`;

    addJob({
      ticketId: ticket.id,
      to: ticket.email,
      name: ticket.student_name,
      metadata: ticket.metadata || {},
      verifyURL,
      userProfile: req.userProfile,
      visibleFields,
    });

    res.json({ success: true, message: 'Email re-queued' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend' });
  }
});

/**
 * GET /api/batches — list user's upload batches
 */
router.get('/batches', firebaseAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('upload_batches')
      .select('*')
      .eq('created_by', req.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({ batches: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

/**
 * GET /api/export — export user's tickets as JSON (frontend converts to CSV)
 */
router.get('/export', firebaseAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('student_name, email, urn, event_name, year, batch_number, time_slot, metadata, email_sent, scan_count, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ tickets: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * GET /api/queue-stats — current queue statistics (database-backed)
 */
router.get('/queue-stats', firebaseAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('email_sent, email_retries')
      .eq('user_id', req.userId);

    let sent = 0;
    let deferred = 0;
    let failed = 0;
    let pending = 0; // In queue or waiting for retry (retries 0-2)

    if (data) {
      data.forEach(t => {
        if (t.email_sent) {
          sent++;
        } else if (t.email_retries === -1) {
          deferred++;
        } else if (t.email_retries >= 3) {
          failed++;
        } else {
          pending++;
        }
      });
    }

    res.json({ sent, deferred, failed, pending });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
});

export default router;
