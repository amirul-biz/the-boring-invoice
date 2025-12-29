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
