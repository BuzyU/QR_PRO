import { jsPDF } from 'jspdf';

/**
 * Generate a professional hall ticket PDF for a student.
 * @param {Object} params
 * @param {string} params.studentName
 * @param {string} params.urn
 * @param {string} params.institutionName
 * @param {string} params.eventName
 * @param {string} params.year
 * @param {number} params.batchNumber
 * @param {string} params.timeSlot
 * @param {string} params.ticketId - UUID
 * @param {string} params.qrDataURL - base64 QR image
 * @returns {Blob}
 */
export function generateHallTicketPDF({
  studentName,
  urn,
  institutionName,
  eventName,
  year,
  batchNumber,
  timeSlot,
  ticketId,
  qrDataURL,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;

  // --- Ticket boundary ---
  const ticketX = 18;
  const ticketY = 18;
  const ticketW = pageW - 36;
  const ticketH = 155;

  // Outer border (double border effect)
  doc.setDrawColor(90, 80, 200);
  doc.setLineWidth(0.8);
  doc.roundedRect(ticketX, ticketY, ticketW, ticketH, 4, 4, 'S');
  doc.setDrawColor(180, 175, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(ticketX + 2, ticketY + 2, ticketW - 4, ticketH - 4, 3, 3, 'S');

  // --- Header band ---
  const headerH = 28;
  doc.setFillColor(42, 36, 120);
  doc.roundedRect(ticketX + 4, ticketY + 4, ticketW - 8, headerH, 2, 2, 'F');

  // Institution name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(institutionName.toUpperCase(), pageW / 2, ticketY + 16, { align: 'center' });

  // Event name + year
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 195, 255);
  const eventLine = year ? `${eventName} — ${year}` : eventName;
  doc.text(eventLine, pageW / 2, ticketY + 25, { align: 'center' });

  // --- "HALL TICKET" title ---
  const titleY = ticketY + headerH + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(50, 42, 140);
  doc.text('HALL TICKET', pageW / 2, titleY, { align: 'center' });

  // Decorative line under title
  const lineY = titleY + 4;
  doc.setDrawColor(108, 99, 255);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 30, lineY, pageW / 2 + 30, lineY);

  // --- Student details ---
  const detailStartY = lineY + 14;
  const labelX = ticketX + 14;
  const valueX = labelX + 48;
  const lineSpacing = 14;

  const fields = [
    { label: 'Student Name', value: studentName },
    { label: 'URN', value: urn || 'N/A' },
    { label: 'Batch', value: `Batch ${batchNumber}` },
    { label: 'Time Slot', value: timeSlot },
  ];

  fields.forEach((field, i) => {
    const y = detailStartY + i * lineSpacing;

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(120, 115, 170);
    doc.text(field.label, labelX, y);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 25, 80);
    doc.text(field.value, valueX, y);
  });

  // --- QR Code ---
  const qrSize = 42;
  const qrX = ticketX + ticketW - qrSize - 16;
  const qrY = detailStartY - 6;

  if (qrDataURL) {
    doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
  }

  // "Scan to Verify" text under QR
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 135, 180);
  doc.text('Scan to Verify', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });

  // --- Footer ---
  const footerY = ticketY + ticketH - 10;

  // Separator line
  doc.setDrawColor(210, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(ticketX + 14, footerY - 6, ticketX + ticketW - 14, footerY - 6);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(160, 155, 190);
  doc.text(
    'This is a computer-generated hall ticket. Scan the QR code for verification.',
    pageW / 2,
    footerY,
    { align: 'center' }
  );

  // Ticket ID
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 200);
  doc.text(`Ticket ID: ${ticketId}`, pageW / 2, footerY + 5, { align: 'center' });

  return doc.output('blob');
}
