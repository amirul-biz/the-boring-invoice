import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { ProcessedInvoiceDto } from '../invoice-dto';
import { InvoiceStatus, Prisma, Invoice } from '@prisma/client';

/**
 * Create a new invoice in the database
 *
 * @param prisma - PrismaService instance
 * @param invoiceData - Processed invoice data to save
 * @param logger - NestJS Logger instance for logging
 * @returns Created invoice record
 */
export async function createInvoice(
  prisma: PrismaService,
  invoiceData: ProcessedInvoiceDto,
  businessId: string,
  logger: Logger,
): Promise<Invoice> {
  try {
    logger.log(`Creating invoice in database: ${invoiceData.invoiceNo}`);

    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        invoiceNo: invoiceData.invoiceNo,
        invoiceType: invoiceData.invoiceType,
        originalInvoiceRef: invoiceData.originalInvoiceRef ?? null,
        currency: invoiceData.currency,
        status: (invoiceData.status as InvoiceStatus) || InvoiceStatus.PENDING,

        issuedDate: new Date(invoiceData.issuedDate),
        dueDate: new Date(invoiceData.dueDate),

        recipientRegistrationNo: invoiceData.recipient.registrationNumber,
        recipient: invoiceData.recipient as any as Prisma.JsonObject,

        supplierRegistrationNo: invoiceData.supplier.registrationNumber,
        supplier: invoiceData.supplier as any as Prisma.JsonObject,

        items: invoiceData.items as unknown as Prisma.JsonArray,

        totalNetAmount: invoiceData.totalNetAmount,
        totalTaxAmount: invoiceData.totalTaxAmount,
        totalDiscountAmount: invoiceData.totalDiscountAmount,
        totalPayableAmount: invoiceData.totalPayableAmount,

        invoiceVersion: invoiceData.invoiceVersion,

        billUrl: invoiceData.billUrl,
      },
    });

    logger.log(`Invoice created successfully with ID: ${invoice.id}`);

    return invoice;
  } catch (error) {
    logger.error(
      `Failed to create invoice ${invoiceData.invoiceNo}: ${error.message}`,
      error.stack,
    );

    // Check for unique constraint violation
    if (error.code === 'P2002') {
      throw new HttpException(
        `Invoice with number ${invoiceData.invoiceNo} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    throw new HttpException(
      'Failed to save invoice to database',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
