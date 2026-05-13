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
 * @param {string} job.eventName
 * @param {Object} [job.event] - full event object for template rendering
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
    .select('id, email, student_name, metadata, token, user_id, event_id, email_retries, email_sent_at')
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

  let recoveredCount = 0;

  for (const ticket of pending) {
    // If ticket failed completely, skip
    if (ticket.email_retries >= 3) {
      continue;
    }

    // If ticket was deferred due to quota, check if 24h have passed
    if (ticket.email_retries === -1) {
      if (ticket.email_sent_at) {
        const sentAt = new Date(ticket.email_sent_at).getTime();
        const hoursPassed = (Date.now() - sentAt) / (1000 * 60 * 60);
        if (hoursPassed < 24) {
          continue; // still deferred
        }
      }
    }

    // Fetch user profile for SMTP credentials
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', ticket.user_id)
      .single();

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', ticket.event_id)
      .single();

    if (!event?.email_config && !profile?.smtp_config) {
      console.warn(
        `[Queue] Skipping ticket ${ticket.id}: no email configuration found`
      );
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
      event,
    });

    recoveredCount++;
  }

  console.log(`[Queue] Recovered ${recoveredCount} pending emails.`);
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
