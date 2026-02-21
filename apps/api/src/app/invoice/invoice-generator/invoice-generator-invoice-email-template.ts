import { MailerService } from '@nestjs-modules/mailer';
import { ProcessedInvoiceDto } from '../invoice-dto';

const INVOICE_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE: 'Debit Note',
};

function generateInvoiceEmailHtml(invoice: ProcessedInvoiceDto): string {
  const formatCurrency = (amount: number) =>
    `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemsHtml = invoice.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151;">${item.itemName}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right; font-weight: 600;">${formatCurrency(item.quantity * item.unitPrice)}</td>
      </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNo}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${invoice.supplier.name}</h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">${invoice.supplier.businessActivityDescription}</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${INVOICE_TYPE_LABEL[invoice.invoiceType] ?? invoice.invoiceType}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">Dear <strong>${invoice.recipient.name}</strong>,</p>
              <p style="margin: 16px 0 0; color: #6b7280; font-size: 15px; line-height: 1.6;">Thank you for your continued support. Please find your invoice details below. A PDF copy is attached for your records.</p>
            </td>
          </tr>

          <!-- Invoice Summary Card -->
          <tr>
            <td style="padding: 24px 40px;">
              <table role="presentation" style="width: 100%; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 50%;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</p>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 15px; font-weight: 600;">${invoice.invoiceNo}</p>
                          ${invoice.originalInvoiceRef ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Ref: ${invoice.originalInvoiceRef}</p>` : ''}
                        </td>
                        <td style="width: 50%; text-align: right;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Due</p>
                          <p style="margin: 4px 0 0; color: #2563eb; font-size: 24px; font-weight: 700;">${formatCurrency(invoice.totalPayableAmount)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 16px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="width: 33%;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Issue Date</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px;">${invoice.issuedDate.split('T')[0]}</p>
                              </td>
                              <td style="width: 33%; text-align: center;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Due Date</p>
                                <p style="margin: 4px 0 0; color: #dc2626; font-size: 14px; font-weight: 600;">${invoice.dueDate}</p>
                              </td>
                              <td style="width: 33%; text-align: right;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Currency</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px;">${invoice.currency}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th style="padding: 12px 16px; text-align: left; color: #475569; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                    <th style="padding: 12px 16px; text-align: center; color: #475569; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                    <th style="padding: 12px 16px; text-align: right; color: #475569; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
                    <th style="padding: 12px 16px; text-align: right; color: #475569; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>

              <!-- Totals -->
              <table role="presentation" style="width: 100%; margin-top: 16px;">
                <tr>
                  <td style="width: 60%;"></td>
                  <td style="width: 40%;">
                    <table role="presentation" style="width: 100%;">
                      ${invoice.totalDiscountAmount > 0 ? `<tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right;">${formatCurrency(invoice.totalNetAmount + invoice.totalDiscountAmount)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Discount</td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right;">\u2212${formatCurrency(invoice.totalDiscountAmount)}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Net Amount</td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right;">${formatCurrency(invoice.totalNetAmount)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Tax</td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right;">${formatCurrency(invoice.totalTaxAmount)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 2px solid #e5e7eb;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #1e293b; font-size: 16px; font-weight: 700;">Total</td>
                        <td style="padding: 12px 0; color: #2563eb; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrency(invoice.totalPayableAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="${invoice.billUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">Pay Now</a>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 13px;">Accepts FPX & Credit/Debit Cards</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc;">
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                <strong style="color: #475569;">${invoice.supplier.name}</strong><br>
                TIN: ${invoice.supplier.tin} | SSM: ${invoice.supplier.registrationNumber} | MSIC: ${invoice.supplier.msicCode}
              </p>
            </td>
          </tr>

          <!-- Legal Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #1e3a5f;">
              <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px; text-align: center; line-height: 1.6;">
                Please include invoice number <strong style="color: #ffffff;">${invoice.invoiceNo}</strong> in your payment reference.<br>
                For questions, contact us at <a href="mailto:${invoice.supplier.email}" style="color: #93c5fd; text-decoration: none;">${invoice.supplier.email}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function generateInvoiceEmailText(invoice: ProcessedInvoiceDto): string {
  const formatCurrency = (amount: number) =>
    `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemsList = invoice.items
    .map((item) => `  • ${item.itemName} (x${item.quantity}) - ${formatCurrency(item.unitPrice * item.quantity)}`)
    .join('\n');

  return `
${invoice.supplier.name}
${invoice.supplier.businessActivityDescription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dear ${invoice.recipient.name},

Thank you for your continued support. Please find your invoice details below.

INVOICE DETAILS
───────────────
Invoice No: ${invoice.invoiceNo}
${invoice.originalInvoiceRef ? `Original Invoice Ref: ${invoice.originalInvoiceRef}\n` : ''}Issue Date: ${invoice.issuedDate.split('T')[0]}
Due Date: ${invoice.dueDate}

ITEMS
───────────────
${itemsList}

SUMMARY
───────────────
${invoice.totalDiscountAmount > 0 ? `Subtotal: ${formatCurrency(invoice.totalNetAmount + invoice.totalDiscountAmount)}\nTotal Discount: -${formatCurrency(invoice.totalDiscountAmount)}\n` : ''}Net Amount: ${formatCurrency(invoice.totalNetAmount)}
Total Tax: ${formatCurrency(invoice.totalTaxAmount)}
━━━━━━━━━━━━━━━
TOTAL: ${formatCurrency(invoice.totalPayableAmount)}

PAY NOW
───────────────
${invoice.billUrl}

Accepts FPX & Credit/Debit Cards

───────────────────────────────────────
${invoice.supplier.name}
TIN: ${invoice.supplier.tin} | SSM: ${invoice.supplier.registrationNumber} | MSIC: ${invoice.supplier.msicCode}

Please include invoice number ${invoice.invoiceNo} in your payment reference.
For questions, contact us at ${invoice.supplier.email}
`.trim();
}

export async function generateInvoiceEmailTemplate(
  mailService: MailerService,
  invoice: ProcessedInvoiceDto,
  pdfBuffer: Buffer,
): Promise<{ status: string; message: string }> {
  await mailService.sendMail({
    to: invoice.recipient.email,
    cc: invoice.supplier.email,
    subject: `Invoice ${invoice.invoiceNo} from ${invoice.supplier.name}`,
    text: generateInvoiceEmailText(invoice),
    html: generateInvoiceEmailHtml(invoice),
    attachments: [
      {
        filename: `${invoice.invoiceNo}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return { status: 'Success', message: 'Invoice email sent' };
}