import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { firebaseAuth } from '../middleware/firebaseAuth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { processEntry } from '../services/ticketService.js';
import { addJob } from '../services/queueService.js';
import { supabase } from '../config/supabase.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /api/upload
 * Server-side file upload for automated processing.
 * Auth: Firebase token.
 *
 * Requires `eventId` in the body — uses event's column mapping and custom fields.
 */
router.post('/upload', uploadLimiter, firebaseAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userProfile, userId } = req;
    const { eventId } = req.body;

    // Event ID is required
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required — tickets must belong to an event' });
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

    // Column mapping from event config
    const mapping = event.column_mapping || {};
    const nameField = mapping.name_field;
    const emailField = mapping.email_field;

    if (!nameField || !emailField) {
      return res.status(400).json({
        error: 'Column mapping not configured for this event. Go to the event page and set Name and Email columns first.',
      });
    }

    // Parse file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File is empty or has no data rows' });
    }

    // Validate that mapped columns exist in the file
    const headers = Object.keys(rows[0]);
    if (!headers.includes(nameField)) {
      return res.status(400).json({
        error: `Mapped name column '${nameField}' not found. Available: ${headers.join(', ')}`,
      });
    }
    if (!headers.includes(emailField)) {
      return res.status(400).json({
        error: `Mapped email column '${emailField}' not found. Available: ${headers.join(', ')}`,
      });
    }

    // Create upload batch record
    const { data: batch, error: batchErr } = await supabase
      .from('upload_batches')
      .insert({
        filename: req.file.originalname,
        total_records: rows.length,
        status: 'processing',
        created_by: userId,
        event_id: eventId,
      })
      .select('id')
      .single();

    if (batchErr) {
      return res.status(500).json({ error: 'Failed to create batch record' });
    }

    // Get field map from event config
    const fieldMap = mapping.field_map || {};
    const customFields = event.custom_fields || [];

    // Process rows asynchronously
    let processed = 0;
    let failed = 0;

    // Process in background — return immediately
    (async () => {
      for (const row of rows) {
        const name = String(row[nameField] || '').trim();
        const email = String(row[emailField] || '').trim();

        if (!name || !email) {
          failed++;
          continue;
        }

        // Build metadata from custom fields using field_map
        const metadata = {};
        for (const field of customFields) {
          const columnName = fieldMap[field.key] || field.key;
          const value = row[columnName] ?? row[field.key] ?? '';
          metadata[field.key] = String(value);
        }

        const result = await processEntry({
          name,
          email,
          metadata,
          userId,
          eventId,
          source: 'upload',
        });

        if (result.success) {
          processed++;

          // Queue email if configured
          if (userProfile.smtp_config || userProfile.gmail_tokens) {
            const visibleFields = customFields.filter((f) => f.in_email);
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
        } else {
          failed++;
          console.warn(`[Upload] Row skipped: ${result.error}`);
        }

        // Update batch progress every 10 rows
        if ((processed + failed) % 10 === 0) {
          await supabase
            .from('upload_batches')
            .update({ processed, failed })
            .eq('id', batch.id);
        }
      }

      // Finalize batch
      await supabase
        .from('upload_batches')
        .update({
          processed,
          failed,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', batch.id);

      console.log(`[Upload] Batch ${batch.id}: ${processed} processed, ${failed} failed`);
    })();

    // Return immediately
    res.json({
      success: true,
      batchId: batch.id,
      totalRecords: rows.length,
      message: 'Processing started. Check batch status for progress.',
    });
  } catch (err) {
    console.error('[POST /api/upload] Error:', err.message);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

export default router;
