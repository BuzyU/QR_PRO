import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Build a ZIP file with batch-wise folders containing PDF hall tickets.
 * @param {Object[]} tickets - Array of { batchNumber, studentName, pdfBlob }
 * @param {string} eventName - Used in the ZIP file name
 * @returns {Promise<void>} - triggers download
 */
export async function buildAndDownloadZip(tickets, eventName) {
  const zip = new JSZip();

  for (const ticket of tickets) {
    const folderName = `Batch_${ticket.batchNumber}`;
    const fileName = `${ticket.studentName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.pdf`;
    zip.file(`${folderName}/${fileName}`, ticket.pdfBlob);
  }

  const content = await zip.generateAsync(
    { type: 'blob' },
    (metadata) => {
      // Progress callback — can be wired to a UI progress bar
      if (window.__zipProgress) {
        window.__zipProgress(metadata.percent);
      }
    }
  );

  const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_') || 'HallTickets';
  saveAs(content, `${safeName}_Hall_Tickets.zip`);
}

/**
 * Build and download a single batch as ZIP.
 */
export async function downloadSingleBatch(tickets, batchNumber, eventName) {
  const zip = new JSZip();
  const batchTickets = tickets.filter((t) => t.batchNumber === batchNumber);

  for (const ticket of batchTickets) {
    const fileName = `${ticket.studentName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.pdf`;
    zip.file(fileName, ticket.pdfBlob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_') || 'HallTickets';
  saveAs(content, `${safeName}_Batch_${batchNumber}.zip`);
}
