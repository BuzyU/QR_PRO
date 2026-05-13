import { supabase } from '../config/supabase.js';
import { generateToken, generateSignature } from './tokenService.js';
import { generateQRDataURL } from './qrService.js';
import { env } from '../config/env.js';

/**
 * Unified ticket processing pipeline.
 * Both Google Forms and file upload use this same function.
 *
 * ALL event-specific config comes from the event object — no hardcoded defaults.
 *
 * @param {Object} params
 * @param {string} params.name - attendee name (mapped from CSV/Form column)
 * @param {string} params.email - attendee email (mapped from CSV/Form column)
 * @param {Object} params.metadata - all custom field values (dynamic, from event config)
 * @param {string} params.userId - Firebase UID of the host
 * @param {string} params.eventId - Event ID this ticket belongs to
 * @param {string} params.source - 'form' | 'upload' | 'client'
 * @returns {Promise<{success: boolean, ticketId?: string, token?: string, verifyURL?: string, error?: string}>}
 */
export async function processEntry({
  name,
  email,
  metadata = {},
  userId,
  eventId,
  source = 'upload',
}) {
  // 1. Validate required fields
  if (!name || !name.trim()) {
    return { success: false, error: 'Name is required' };
  }
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required' };
  }
  if (!eventId) {
    return { success: false, error: 'Event ID is required — tickets must belong to an event' };
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 2. Fetch event to validate it exists and belongs to the user
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, status, custom_fields')
    .eq('id', eventId)
    .eq('user_id', userId)
    .single();

  if (eventError || !event) {
    return { success: false, error: 'Event not found or access denied' };
  }

  if (event.status === 'completed') {
    return { success: false, error: `Event "${event.name}" is marked as completed — no new tickets can be created` };
  }

  // 3. Check for duplicates (same email + event)
  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .eq('email', cleanEmail)
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: `Duplicate: ${cleanEmail} already has a ticket for "${event.name}"` };
  }

  // 4. Validate required custom fields
  const requiredFields = (event.custom_fields || []).filter((f) => f.required);
  for (const field of requiredFields) {
    const value = metadata[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      return { success: false, error: `Required field "${field.label}" is missing` };
    }
  }

  // 5. Generate token + signature
  const token = generateToken();
  const signature = generateSignature(token);

  // 6. Build verify URL
  const verifyURL = `${env.frontendUrl}/verify?token=${token}`;

  // 7. Generate QR code
  const qrDataURL = await generateQRDataURL(verifyURL);

  // 8. Insert into database — no hardcoded defaults anywhere
  const { data, error } = await supabase
    .from('students')
    .insert({
      student_name: cleanName,
      email: cleanEmail,
      event_id: eventId,
      event_name: event.name,
      token,
      signature,
      metadata,
      source,
      user_id: userId,
      email_sent: false,
      attendance_status: 'absent',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[TicketService] DB insert error:', error.message);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    ticketId: data.id,
    token,
    verifyURL,
    qrDataURL,
  };
}
