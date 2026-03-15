import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CalculatedInvoiceDto, ProcessedInvoiceDto } from '../invoice-dto';
import { generateToyyibpayBill } from '../invoice-generator/invoice-generator-toyyibpay-bill';
import { PaymentIntegrationCredential } from '../../business-info/business-info-interface';

/**
 * Parse billPaymentDate from ToyyibPay getBillTransactions response.
 * Handles both 24h ("DD-MM-YYYY HH:MM:SS") and 12h ("DD-MM-YYYY HH:MM:SS am/pm") formats in MYT (UTC+8).
 * Returns UTC ISO string for DB storage.
 */
export function parseBillPaymentDate(billPaymentDate: string): string {
  if (!billPaymentDate) return new Date().toISOString();

  const [datePart, timePart, meridiem] = billPaymentDate.trim().split(' ');
  const [day, month, year] = datePart.split('-');
  const [, minutes, seconds] = timePart.split(':').map(Number);
  let hours = Number(timePart.split(':')[0]);

  if (meridiem) {
    const isPm = meridiem.toLowerCase() === 'pm';
    if (isPm && hours !== 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
  }

  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return new Date(`${year}-${month}-${day}T${time24}+08:00`).toISOString();
}

/**
 * Process invoice data by integrating with ToyyibPay payment gateway
 * Creates payment bill and returns invoice with payment URL
 *
 * @param calculatedInvoice - Invoice with calculated totals
 * @param paymentIntegrationCredential - Business payment credentials (secretKey, categoryCode)
 * @param logger - NestJS Logger instance for logging
 * @returns ProcessedInvoiceDto with billUrl included
 */
export async function processPaymentIntegration(
  calculatedInvoice: CalculatedInvoiceDto,
  paymentIntegrationCredential: PaymentIntegrationCredential,
  logger: Logger,
): Promise<ProcessedInvoiceDto> {
  try {
    logger.log(
      `Processing payment integration for invoice: ${calculatedInvoice.invoiceNo}`,
    );

    // Get environment URLs
    const returnUrl = process.env.PAYMENT_RETURN_URL;
    const callbackUrl = `${process.env.API_URL}/invoice/callback`;

    if (!returnUrl || !process.env.API_URL) {
      throw new HttpException(
        'Payment gateway configuration missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    logger.log(`Creating ToyyibPay bill with URLs:`, {
      returnUrl,
      callbackUrl,
    });

    // Initialize ToyyibPay client with business-specific credentials
    const toyyibPay = generateToyyibpayBill({
      secretKey: paymentIntegrationCredential.userSecretKey,
      categoryCode: paymentIntegrationCredential.categoryCode,
      returnUrl,
      callbackUrl,
    });

    // Create bill and get payment URL
    const result = await toyyibPay.createBillFromCalculatedInvoiceData(
      calculatedInvoice,
    );

    if (!result || !result.paymentUrl) {
      throw new HttpException(
        'Failed to create payment bill',
        HttpStatus.BAD_GATEWAY,
      );
    }

    logger.log(
      `Payment bill created successfully: ${result.billCode}`,
    );

    // Return processed invoice with payment URL and bill code
    return {
      ...calculatedInvoice,
      billCode: result.billCode,
      billUrl: result.paymentUrl,
      status: 'PENDING',
    };
  } catch (error) {
    logger.error(
      `Payment integration failed for invoice ${calculatedInvoice.invoiceNo}: ${error.message}`,
      error.stack,
    );
    throw error;
  }
}
