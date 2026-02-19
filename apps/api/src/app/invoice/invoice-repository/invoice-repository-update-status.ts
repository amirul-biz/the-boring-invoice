import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { InvoiceStatus, Invoice } from '@prisma/client';

/**
 * Data required to update invoice status
 */
export interface UpdateInvoiceStatusData {
  invoiceNo: string;
  status: InvoiceStatus;
  transactionId: string;
  transactionTime: string;
}

/**
 * Update invoice payment status and transaction details
 *
 * @param prisma - PrismaService instance
 * @param data - Update data containing status and transaction info
 * @param logger - NestJS Logger instance for logging
 * @returns Updated invoice record
 */
/**
 * Activate a DRAFT invoice after ToyyibPay bill is created
 * Sets status to PENDING and saves the bill URL
 *
 * @param prisma - PrismaService instance
 * @param invoiceNo - Invoice number to activate
 * @param billUrl - ToyyibPay payment URL
 * @param logger - NestJS Logger instance
 */
export async function activateInvoice(
  prisma: PrismaService,
  invoiceNo: string,
  billUrl: string,
  logger: Logger,
): Promise<Invoice> {
  try {
    logger.log(`Activating invoice ${invoiceNo} with billUrl`);

    const invoice = await prisma.invoice.update({
      where: { invoiceNo },
      data: {
        status: InvoiceStatus.PENDING,
        billUrl,
      },
    });

    logger.log(`Invoice ${invoiceNo} activated to PENDING`);
    return invoice;
  } catch (error) {
    logger.error(
      `Failed to activate invoice ${invoiceNo}: ${error.message}`,
      error.stack,
    );

    if (error.code === 'P2025') {
      throw new HttpException(
        `Invoice ${invoiceNo} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    throw new HttpException(
      'Failed to activate invoice',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function updateInvoiceStatus(
  prisma: PrismaService,
  data: UpdateInvoiceStatusData,
  logger: Logger,
): Promise<Invoice> {
  try {
    logger.log(
      `Updating invoice ${data.invoiceNo} status to ${data.status}`,
    );

    const invoice = await prisma.invoice.update({
      where: { invoiceNo: data.invoiceNo },
      data: {
        status: data.status,
        transactionId: data.transactionId,
        transactionTime: new Date(data.transactionTime),
      },
    });

    logger.log(
      `Invoice ${data.invoiceNo} status updated successfully`,
    );

    return invoice;
  } catch (error) {
    logger.error(
      `Failed to update invoice ${data.invoiceNo} status: ${error.message}`,
      error.stack,
    );

    // Check for record not found
    if (error.code === 'P2025') {
      throw new HttpException(
        `Invoice ${data.invoiceNo} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    throw new HttpException(
      'Failed to update invoice status',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
