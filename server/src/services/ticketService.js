import { supabase } from '../config/supabase.js';
import { generateToken, generateSignature } from './tokenService.js';
import { generateQRDataURL } from './qrService.js';
import { env } from '../config/env.js';

/**
 * Unified ticket processing pipeline.
 * Both Google Forms and file upload use this same function.
 *
 * @param {Object} params
 * @param {string} params.name - student name (mapped)
 * @param {string} params.email - student email (mapped)
 * @param {Object} params.metadata - all other fields (dynamic)
 * @param {string} params.userId - Firebase UID of the user who owns this ticket
 * @param {string} params.source - 'form' | 'upload' | 'client'
 * @param {string} [params.institutionName]
 * @param {string} [params.eventName]
 * @param {string} [params.year]
 * @param {number} [params.batchNumber]
 * @param {string} [params.timeSlot]
 * @returns {Promise<{success: boolean, ticketId?: string, token?: string, error?: string}>}
 */
export async function processEntry({
  name,
  email,
  metadata = {},
  userId,
  source = 'upload',
  institutionName = '',
  eventName = '',
  year = '',
  batchNumber = 1,
  timeSlot = '',
}) {
  // 1. Validate required fields
  if (!name || !name.trim()) {
    return { success: false, error: 'Name is required' };
  }
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required' };
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 2. Check for duplicates (same email + event + year for this user)
  if (eventName) {
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('email', cleanEmail)
      .eq('event_name', eventName)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Duplicate: ${cleanEmail} already has a ticket for this event` };
    }
  }

  // 3. Generate token + signature
  const token = generateToken();
  const signature = generateSignature(token);

  // 4. Build verify URL
  const verifyURL = `${env.frontendUrl}/verify?token=${token}`;

  // 5. Generate QR code
  const qrDataURL = await generateQRDataURL(verifyURL);

  // 6. Insert into database
  const { data, error } = await supabase
    .from('students')
    .insert({
      student_name: cleanName,
      email: cleanEmail,
      urn: metadata.identifier || metadata.urn || metadata.roll_no || null,
      institution_name: institutionName,
      event_name: eventName,
      year: year || null,
      batch_number: batchNumber,
      time_slot: timeSlot || null,
      token,
      signature,
      metadata,
      source,
      user_id: userId,
      email_sent: false,
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
