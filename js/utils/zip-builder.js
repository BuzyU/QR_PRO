import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Sanitize a string for use as a file/folder name.
 * Preserves Unicode letters (Hindi, Arabic, CJK, etc.) and digits.
 * Strips only characters unsafe for file systems.
 */
function sanitizeForFilename(str) {
  // Remove characters not allowed in file names across OS
  // Keep: Unicode letters, digits, spaces, hyphens, underscores
  let safe = str.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim();
  // Collapse consecutive whitespace into a single underscore
  safe = safe.replace(/\s+/g, '_');
  // If sanitization left nothing, use a fallback
  return safe || 'unnamed';
}

/**
 * Build a ZIP file with batch-wise folders containing PDF hall tickets.
 * @param {Object[]} tickets - Array of { batchNumber, studentName, pdfBlob }
 * @param {string} eventName - Used in the ZIP file name
 * @returns {Promise<void>} - triggers download
 */
export async function buildAndDownloadZip(tickets, eventName) {
  const zip = new JSZip();
  const usedPaths = new Map(); // track duplicates per folder

  for (const ticket of tickets) {
    let folderName = `Batch_${ticket.batchNumber}`;
    if (ticket.sourceFilename) {
      folderName = sanitizeForFilename(ticket.sourceFilename.replace(/\.[^/.]+$/, ''));
    }

    let baseName = sanitizeForFilename(ticket.studentName);
    const folderKey = folderName;
    const countMap = usedPaths.get(folderKey) || new Map();
    const count = countMap.get(baseName) || 0;
    countMap.set(baseName, count + 1);
    usedPaths.set(folderKey, countMap);

    // Append counter for duplicates (e.g. Rahul_Sharma_2.pdf)
    const fileName = count > 0 ? `${baseName}_${count + 1}.pdf` : `${baseName}.pdf`;
    zip.file(`${folderName}/${fileName}`, ticket.pdfBlob);
  }

  const content = await zip.generateAsync(
    { type: 'blob' },
    (metadata) => {
      if (window.__zipProgress) {
        window.__zipProgress(metadata.percent);
      }
    }
  );

  const safeName = sanitizeForFilename(eventName) || 'HallTickets';
  saveAs(content, `${safeName}_Hall_Tickets.zip`);
}

/**
 * Build and download a single batch as ZIP.
 */
export async function downloadSingleBatch(tickets, batchNumber, eventName) {
  const zip = new JSZip();
  const batchTickets = tickets.filter((t) => t.batchNumber === batchNumber);
  const nameCount = new Map();

  for (const ticket of batchTickets) {
    let baseName = sanitizeForFilename(ticket.studentName);
    const count = nameCount.get(baseName) || 0;
    nameCount.set(baseName, count + 1);
    const fileName = count > 0 ? `${baseName}_${count + 1}.pdf` : `${baseName}.pdf`;
    zip.file(fileName, ticket.pdfBlob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const safeName = sanitizeForFilename(eventName) || 'HallTickets';

  let zipName = `${safeName}_Batch_${batchNumber}.zip`;
  if (batchTickets[0] && batchTickets[0].sourceFilename) {
    const baseStr = sanitizeForFilename(batchTickets[0].sourceFilename.replace(/\.[^/.]+$/, ''));
    zipName = `${safeName}_${baseStr}.zip`;
  }

  saveAs(content, zipName);
}
