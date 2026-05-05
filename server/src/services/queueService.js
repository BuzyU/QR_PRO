import PQueue from 'p-queue';
import { supabase } from '../config/supabase.js';
import { sendTicketEmail } from './emailService.js';

// Global queue: max 5 concurrent jobs
const queue = new PQueue({ concurrency: 5 });

// Per-user concurrency tracking
const userJobCount = new Map();
const MAX_PER_USER = 3;

/**
 * Add an email job to the processing queue.
 * Respects per-user concurrency limits.
 *
 * @param {Object} job
 * @param {string} job.ticketId
 * @param {string} job.to
 * @param {string} job.name
 * @param {Object} job.metadata
 * @param {string} job.verifyURL
 * @param {Object} job.userProfile
 * @param {Array}  job.visibleFields
 */
export function addJob(job) {
  const userId = job.userProfile.id;

  queue.add(async () => {
    // Per-user concurrency check (wait if user has too many active)
    while ((userJobCount.get(userId) || 0) >= MAX_PER_USER) {
      await sleep(500);
    }

    userJobCount.set(userId, (userJobCount.get(userId) || 0) + 1);

    try {
      const result = await sendTicketEmail(job);
      if (!result.success) {
        console.error(`[Queue] Email failed for ${job.to}: ${result.error}`);
      }
    } catch (err) {
      console.error(`[Queue] Job error for ${job.to}: ${err.message}`);
    } finally {
      const current = userJobCount.get(userId) || 1;
      userJobCount.set(userId, Math.max(0, current - 1));
    }
  });
}

/**
 * On server startup, recover any unsent emails from the database.
 * This handles the case where Render restarted mid-processing.
 */
export async function recoverPendingEmails() {
  console.log('[Queue] Checking for pending emails to recover...');

  const { data: pending, error } = await supabase
    .from('students')
    .select('id, email, student_name, metadata, token, user_id')
    .eq('email_sent', false)
    .not('email', 'is', null)
    .not('token', 'is', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[Queue] Recovery query failed:', error.message);
    return;
  }

  if (!pending || pending.length === 0) {
    console.log('[Queue] No pending emails to recover.');
    return;
  }

  console.log(`[Queue] Recovering ${pending.length} pending emails...`);

  for (const ticket of pending) {
    // Fetch user profile for SMTP credentials
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', ticket.user_id)
      .single();

    if (!profile || !profile.smtp_config) {
      console.warn(`[Queue] Skipping ticket ${ticket.id}: user has no SMTP configured`);
      continue;
    }

    const verifyURL = `${process.env.FRONTEND_URL || ''}/verify?token=${ticket.token}`;

    addJob({
      ticketId: ticket.id,
      to: ticket.email,
      name: ticket.student_name,
      metadata: ticket.metadata || {},
      verifyURL,
      userProfile: profile,
      visibleFields: profile.column_mapping?.fields?.filter((f) => f.visible_on_ticket) || [],
    });
  }
}

/**
 * Get current queue statistics.
 */
export function getStats() {
  return {
    pending: queue.pending,
    active: queue.size,
    isPaused: queue.isPaused,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
