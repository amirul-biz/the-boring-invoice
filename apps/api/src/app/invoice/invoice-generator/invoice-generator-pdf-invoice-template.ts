import PDFDocument from 'pdfkit';
import { ProcessedInvoiceDto } from '../invoice-dto';
import { createQRCodeUtil, QRCodeUtil } from './invoice-generator-qr-code';

/**
 * Format number as currency
 */
function formatCurrency(amount: number | null | undefined, currency: string = 'RM'): string {
  if (amount === null || amount === undefined) return '';
  return `${currency} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format address from recipient DTO
 */
function formatAddress(recipient: ProcessedInvoiceDto['recipient']): string {
  const parts = [
    recipient?.addressLine1,
    recipient?.postcode,
    recipient?.city,
    recipient?.state,
    recipient?.countryCode,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  return dateString;
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
};

/**
 * Generate invoice PDF using PDFKit with QR code and payment button
 * @param invoiceData - The processed invoice data (ProcessedInvoiceDto)
 * @returns Promise<Buffer> containing the PDF data
 */
export async function generatePdfInvoiceTemplate(
  invoiceData: ProcessedInvoiceDto,
): Promise<Buffer> {
  // Generate QR code if billUrl exists
  let qrBuffer: Buffer | null = null;
  if (invoiceData.billUrl) {
    const qrCodeUtil = createQRCodeUtil();
    qrBuffer = await qrCodeUtil.generatePaymentQR(invoiceData.billUrl, 100);
  }

  return new Promise((resolve, reject) => {
    try {
      // Create PDF document (A4 size)
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `Invoice ${invoiceData.invoiceNo}`,
          Author: invoiceData.supplier?.name || '',
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
      const supplier = invoiceData.supplier;
      const recipient = invoiceData.recipient;
      const items = invoiceData.items || [];
      const totalNetAmount = invoiceData.totalNetAmount || 0;
      const totalPayableAmount = invoiceData.totalPayableAmount || 0;
      const calculatedTax = invoiceData.totalTaxAmount || 0;
      const totalDiscountAmount = invoiceData.totalDiscountAmount || 0;
      const currencyCode = invoiceData.currency || 'MYR';
      const currency = currencyCode === 'MYR' ? 'RM' : currencyCode;
      const businessName = supplier?.name || '';
      const invoiceNo = invoiceData.invoiceNo || '';
      const billUrl = invoiceData.billUrl || '';

      // ============ HEADER SECTION ============
      const headerHeight = 160;

      // Header background
      doc.rect(0, 0, pageWidth, headerHeight).fill(COLORS.primary);

      // Business name
      doc.font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(COLORS.white)
        .text(businessName, margin, 45, { width: 300 });

      // Invoice type badge
      const INVOICE_TYPE_LABEL: Record<string, string> = { INVOICE: 'Invoice', CREDIT_NOTE: 'Credit Note', DEBIT_NOTE: 'Debit Note' };
      const invoiceType = (INVOICE_TYPE_LABEL[invoiceData.invoiceType] ?? invoiceData.invoiceType).toUpperCase();
      const badgeWidth = doc.widthOfString(invoiceType) + 14;
      doc.roundedRect(margin, 70, badgeWidth, 16, 3)
        .fill('#2d4a7c');
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.white)
        .text(invoiceType, margin + 7, 74);

      // INVOICE title (right side)
      doc.font('Helvetica-Bold')
        .fontSize(26)
        .fillColor(COLORS.white)
        .text('INVOICE', pageWidth - margin - 150, 50, { width: 150, align: 'right' });

      // Invoice number
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#a0aec0')
        .text(invoiceNo, pageWidth - margin - 200, 80, { width: 200, align: 'right' });

      // Supplier info line
      doc.moveTo(margin, 110)
        .lineTo(pageWidth - margin, 110)
        .strokeColor('#2d4a7c')
        .lineWidth(0.5)
        .stroke();

      const supplierInfoParts: string[] = [];
      if (supplier?.tin) supplierInfoParts.push(`TIN: ${supplier.tin}`);
      if (supplier?.registrationNumber) supplierInfoParts.push(`SSM: ${supplier.registrationNumber}`);
      if (supplier?.msicCode) supplierInfoParts.push(`MSIC: ${supplier.msicCode}`);

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#a0aec0')
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

      // ============ META SECTION ============
      let yPos = headerHeight + 35;

      // Bill To label
      doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text('BILL TO', margin, yPos);

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

      // ============ INVOICE DETAILS BOX (Right Side) ============
      const boxWidth = 198;
      const boxHeight = 113;
      const boxX = pageWidth - margin - boxWidth;
      const boxY = headerHeight + 28;

      // Box background
      doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 8)
        .fill(COLORS.lightGray);

      let detailX = boxX + 23;
      let detailY = boxY + 20;

      // Issue Date & Due Date labels
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text('Issue Date', detailX, detailY)
        .text('Due Date', detailX + 91, detailY);

      detailY += 14;

      // Issue Date & Due Date values
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLORS.textDark)
        .text(formatDate(invoiceData.issuedDate), detailX, detailY)
        .text(formatDate(invoiceData.dueDate), detailX + 91, detailY);

      detailY += 25;

      // Divider line
      doc.moveTo(boxX + 14, detailY)
        .lineTo(boxX + boxWidth - 14, detailY)
        .strokeColor(COLORS.borderGray)
        .lineWidth(0.5)
        .stroke();

      detailY += 12;

      // Amount Due label
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(`Amount Due (${currencyCode})`, detailX, detailY);

      detailY += 17;

      // Amount Due value
      doc.font('Helvetica-Bold')
        .fontSize(15)
        .fillColor(COLORS.primary)
        .text(formatCurrency(totalPayableAmount, currency), detailX, detailY);

      // ============ ITEMS TABLE ============
      const tableTop = headerHeight + 165;
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
        .strokeColor(COLORS.primary)
        .lineWidth(2)
        .stroke();

      totalsY += 14;

      // Grand total
      doc.font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(COLORS.primary)
        .text('TOTAL:', totalsX, totalsY)
        .text(formatCurrency(totalPayableAmount, currency), totalsX + 80, totalsY, { width: 118, align: 'right' });

      // ============ PAYMENT SECTION (QR Code + Pay Button) ============
      if (billUrl) {
        const paymentSectionY = totalsY + 50;
        const paymentBoxWidth = pageWidth - 2 * margin;
        const paymentBoxHeight = 130;

        // Payment section background
        doc.roundedRect(margin, paymentSectionY, paymentBoxWidth, paymentBoxHeight, 8)
          .fill(COLORS.lightGray);

        // Section title
        doc.font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(COLORS.primary)
          .text('SCAN TO PAY', margin + 20, paymentSectionY + 15);

        // QR Code
        if (qrBuffer) {
          const qrSize = 90;
          const qrX = margin + 20;
          const qrY = paymentSectionY + 32;

          doc.image(qrBuffer, qrX, qrY, {
            width: qrSize,
            height: qrSize,
          });

          // QR code caption
          doc.font('Helvetica')
            .fontSize(7)
            .fillColor(COLORS.textMuted)
            .text('Point camera at QR code', qrX, qrY + qrSize + 4, {
              width: qrSize,
              align: 'center',
            });
        }

        // Pay Now Button (clickable)
        const buttonX = margin + 140;
        const buttonY = paymentSectionY + 45;
        const buttonWidth = 140;
        const buttonHeight = 36;

        // Button background
        doc.roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 6)
          .fill(COLORS.accent);

        // Make button clickable
        doc.link(buttonX, buttonY, buttonWidth, buttonHeight, billUrl);

        // Button text
        doc.font('Helvetica-Bold')
          .fontSize(13)
          .fillColor(COLORS.white)
          .text('Pay Now', buttonX, buttonY + 11, {
            width: buttonWidth,
            align: 'center',
          });

        // Clickable link text below button
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.accent)
          .text('Click here to pay online', buttonX, buttonY + buttonHeight + 8, {
            width: buttonWidth,
            align: 'center',
            link: billUrl,
            underline: true,
          });

        // Payment details on the right
        const detailsX = buttonX + buttonWidth + 40;
        const detailsY = paymentSectionY + 40;

        doc.font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.textMuted)
          .text('Amount Due', detailsX, detailsY);

        doc.font('Helvetica-Bold')
          .fontSize(16)
          .fillColor(COLORS.primary)
          .text(formatCurrency(totalPayableAmount, currency), detailsX, detailsY + 14);

        doc.font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.textMuted)
          .text('Due by ' + formatDate(invoiceData.dueDate), detailsX, detailsY + 38);

        // Payment methods note
        doc.font('Helvetica')
          .fontSize(7)
          .fillColor(COLORS.textMuted)
          .text('Accepts FPX & Credit/Debit Cards', detailsX, detailsY + 55);
      }

      // ============ FOOTER SECTION ============
      const footerY = pageHeight - 70;

      // Divider line
      doc.moveTo(margin, footerY)
        .lineTo(pageWidth - margin, footerY)
        .strokeColor(COLORS.borderGray)
        .lineWidth(0.5)
        .stroke();

      // Payment info
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.textDark)
        .text(`Payment is due by ${formatDate(invoiceData.dueDate)}. Please include invoice number (${invoiceNo}) in payment reference.`, margin, footerY + 10, {
          width: pageWidth - 2 * margin,
          align: 'center',
        });

      // Thank you message
      doc.font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor(COLORS.accent)
        .text('Thank you for your business!', 0, footerY + 28, { width: pageWidth, align: 'center' });

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
 * Generate invoice PDF and save to file
 * @param invoiceData - The processed invoice data (ProcessedInvoiceDto)
 * @param outputPath - Path to save the PDF file
 */
export async function generatePdfInvoiceTemplateToFile(
  invoiceData: ProcessedInvoiceDto,
  outputPath: string,
): Promise<void> {
  const fs = await import('fs').then((m) => m.promises);
  const pdfBuffer = await generatePdfInvoiceTemplate(invoiceData);
  await fs.writeFile(outputPath, pdfBuffer);
}