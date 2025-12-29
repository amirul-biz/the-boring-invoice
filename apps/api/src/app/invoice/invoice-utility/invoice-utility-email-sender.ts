import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ProcessedInvoiceDto, ReceiptDTO } from '../invoice-dto';
import { generatePdfInvoiceTemplate } from '../invoice-generator/invoice-generator-pdf-invoice-template';
import { generateInvoiceEmailTemplate } from '../invoice-generator/invoice-generator-invoice-email-template';
import { generatePdfReceiptTemplate } from '../invoice-generator/invoice-generator-pdf-receipt-template';
import { generateReceiptEmailTemplate } from '../invoice-generator/invoice-generator-receipt-email-template';

/**
 * Send invoice email with PDF attachment
 *
 * @param mailService - NestJS MailerService instance
 * @param invoiceData - Processed invoice data
 * @param logger - NestJS Logger instance for logging
 * @returns Promise that resolves when email is sent
 */
export async function sendInvoiceEmail(
  mailService: MailerService,
  invoiceData: ProcessedInvoiceDto,
  logger: Logger,
): Promise<void> {
  try {
    logger.log(`Sending invoice email for: ${invoiceData.invoiceNo}`);

    // Generate PDF invoice
    const pdfBuffer = await generatePdfInvoiceTemplate(invoiceData);

    // Send email with PDF attachment
    await generateInvoiceEmailTemplate(
      mailService,
      invoiceData,
      pdfBuffer,
    );

    logger.log(
      `Invoice email sent successfully to: ${invoiceData.recipient.email}`,
    );
  } catch (error) {
    logger.error(
      `Failed to send invoice email for ${invoiceData.invoiceNo}: ${error.message}`,
      error.stack,
    );
    // Don't throw - email sending is non-critical for invoice creation
    // Just log the error and continue
  }
}

/**
 * Send receipt email with PDF attachment
 *
 * @param mailService - NestJS MailerService instance
 * @param receiptData - Receipt data with transaction details
 * @param logger - NestJS Logger instance for logging
 * @returns Promise that resolves when email is sent
 */
export async function sendReceiptEmail(
  mailService: MailerService,
  receiptData: ReceiptDTO,
  logger: Logger,
): Promise<void> {
  try {
    logger.log(`Sending receipt email for: ${receiptData.invoiceNo}`);

    // Generate PDF receipt
    const pdfBuffer = await generatePdfReceiptTemplate(receiptData);

    // Send email with PDF attachment (using existing template)
    await generateReceiptEmailTemplate(
      mailService,
      receiptData,
      pdfBuffer,
    );

    logger.log(
      `Receipt email sent successfully to: ${receiptData.recipient.email}`,
    );
  } catch (error) {
    logger.error(
      `Failed to send receipt email for ${receiptData.invoiceNo}: ${error.message}`,
      error.stack,
    );
    // Don't throw - email sending is non-critical
  }
}
