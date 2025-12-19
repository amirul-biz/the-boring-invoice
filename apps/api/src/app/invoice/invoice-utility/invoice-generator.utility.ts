import puppeteer from 'puppeteer-core';
import { CreateInvoiceOutputDTO } from '../invoice-dto';

/**
 * Get browser executable path based on environment
 */
async function getBrowser() {
  // Check if running in serverless environment (Vercel, AWS Lambda)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    // Use @sparticuz/chromium for serverless
    const chromium = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath,
      headless: chromium.default.headless,
    });
  } else {
    // Local development - use installed Chrome
    const executablePath = 
      process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome';

    return puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
}

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
function formatAddress(recipient: CreateInvoiceOutputDTO['recipient']): string {
  const parts = [
    recipient.addressLine1,
    recipient.postcode,
    recipient.city,
    recipient.state,
    recipient.countryCode,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  // Handle ISO datetime format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toISOString().split('T')[0];
}

/**
 * Generate invoice HTML template
 */
function generateInvoiceHTML(invoice: CreateInvoiceOutputDTO): string {
  // Calculate tax amount from taxRate and totalExcludingTax
  const taxRate = invoice.taxRate || 0;
  const totalExcludingTax = invoice.totalExcludingTax || 0;
  const calculatedTaxAmount = (totalExcludingTax * taxRate) / 100;
  const currency = invoice.currency === 'MYR' ? 'RM' : invoice.currency;
  const businessName = invoice.supplier?.name || '';

  const itemsHTML = invoice.items
    .map((item, index) => {
      const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
      return `
        <tr class="${index % 2 === 0 ? 'row-even' : ''}">
          <td class="desc">${item.itemName || ''}</td>
          <td class="center">${item.classificationCode || ''}</td>
          <td class="center">${item.quantity || 0}</td>
          <td class="right">${formatCurrency(item.unitPrice, currency)}</td>
          <td class="right bold">${formatCurrency(lineTotal, currency)}</td>
        </tr>
      `;
    })
    .join('');

  const recipientAddress = formatAddress(invoice.recipient);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 0;
    }
    
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10px;
      color: #2d3748;
      background: white;
      width: 210mm;
      min-height: 297mm;
    }
    
    .invoice-container {
      width: 210mm;
      min-height: 297mm;
      padding: 0;
      position: relative;
    }
    
    /* Header */
    .header {
      background: #1a365d;
      color: white;
      padding: 12mm 15mm 10mm 15mm;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .header-left {
      flex: 1;
    }
    
    .business-name {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .invoice-type-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .header-right {
      text-align: right;
    }
    
    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 2px;
    }
    
    .invoice-number-header {
      font-size: 11px;
      color: #a0aec0;
      margin-top: 5px;
    }
    
    .supplier-info {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.2);
      font-size: 9px;
      color: #a0aec0;
    }
    
    .supplier-info span {
      margin-right: 15px;
    }
    
    /* Content */
    .content {
      padding: 12mm 15mm;
    }
    
    .meta-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15mm;
    }
    
    .bill-to {
      flex: 1;
      max-width: 55%;
    }
    
    .section-label {
      font-size: 9px;
      font-weight: bold;
      color: #718096;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    
    .recipient-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .recipient-detail {
      font-size: 10px;
      margin-bottom: 3px;
      color: #2d3748;
    }
    
    .recipient-tax-info {
      font-size: 9px;
      color: #718096;
      margin-top: 8px;
    }
    
    .recipient-tax-info div {
      margin-bottom: 2px;
    }
    
    .invoice-details-box {
      background: #f7fafc;
      border-radius: 6px;
      padding: 12px 15px;
      width: 70mm;
    }
    
    .details-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .details-col {
      flex: 1;
    }
    
    .details-label {
      font-size: 9px;
      color: #718096;
      margin-bottom: 3px;
    }
    
    .details-value {
      font-size: 11px;
      font-weight: bold;
      color: #2d3748;
    }
    
    .amount-due-section {
      margin-top: 5px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
    
    .amount-due-value {
      font-size: 18px;
      font-weight: bold;
      color: #1a365d;
    }
    
    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8mm;
    }
    
    .items-table thead {
      background: #1a365d;
      color: white;
    }
    
    .items-table th {
      padding: 10px 8px;
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .items-table th.desc { text-align: left; width: 40%; }
    .items-table th.code { text-align: center; width: 12%; }
    .items-table th.qty { text-align: center; width: 10%; }
    .items-table th.unit { text-align: right; width: 18%; }
    .items-table th.amount { text-align: right; width: 20%; }
    
    .items-table td {
      padding: 10px 8px;
      font-size: 9px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .items-table tr.row-even {
      background: #f7fafc;
    }
    
    .items-table td.desc { text-align: left; }
    .items-table td.center { text-align: center; }
    .items-table td.right { text-align: right; }
    .items-table td.bold { font-weight: bold; }
    
    /* Totals */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 5mm;
    }
    
    .totals-box {
      width: 70mm;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 10px;
    }
    
    .totals-row.grand-total {
      border-top: 2px solid #1a365d;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 14px;
      font-weight: bold;
      color: #1a365d;
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 0 15mm 10mm 15mm;
    }
    
    .footer-divider {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      margin-bottom: 10px;
    }
    
    .payment-info-title {
      font-size: 9px;
      font-weight: bold;
      color: #718096;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    
    .payment-info-text {
      font-size: 9px;
      color: #2d3748;
      margin-bottom: 3px;
    }
    
    .thank-you {
      text-align: center;
      font-size: 10px;
      font-style: italic;
      color: #3182ce;
      margin-top: 15px;
    }
    
    .generated-at {
      text-align: center;
      font-size: 7px;
      color: #718096;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="header-top">
        <div class="header-left">
          <div class="business-name">${businessName}</div>
          <div class="invoice-type-badge">${invoice.invoiceType || 'Invoice'}</div>
        </div>
        <div class="header-right">
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-number-header">${invoice.invoiceNo || ''}</div>
        </div>
      </div>
      <div class="supplier-info">
        ${invoice.supplier?.tin ? `<span>TIN: ${invoice.supplier.tin}</span>` : ''}
        ${invoice.supplier?.registrationNumber ? `<span>SSM: ${invoice.supplier.registrationNumber}</span>` : ''}
        ${invoice.supplier?.msicCode ? `<span>MSIC: ${invoice.supplier.msicCode}</span>` : ''}
      </div>
    </div>
    
    <!-- Content -->
    <div class="content">
      <!-- Meta Section -->
      <div class="meta-section">
        <div class="bill-to">
          <div class="section-label">Bill To</div>
          <div class="recipient-name">${invoice.recipient?.name || ''}</div>
          ${recipientAddress ? `<div class="recipient-detail">${recipientAddress}</div>` : ''}
          ${invoice.recipient?.phone ? `<div class="recipient-detail">Tel: ${invoice.recipient.phone}</div>` : ''}
          ${invoice.recipient?.email ? `<div class="recipient-detail">${invoice.recipient.email}</div>` : ''}
          <div class="recipient-tax-info">
            ${invoice.recipient?.tin ? `<div>TIN: ${invoice.recipient.tin}</div>` : ''}
            ${invoice.recipient?.registrationNumber ? `<div>ID/Reg No: ${invoice.recipient.registrationNumber}</div>` : ''}
          </div>
        </div>
        
        <div class="invoice-details-box">
          <div class="details-row">
            <div class="details-col">
              <div class="details-label">Issue Date</div>
              <div class="details-value">${formatDate(invoice.issuedDate)}</div>
            </div>
            <div class="details-col">
              <div class="details-label">Due Date</div>
              <div class="details-value">${formatDate(invoice.dueDate)}</div>
            </div>
          </div>
          <div class="amount-due-section">
            <div class="details-label">Amount Due (${invoice.currency || 'MYR'})</div>
            <div class="amount-due-value">${formatCurrency(invoice.totalIncludingTax, currency)}</div>
          </div>
        </div>
      </div>
      
      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="desc">Description</th>
            <th class="code">Code</th>
            <th class="qty">Qty</th>
            <th class="unit">Unit Price</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <!-- Totals -->
      <div class="totals-section">
        <div class="totals-box">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(invoice.totalExcludingTax, currency)}</span>
          </div>
          <div class="totals-row">
            <span>Tax (${taxRate}%):</span>
            <span>${formatCurrency(calculatedTaxAmount, currency)}</span>
          </div>
          <div class="totals-row grand-total">
            <span>TOTAL:</span>
            <span>${formatCurrency(invoice.totalIncludingTax, currency)}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-divider">
        <div class="payment-info-title">Payment Information</div>
        <div class="payment-info-text">Payment is due by ${formatDate(invoice.dueDate)}.</div>
        <div class="payment-info-text">Please include invoice number (${invoice.invoiceNo || ''}) in payment reference.</div>
      </div>
      <div class="thank-you">Thank you for your business!</div>
      <div class="generated-at">Generated on ${new Date().toISOString().replace('T', ' ').substring(0, 19)}</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate invoice PDF using Puppeteer
 * @param invoiceData - The invoice data (CreateInvoiceOutputDTO)
 * @returns Buffer containing the PDF data
 */
export async function generateInvoice(
  invoiceData: CreateInvoiceOutputDTO,
): Promise<Buffer> {
  let browser = null;

  try {
    // Get browser instance (handles both local and serverless)
    browser = await getBrowser();

    const page = await browser.newPage();

    // Generate HTML content
    const htmlContent = generateInvoiceHTML(invoiceData);

    // Set the HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF with A4 size
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate invoice PDF and save to file
 * @param invoiceData - The invoice data (CreateInvoiceOutputDTO)
 * @param outputPath - Path to save the PDF file
 */
export async function generateInvoiceToFile(
  invoiceData: CreateInvoiceOutputDTO,
  outputPath: string,
): Promise<void> {
  const fs = await import('fs').then((m) => m.promises);
  const pdfBuffer = await generateInvoice(invoiceData);
  await fs.writeFile(outputPath, pdfBuffer);
}