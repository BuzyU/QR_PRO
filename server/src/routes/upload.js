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
 */
router.post('/upload', uploadLimiter, firebaseAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userProfile, userId } = req;
    const { institution, event, year } = req.body;

    // Parse file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File is empty or has no data rows' });
    }

    // Get column mapping from user profile
    const mapping = userProfile.column_mapping || {};
    const nameField = mapping.name_field;
    const emailField = mapping.email_field;

    if (!nameField || !emailField) {
      return res.status(400).json({
        error: 'Column mapping not configured. Set name and email fields in your Profile first.',
        headers: Object.keys(rows[0]),
      });
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
      })
      .select('id')
      .single();

    if (batchErr) {
      return res.status(500).json({ error: 'Failed to create batch record' });
    }

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

        // Build metadata from all other columns
        const metadata = {};
        for (const [key, val] of Object.entries(row)) {
          if (key !== nameField && key !== emailField) {
            metadata[key] = val;
          }
        }

        const result = await processEntry({
          name,
          email,
          metadata,
          userId,
          source: 'upload',
          institutionName: institution || userProfile.institution_name || '',
          eventName: event || '',
          year: year || '',
        });

        if (result.success) {
          processed++;

          // Queue email if SMTP is configured
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
