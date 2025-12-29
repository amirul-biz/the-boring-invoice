import { Logger } from '@nestjs/common';
import {
  CreateInvoiceInputDTO,
  CalculatedInvoiceDto,
} from '../invoice-dto';

/**
 * Calculate invoice data with LHDN mathematical accuracy
 * Generates invoice number and calculates all totals
 *
 * @param input - The raw invoice input from the client
 * @param logger - NestJS Logger instance for logging
 * @returns CalculatedInvoiceDto with all calculated fields
 */
export async function calculateInvoiceData(
  input: CreateInvoiceInputDTO,
  logger: Logger,
): Promise<CalculatedInvoiceDto> {
  try {
    logger.log(`Calculating invoice data for recipient: ${input.recipient.name}`);

    // 1. Calculate and map items with LHDN mathematical accuracy
    const mappedItems = input.items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      const taxDecimal = input.taxRate / 100;

      return {
        ...item,
        // LHDN requires each line to have its own tax amount calculated
        taxAmount: parseFloat((subtotal * taxDecimal).toFixed(2)),
        lineTotal: parseFloat((subtotal * (1 + taxDecimal)).toFixed(2)),
      };
    });

    // 2. Generate the internal reference ID (Maintaining the 50-character limit)
    const invoiceNo = generateInvoiceNumber(input.recipient.name);

    // 3. Calculate financial totals with precision
    const totalExcludingTax = mappedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const totalTaxAmount = mappedItems.reduce(
      (sum, item) => sum + item.taxAmount,
      0,
    );

    // 4. Construct the Output DTO
    const output = new CalculatedInvoiceDto();
    Object.assign(output, input);

    // System-Generated Fields
    output.invoiceNo = invoiceNo;
    output.issuedDate = new Date().toISOString();
    output.items = mappedItems;
    output.totalExcludingTax = parseFloat(totalExcludingTax.toFixed(2));
    output.totalIncludingTax = parseFloat(
      (totalExcludingTax + totalTaxAmount).toFixed(2),
    );

    logger.log(`Invoice calculation completed: ${invoiceNo}`);

    return output;
  } catch (error) {
    logger.error(`Invoice calculation failed: ${error.message}`, error.stack);
    throw error;
  }
}

/**
 * Generate unique invoice number with timestamp and recipient name
 * Format: INV-{timestamp}-{sanitizedName}-{random}
 *
 * @param recipientName - Name of the recipient
 * @returns Generated invoice number (max 50 chars)
 */
export function generateInvoiceNumber(recipientName: string): string {
  // Generate timestamp (e.g., 2512191830)
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(2, 12);

  // Sanitize recipient name
  const rawName = recipientName || 'guest';
  const sanitizedName = rawName
    .trim()
    .split(' ')[0] // Take only the first name
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^a-zA-Z0-9-]/g, ''); // Remove special characters

  const namePrefix = sanitizedName.substring(0, 8).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6);

  // Format: INV-2512191830-AMIRUL-8d2f (~28 characters)
  return `INV-${timestamp}-${namePrefix}-${randomSuffix}`.toUpperCase();
}
