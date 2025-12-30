import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { MailerService } from '@nestjs-modules/mailer';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { InvoiceStatus } from '@prisma/client';
import {
  CreateInvoiceInputDTO,
  ProcessedInvoiceDto,
} from './invoice-dto';

// Utilities
import { calculateInvoiceData } from './invoice-utility/invoice-utility-calculation';
import { processPaymentIntegration } from './invoice-utility/invoice-utility-payment-integration';
import { sendInvoiceEmail, sendReceiptEmail } from './invoice-utility/invoice-utility-email-sender';

// Repositories
import { createInvoice } from './invoice-repository/invoice-repository-create';
import {
  updateInvoiceStatus,
  UpdateInvoiceStatusData,
} from './invoice-repository/invoice-repository-update-status';
import { getInvoiceAsReceipt } from './invoice-repository/invoice-repository-get';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
  ) {}

  /**
   * Queue invoice generation for asynchronous processing
   *
   * @param invoiceDataList - Array of invoice data to process
   * @returns Success confirmation with timestamp
   */
  async queueInvoiceGeneration(
    invoiceDataList: CreateInvoiceInputDTO[],
  ): Promise<{ message: string; timestamp: string }> {
    try {
      this.logger.log(
        `Queueing ${invoiceDataList.length} invoice(s) for generation`,
      );

      this.queueService.sendMessageQue(
        'receiver-create-invoice',
        invoiceDataList,
      );

      this.logger.log('Invoice generation queued successfully');

      return {
        message: 'Invoice generation has been queued successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue invoice generation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process complete invoice creation workflow
   * Calculate -> Integrate Payment -> Save to DB -> Send Email
   *
   * @param inputData - Raw invoice input data
   * @returns Created invoice data with payment URL
   */
  async processInvoiceCreation(
    inputData: CreateInvoiceInputDTO,
  ): Promise<ProcessedInvoiceDto> {
    try {
      this.logger.log(
        `Processing invoice creation for: ${inputData.recipient.name}`,
      );

      // Step 1: Calculate invoice data (totals, invoice number)
      const calculatedInvoice = await calculateInvoiceData(
        inputData,
        this.logger,
      );

      // Step 2: Integrate with payment gateway
      const processedInvoice = await processPaymentIntegration(
        calculatedInvoice,
        this.logger,
      );

      // Step 3: Save to database (CRITICAL - must succeed)
      await createInvoice(
        this.prisma,
        processedInvoice,
        this.logger,
      );

      // Step 4: Send invoice email (NON-CRITICAL - fire and forget)
      // Don't await - let it run in background
      sendInvoiceEmail(this.mailService, processedInvoice, this.logger).catch(
        (error) => {
          this.logger.warn(
            `Email sending failed but invoice created: ${processedInvoice.invoiceNo}`,
          );
        },
      );

      this.logger.log(
        `Invoice creation completed successfully: ${processedInvoice.invoiceNo}`,
      );

      return processedInvoice;
    } catch (error) {
      this.logger.error(
        `Invoice creation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process multiple invoices (from queue consumer)
   * Processes each invoice individually with error isolation
   *
   * @param invoiceDataList - Array of invoice data to process
   */
  async processInvoiceBatch(
    invoiceDataList: CreateInvoiceInputDTO[],
  ): Promise<void> {
    this.logger.log(
      `Processing batch of ${invoiceDataList.length} invoice(s)`,
    );

    for (const invoiceData of invoiceDataList) {
      try {
        await this.processInvoiceCreation(invoiceData);
      } catch (error) {
        // Log error but continue processing other invoices
        this.logger.error(
          `Failed to process invoice in batch for ${invoiceData.recipient.name}: ${error.message}`,
          error.stack,
        );
        continue;
      }
    }

    this.logger.log('Batch processing completed');
  }

  /**
   * Queue payment callback for asynchronous processing
   * This avoids timeout issues in serverless environments
   *
   * @param callbackData - Payment callback data from ToyyibPay
   * @returns Success confirmation
   */
  async queuePaymentCallback(callbackData: {
    refno: string;
    status: string;
    reason: string;
    billcode: string;
    order_id: string;
    amount: string;
    status_id: string;
    msg: string;
    transaction_id: string;
    fpx_transaction_id: string;
    hash: string;
    transaction_time: string;
  }): Promise<{ message: string }> {
    try {
      this.logger.log(
        `Queueing payment callback for invoice: ${callbackData.order_id}`,
      );

      this.queueService.sendMessageQue(
        'receiver-update-invoice',
        callbackData,
      );

      return {
        message: 'Payment callback queued successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue payment callback: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process payment callback from RabbitMQ queue
   * Update invoice status and send receipt email if paid
   *
   * @param callbackData - Payment callback data from ToyyibPay
   */
  async processPaymentCallbackFromQueue(callbackData: {
    refno: string;
    status: string;
    reason: string;
    billcode: string;
    order_id: string;
    amount: string;
    status_id: string;
    msg: string;
    transaction_id: string;
    fpx_transaction_id: string;
    hash: string;
    transaction_time: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `Processing payment callback for invoice: ${callbackData.order_id}`,
      );

      // Parse callback data
      const invoiceNo = callbackData.order_id;
      const paymentStatus =
        callbackData.status === '1'
          ? InvoiceStatus.PAID
          : InvoiceStatus.CANCELLED;

      // Sanitize transaction time
      const sanitizedTransactionTime = callbackData.transaction_time
        ? new Date(callbackData.transaction_time.replace(' ', 'T')).toISOString()
        : new Date().toISOString();

      // Update invoice status
      const updateData: UpdateInvoiceStatusData = {
        invoiceNo,
        status: paymentStatus,
        transactionId: callbackData.transaction_id,
        transactionTime: sanitizedTransactionTime,
      };

      await updateInvoiceStatus(this.prisma, updateData, this.logger);

      // If payment successful, send receipt email
      if (paymentStatus === InvoiceStatus.PAID) {
        this.logger.log(`Payment successful, sending receipt email`);

        // Get invoice data as receipt
        const receiptData = await getInvoiceAsReceipt(
          this.prisma,
          invoiceNo,
          this.logger,
        );

        // Send receipt email (non-blocking)
        sendReceiptEmail(this.mailService, receiptData, this.logger).catch(
          (error) => {
            this.logger.warn(
              `Receipt email failed but payment processed: ${invoiceNo}`,
            );
          },
        );
      }

      this.logger.log(`Payment callback processed successfully from queue`);
    } catch (error) {
      this.logger.error(
        `Payment callback processing failed: ${error.message}`,
        error.stack,
      );
      // Re-throw to let RabbitMQ handle retry logic
      throw error;
    }
  }
}
