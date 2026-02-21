import PDFDocument from 'pdfkit';
import { ReceiptDTO } from '../invoice-dto';
import { createQRCodeUtil } from './invoice-generator-qr-code';

/**
 * Format number as currency
 */
function formatCurrency(amount: number | null | undefined, currency: string = 'RM'): string {
  if (amount === null || amount === undefined) return '';
  return `${currency} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


/**
 * Format date for display in MYT (Malaysia Time, UTC+8)
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format datetime for display in MYT (Malaysia Time, UTC+8)
 */
function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return dateString;
  }
}

// Colors
const COLORS = {
  primary: '#1a365d',
  white: '#ffffff',
  lightGray: '#f7fafc',
  borderGray: '#e2e8f0',
  textDark: '#2d3748',
  textMuted: '#718096',
  accent: '#3182ce',
  success: '#38a169',
  successLight: '#c6f6d5',
  successDark: '#276749',
};

/**
 * Generate receipt PDF using PDFKit with same design language as invoice
 * @param receiptData - The receipt data (ReceiptDTO)
 * @returns Promise<Buffer> containing the PDF data
 */
export async function generatePdfReceiptTemplate(
  receiptData: ReceiptDTO,
): Promise<Buffer> {
  // Generate QR code if billUrl exists (for reference)
  let qrBuffer: Buffer | null = null;
  if (receiptData.billUrl) {
    const qrCodeUtil = createQRCodeUtil();
    qrBuffer = await qrCodeUtil.generatePaymentQR(receiptData.billUrl, 100);
  }

  return new Promise((resolve, reject) => {
    try {
      // Create PDF document (A4 size)
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `Receipt ${receiptData.invoiceNo}`,
          Author: receiptData.supplier?.name || '',
        },
      });

      // Collect PDF data
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const margin = 42; // ~15mm

      // Extract data
      const supplier = receiptData.supplier;
      const recipient = receiptData.recipient;
      const items = receiptData.items || [];
      const totalNetAmount = receiptData.totalNetAmount || 0;
      const totalPayableAmount = receiptData.totalPayableAmount || 0;
      const calculatedTax = receiptData.totalTaxAmount || 0;
      const totalDiscountAmount = receiptData.totalDiscountAmount || 0;
      const currencyCode = receiptData.currency || 'MYR';
      const currency = currencyCode === 'MYR' ? 'RM' : currencyCode;
      const businessName = supplier?.name || '';
      const invoiceNo = receiptData.invoiceNo || '';
      const transactionId = receiptData.transactionId || '';
      const transactionTime = receiptData.transactionTime || '';

      // ============ HEADER SECTION ============
      const headerHeight = 160;

      // Header background - using success green to indicate paid
      doc.rect(0, 0, pageWidth, headerHeight).fill(COLORS.success);

      // Business name
      doc.font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(COLORS.white)
        .text(businessName, margin, 45, { width: 300 });

      // Receipt type badge
      const receiptType = 'PAID';
      const badgeWidth = doc.widthOfString(receiptType) + 14;
      doc.roundedRect(margin, 70, badgeWidth, 16, 3)
        .fill(COLORS.successDark);
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.white)
        .text(receiptType, margin + 7, 74);

      // RECEIPT title (right side)
      doc.font('Helvetica-Bold')
        .fontSize(26)
        .fillColor(COLORS.white)
        .text('RECEIPT', pageWidth - margin - 150, 50, { width: 150, align: 'right' });

      // Invoice number
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.successLight)
        .text(invoiceNo, pageWidth - margin - 200, 80, { width: 200, align: 'right' });

      // Supplier info line
      doc.moveTo(margin, 110)
        .lineTo(pageWidth - margin, 110)
        .strokeColor(COLORS.successDark)
        .lineWidth(0.5)
        .stroke();

      const supplierInfoParts: string[] = [];
      if (supplier?.tin) supplierInfoParts.push(`TIN: ${supplier.tin}`);
      if (supplier?.registrationNumber) supplierInfoParts.push(`SSM: ${supplier.registrationNumber}`);
      if (supplier?.msicCode) supplierInfoParts.push(`MSIC: ${supplier.msicCode}`);

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.successLight)
        .text(supplierInfoParts.join('    '), margin, 118);

      // Supplier address line
      const addrParts = [
        (supplier as any)?.addressLine1,
        (supplier as any)?.postcode,
        (supplier as any)?.city,
        (supplier as any)?.state,
        (supplier as any)?.country,
      ].filter(Boolean);
      if (addrParts.length > 0) {
        doc.text(addrParts.join(', '), margin, 131);
      }

      // SST registration (conditional)
      if ((supplier as any)?.sstRegistrationNumber) {
        doc.text(`SST Reg: ${(supplier as any).sstRegistrationNumber}`, margin, 144);
      }

      // ============ TRANSACTION INFO SECTION ============
      const transactionBoxY = headerHeight + 15;
      const transactionBoxWidth = pageWidth - 2 * margin;
      const transactionBoxHeight = 50;

      // Transaction info background
      doc.roundedRect(margin, transactionBoxY, transactionBoxWidth, transactionBoxHeight, 6)
        .fill(COLORS.successLight);

      // Transaction ID
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.successDark)
        .text('Transaction ID', margin + 20, transactionBoxY + 12);

      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLORS.textDark)
        .text(transactionId, margin + 20, transactionBoxY + 24);

      // Transaction Time
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.successDark)
        .text('Payment Date & Time', margin + 250, transactionBoxY + 12);

      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLORS.textDark)
        .text(formatDateTime(transactionTime), margin + 250, transactionBoxY + 24);

      // Success checkmark icon area
      const checkX = pageWidth - margin - 60;
      const checkY = transactionBoxY + 15;
      doc.circle(checkX, checkY + 10, 15)
        .fill(COLORS.success);
      
      // Draw checkmark
      doc.strokeColor(COLORS.white)
        .lineWidth(2.5)
        .moveTo(checkX - 7, checkY + 10)
        .lineTo(checkX - 2, checkY + 15)
        .lineTo(checkX + 8, checkY + 5)
        .stroke();

      // ============ META SECTION ============
      let yPos = transactionBoxY + transactionBoxHeight + 25;

      // Bill To label
      doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text('RECEIPT FOR', margin, yPos);

      yPos += 17;

      // Recipient name
      doc.font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(COLORS.textDark)
        .text(recipient?.name || '', margin, yPos);

      yPos += 18;

      // Address - split into separate lines to avoid overlap
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.textDark);

      if (recipient?.addressLine1) {
        doc.text(recipient.addressLine1, margin, yPos);
        yPos += 14;
      }

      // City, Postcode, State, Country on one line
      const locationParts = [
        recipient?.postcode,
        recipient?.city,
        recipient?.state,
        recipient?.countryCode,
      ].filter(Boolean);
      if (locationParts.length > 0) {
        doc.text(locationParts.join(', '), margin, yPos);
        yPos += 14;
      }

      // Recipient phone
      if (recipient?.phone) {
        doc.text(`Tel: ${recipient.phone}`, margin, yPos);
        yPos += 14;
      }

      // Recipient email
      if (recipient?.email) {
        doc.text(recipient.email, margin, yPos);
        yPos += 14;
      }

      // Recipient TIN and Registration
      yPos += 6;
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textMuted);

      if (recipient?.tin) {
        doc.text(`TIN: ${recipient.tin}`, margin, yPos);
        yPos += 12;
      }

      if (recipient?.registrationNumber) {
        const idLabel = (recipient as any)?.idType ?? 'ID/Reg No';
        doc.text(`${idLabel}: ${recipient.registrationNumber}`, margin, yPos);
      }

      // ============ PAYMENT DETAILS BOX (Right Side) ============
      const boxWidth = 198;
      const boxHeight = 130;
      const boxX = pageWidth - margin - boxWidth;
      const boxY = transactionBoxY + transactionBoxHeight + 18;

      // Box background
      doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 8)
        .fill(COLORS.lightGray);

      let detailX = boxX + 23;
      let detailY = boxY + 18;

      // Issue Date & Payment Date labels
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text('Issue Date', detailX, detailY)
        .text('Payment Date', detailX + 91, detailY);

      detailY += 14;

      // Issue Date & Payment Date values
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLORS.textDark)
        .text(formatDate(receiptData.issuedDate), detailX, detailY)
        .text(formatDate(transactionTime), detailX + 91, detailY);

      detailY += 25;

      // Divider line
      doc.moveTo(boxX + 14, detailY)
        .lineTo(boxX + boxWidth - 14, detailY)
        .strokeColor(COLORS.borderGray)
        .lineWidth(0.5)
        .stroke();

      detailY += 12;

      // Amount Paid label
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(`Amount Paid (${currencyCode})`, detailX, detailY);

      detailY += 17;

      // Amount Paid value
      doc.font('Helvetica-Bold')
        .fontSize(15)
        .fillColor(COLORS.success)
        .text(formatCurrency(totalPayableAmount, currency), detailX, detailY);

      detailY += 22;

      // Payment Status badge
      const statusBadgeWidth = 60;
      doc.roundedRect(detailX, detailY, statusBadgeWidth, 18, 4)
        .fill(COLORS.success);
      doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.white)
        .text('PAID', detailX, detailY + 5, { width: statusBadgeWidth, align: 'center' });

      // ============ ITEMS TABLE ============
      const tableTop = transactionBoxY + transactionBoxHeight + 155;
      const tableWidth = pageWidth - 2 * margin;

      // Column positions
      const colDesc = margin + 8;
      const colCode = margin + 220;
      const colQty = margin + 285;
      const colUnit = margin + 350;
      const colAmount = pageWidth - margin - 8;

      // Table header background
      doc.rect(margin, tableTop, tableWidth, 28)
        .fill(COLORS.primary);

      // Table header text
      doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.white);

      const headerY = tableTop + 10;
      doc.text('DESCRIPTION', colDesc, headerY);
      doc.text('CODE', colCode, headerY, { width: 50, align: 'center' });
      doc.text('QTY', colQty, headerY, { width: 40, align: 'center' });
      doc.text('UNIT PRICE', colUnit, headerY, { width: 70, align: 'right' });
      doc.text('AMOUNT', colAmount - 60, headerY, { width: 60, align: 'right' });

      // Table rows
      let rowY = tableTop + 28;
      const rowHeight = 56;

      items.forEach((item, index) => {
        // Alternating row background
        if (index % 2 === 0) {
          doc.rect(margin, rowY, tableWidth, rowHeight)
            .fill(COLORS.lightGray);
        }

        const textY = rowY + 7;

        // Item name
        doc.font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.textDark);

        let itemName = item.itemName || '';
        const maxWidth = 200;
        if (doc.widthOfString(itemName) > maxWidth) {
          while (doc.widthOfString(itemName + '...') > maxWidth && itemName.length > 0) {
            itemName = itemName.slice(0, -1);
          }
          itemName += '...';
        }
        doc.text(itemName, colDesc, textY);

        // Code
        doc.text(item.classificationCode || '', colCode, textY, { width: 50, align: 'center' });

        // Quantity
        doc.text(String(item.quantity || 0), colQty, textY, { width: 40, align: 'center' });

        // Unit price
        doc.text(formatCurrency(item.unitPrice, currency), colUnit, textY, { width: 70, align: 'right' });

        // Line subtotal (before discount, excl. tax)
        const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
        doc.font('Helvetica-Bold')
          .text(formatCurrency(subtotal, currency), colAmount - 60, textY, { width: 60, align: 'right' });

        // Second line: discount info
        const discountY = rowY + 22;
        const discountRate = (item as any).discountRate ?? 0;
        const discountAmount = (item as any).discountAmount ?? parseFloat((subtotal * discountRate / 100).toFixed(2));
        const discountText = discountRate > 0
          ? `Discount: ${discountRate.toFixed(2)}%  \u2212${formatCurrency(discountAmount, currency)}`
          : 'Discount: \u2014';

        doc.font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.textMuted)
          .text(discountText, colDesc, discountY);

        // Third line: per-item tax info
        const taxY = rowY + 37;
        const taxRate = item.taxRate || 0;
        const taxableAmount = (item as any).taxableAmount ?? parseFloat((subtotal - discountAmount).toFixed(2));
        const taxAmount = (item as any).taxAmount ?? parseFloat((taxableAmount * taxRate / 100).toFixed(2));
        const taxTypeLabel = item.taxType === 'NOT_APPLICABLE'
          ? `No Tax (0%)`
          : `${item.taxType.replace(/_/g, ' ')} (${taxRate}%)`;

        doc.font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.textMuted)
          .text(taxTypeLabel, colDesc, taxY)
          .text(taxAmount > 0 ? formatCurrency(taxAmount, currency) : '-', colAmount - 60, taxY, { width: 60, align: 'right' });

        rowY += rowHeight;
      });

      // Table bottom line
      doc.moveTo(margin, rowY)
        .lineTo(pageWidth - margin, rowY)
        .strokeColor(COLORS.borderGray)
        .lineWidth(1)
        .stroke();

      // ============ TOTALS SECTION ============
      const totalsX = pageWidth - margin - 198;
      let totalsY = rowY + 23;

      // Net Amount
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor(COLORS.textDark)
        .text('Net Amount:', totalsX, totalsY)
        .text(formatCurrency(totalNetAmount, currency), totalsX + 80, totalsY, { width: 118, align: 'right' });

      totalsY += 17;

      // Total Discount (only shown when > 0)
      if (totalDiscountAmount > 0) {
        doc.text('Total Discount:', totalsX, totalsY)
          .text(`\u2212${formatCurrency(totalDiscountAmount, currency)}`, totalsX + 80, totalsY, { width: 118, align: 'right' });
        totalsY += 17;
      }

      // Tax
      doc.text(`Total Tax:`, totalsX, totalsY)
        .text(formatCurrency(calculatedTax, currency), totalsX + 80, totalsY, { width: 118, align: 'right' });

      totalsY += 23;

      // Total line
      doc.moveTo(totalsX, totalsY)
        .lineTo(pageWidth - margin, totalsY)
        .strokeColor(COLORS.success)
        .lineWidth(2)
        .stroke();

      totalsY += 14;

      // Grand total
      doc.font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(COLORS.success)
        .text('TOTAL PAID:', totalsX, totalsY)
        .text(formatCurrency(totalPayableAmount, currency), totalsX + 80, totalsY, { width: 118, align: 'right' });

      // ============ PAYMENT CONFIRMATION SECTION ============
      const confirmSectionY = totalsY + 50;
      const confirmBoxWidth = pageWidth - 2 * margin;
      const confirmBoxHeight = 80;

      // Confirmation section background
      doc.roundedRect(margin, confirmSectionY, confirmBoxWidth, confirmBoxHeight, 8)
        .fill(COLORS.successLight);

      // Confirmation title
      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLORS.successDark)
        .text('PAYMENT CONFIRMED', margin + 20, confirmSectionY + 15);

      // Payment method info
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textDark)
        .text(`Transaction Reference: ${transactionId}`, margin + 20, confirmSectionY + 35)
        .text(`Payment Method: Online Payment (FPX / Credit Card)`, margin + 20, confirmSectionY + 50)
        .text(`Processed On: ${formatDateTime(transactionTime)}`, margin + 20, confirmSectionY + 65);

      // QR Code on the right (for reference)
      if (qrBuffer) {
        const qrSize = 60;
        const qrX = pageWidth - margin - qrSize - 20;
        const qrY = confirmSectionY + 10;

        doc.image(qrBuffer, qrX, qrY, {
          width: qrSize,
          height: qrSize,
        });
      }

      // ============ FOOTER SECTION ============
      const footerY = pageHeight - 70;

      // Divider line
      doc.moveTo(margin, footerY)
        .lineTo(pageWidth - margin, footerY)
        .strokeColor(COLORS.borderGray)
        .lineWidth(0.5)
        .stroke();

      // Receipt note
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.textDark)
        .text(`This is an official receipt for Invoice ${invoiceNo}. Please keep this for your records.`, margin, footerY + 10, {
          width: pageWidth - 2 * margin,
          align: 'center',
        });

      // Thank you message
      doc.font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor(COLORS.success)
        .text('Thank you for your payment!', 0, footerY + 28, { width: pageWidth, align: 'center' });

      // Generated timestamp
      doc.font('Helvetica')
        .fontSize(7)
        .fillColor(COLORS.textMuted)
        .text(
          `Generated on ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | LHDN e-Invoice Compliant`,
          0,
          footerY + 45,
          { width: pageWidth, align: 'center' }
        );

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate receipt PDF and save to file
 * @param receiptData - The receipt data (ReceiptDTO)
 * @param outputPath - Path to save the PDF file
 */
export async function generatePdfReceiptTemplateToFile(
  receiptData: ReceiptDTO,
  outputPath: string,
): Promise<void> {
  const fs = await import('fs').then((m) => m.promises);
  const pdfBuffer = await generatePdfReceiptTemplate(receiptData);
  await fs.writeFile(outputPath, pdfBuffer);
}