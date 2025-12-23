import { MailerService } from '@nestjs-modules/mailer';
import { ReceiptDTO } from '../invoice-dto';

function generateReceiptEmailHtml(receipt: ReceiptDTO): string {
  const formatCurrency = (amount: number) =>
    `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const itemsHtml = receipt.items
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

  const taxAmount = receipt.totalIncludingTax - receipt.totalExcludingTax;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${receipt.invoiceNo}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #065f46 0%, #059669 100%); padding: 32px 40px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${receipt.supplier.name}</h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">${receipt.supplier.businessActivityDescription}</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Payment Receipt</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Payment Success Banner -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <table role="presentation" style="width: 100%; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 8px; border: 1px solid #a7f3d0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="display: inline-block; width: 48px; height: 48px; background-color: #059669; border-radius: 50%; line-height: 48px; margin-bottom: 12px;">
                      <span style="color: #ffffff; font-size: 24px;">✓</span>
                    </div>
                    <h2 style="margin: 0; color: #065f46; font-size: 20px; font-weight: 700;">Payment Successful</h2>
                    <p style="margin: 8px 0 0; color: #047857; font-size: 14px;">Thank you for your payment</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">Dear <strong>${receipt.recipient.name}</strong>,</p>
              <p style="margin: 16px 0 0; color: #6b7280; font-size: 15px; line-height: 1.6;">We have received your payment. Below are the details of your transaction. A PDF copy of this receipt is attached for your records.</p>
            </td>
          </tr>

          <!-- Transaction Details Card -->
          <tr>
            <td style="padding: 24px 40px;">
              <table role="presentation" style="width: 100%; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 50%;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Receipt Number</p>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 15px; font-weight: 600;">${receipt.invoiceNo}</p>
                        </td>
                        <td style="width: 50%; text-align: right;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</p>
                          <p style="margin: 4px 0 0; color: #059669; font-size: 24px; font-weight: 700;">${formatCurrency(receipt.totalIncludingTax)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 20px; border-top: 1px dashed #cbd5e1; margin-top: 16px;">
                          <table role="presentation" style="width: 100%; margin-top: 16px;">
                            <tr>
                              <td style="width: 50%;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Transaction ID</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px; font-family: 'Courier New', monospace;">${receipt.transactionId}</p>
                              </td>
                              <td style="width: 50%; text-align: right;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Payment Date & Time</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px;">${formatDateTime(receipt.transactionTime)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 16px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="width: 33%;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Date</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px;">${receipt.issuedDate.split('T')[0]}</p>
                              </td>
                              <td style="width: 33%; text-align: center;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Status</p>
                                <p style="margin: 4px 0 0; color: #059669; font-size: 14px; font-weight: 600;">✓ Paid</p>
                              </td>
                              <td style="width: 33%; text-align: right;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Currency</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px;">${receipt.currency}</p>
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
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right;">${formatCurrency(receipt.totalExcludingTax)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tax (${receipt.taxRate}%)</td>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right;">${formatCurrency(taxAmount)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 2px solid #e5e7eb;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; color: #1e293b; font-size: 16px; font-weight: 700;">Total Paid</td>
                        <td style="padding: 12px 0; color: #059669; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrency(receipt.totalIncludingTax)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Download Receipt Button -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">Keep this receipt for your records</p>
              <a href="${receipt.billUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4);">View Transaction</a>
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
                <strong style="color: #475569;">${receipt.supplier.name}</strong><br>
                TIN: ${receipt.supplier.tin} | SSM: ${receipt.supplier.registrationNumber} | MSIC: ${receipt.supplier.msicCode}
              </p>
            </td>
          </tr>

          <!-- Legal Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #065f46;">
              <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px; text-align: center; line-height: 1.6;">
                This is an official payment receipt for transaction <strong style="color: #ffffff;">${receipt.transactionId}</strong><br>
                For questions, contact us at <a href="mailto:${receipt.supplier.email}" style="color: #6ee7b7; text-decoration: none;">${receipt.supplier.email}</a>
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

function generateReceiptEmailText(receipt: ReceiptDTO): string {
  const formatCurrency = (amount: number) =>
    `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const itemsList = receipt.items
    .map((item) => `  • ${item.itemName} (x${item.quantity}) - ${formatCurrency(item.unitPrice * item.quantity)}`)
    .join('\n');

  return `
${receipt.supplier.name}
${receipt.supplier.businessActivityDescription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ PAYMENT SUCCESSFUL

Dear ${receipt.recipient.name},

We have received your payment. Below are the details of your transaction.

TRANSACTION DETAILS
───────────────────
Transaction ID: ${receipt.transactionId}
Payment Date: ${formatDateTime(receipt.transactionTime)}
Receipt No: ${receipt.invoiceNo}
Status: PAID

ITEMS
───────────────
${itemsList}

SUMMARY
───────────────
Subtotal: ${formatCurrency(receipt.totalExcludingTax)}
Tax (${receipt.taxRate}%): ${formatCurrency(receipt.totalIncludingTax - receipt.totalExcludingTax)}
━━━━━━━━━━━━━━━
TOTAL PAID: ${formatCurrency(receipt.totalIncludingTax)}

VIEW TRANSACTION
───────────────
${receipt.billUrl}

───────────────────────────────────────
${receipt.supplier.name}
TIN: ${receipt.supplier.tin} | SSM: ${receipt.supplier.registrationNumber} | MSIC: ${receipt.supplier.msicCode}

This is an official payment receipt for transaction ${receipt.transactionId}
For questions, contact us at ${receipt.supplier.email}
`.trim();
}

export async function sendReceiptEmail(
  mailService: MailerService,
  receipt: ReceiptDTO,
  pdfBuffer: Buffer,
): Promise<{ status: string; message: string }> {
  await mailService.sendMail({
    to: receipt.recipient.email,
    cc: receipt.supplier.email,
    subject: `Payment Receipt ${receipt.invoiceNo} from ${receipt.supplier.name}`,
    text: generateReceiptEmailText(receipt),
    html: generateReceiptEmailHtml(receipt),
    attachments: [
      {
        filename: `Receipt-${receipt.invoiceNo}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return { status: 'Success', message: 'Receipt email sent' };
}

// Export individual functions for flexibility
export { generateReceiptEmailHtml, generateReceiptEmailText };