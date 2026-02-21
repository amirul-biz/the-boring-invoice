import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import {
  ReceiptDTO,
  SupplierDTO,
  RecipientDTO,
  InvoiceItemDTO,
} from '../invoice-dto';

/**
 * Retrieve invoice data as ReceiptDTO
 * Validates that invoice has transaction details required for receipt
 *
 * @param prisma - PrismaService instance
 * @param invoiceNo - Invoice number to retrieve
 * @param logger - NestJS Logger instance for logging
 * @returns Invoice data formatted as ReceiptDTO
 */
export async function getInvoiceAsReceipt(
  prisma: PrismaService,
  invoiceNo: string,
  logger: Logger,
): Promise<ReceiptDTO> {
  try {
    logger.log(`Retrieving invoice as receipt: ${invoiceNo}`);

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNo },
    });

    if (!invoice) {
      throw new HttpException(
        `Invoice ${invoiceNo} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate transaction details exist
    if (!invoice.transactionId || !invoice.transactionTime) {
      throw new HttpException(
        `Invoice ${invoiceNo} does not have transaction details`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Convert to ReceiptDTO
    const receiptDto: ReceiptDTO = {
      invoiceNo: invoice.invoiceNo,
      invoiceType: invoice.invoiceType,
      currency: invoice.currency,
      status: invoice.status,

      issuedDate: invoice.issuedDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),

      supplier: invoice.supplier as unknown as SupplierDTO,
      recipient: invoice.recipient as unknown as RecipientDTO,

      items: invoice.items as any as InvoiceItemDTO[],

      totalNetAmount: parseFloat(invoice.totalNetAmount.toString()),
      totalTaxAmount: parseFloat(invoice.totalTaxAmount.toString()),
      totalDiscountAmount: parseFloat(invoice.totalDiscountAmount.toString()),
      totalPayableAmount: parseFloat(invoice.totalPayableAmount.toString()),

      billUrl: invoice.billUrl || '',

      invoiceVersion: invoice.invoiceVersion,

      transactionId: invoice.transactionId,
      transactionTime: invoice.transactionTime.toISOString(),
    };

    logger.log(`Invoice retrieved successfully as receipt: ${invoiceNo}`);

    return receiptDto;
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }

    logger.error(
      `Failed to retrieve invoice ${invoiceNo}: ${error.message}`,
      error.stack,
    );

    throw new HttpException(
      'Failed to retrieve invoice',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * Find invoice by number — returns null if not found, never throws
 * Use this for idempotency checks where absence is a valid state
 */
export async function findInvoiceByNumber(
  prisma: PrismaService,
  invoiceNo: string,
  logger: Logger,
) {
  try {
    return await prisma.invoice.findUnique({ where: { invoiceNo } });
  } catch (error) {
    logger.error(`Failed to find invoice ${invoiceNo}: ${error.message}`, error.stack);
    throw error;
  }
}

/**
 * Retrieve invoice data by invoice number
 * General purpose retrieval without receipt validation
 *
 * @param prisma - PrismaService instance
 * @param invoiceNo - Invoice number to retrieve
 * @param logger - NestJS Logger instance for logging
 * @returns Invoice entity
 */
export async function getInvoiceByNumber(
  prisma: PrismaService,
  invoiceNo: string,
  logger: Logger,
) {
  try {
    logger.log(`Retrieving invoice: ${invoiceNo}`);

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNo },
    });

    if (!invoice) {
      throw new HttpException(
        `Invoice ${invoiceNo} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    logger.log(`Invoice retrieved successfully: ${invoiceNo}`);

    return invoice;
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }

    logger.error(
      `Failed to retrieve invoice ${invoiceNo}: ${error.message}`,
      error.stack,
    );

    throw new HttpException(
      'Failed to retrieve invoice',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
