import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { MailerService } from '@nestjs-modules/mailer';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { InvoiceStatus } from '@prisma/client';
import {
  CreateInvoiceInputDTO,
  ProcessedInvoiceDto,
} from './invoice-dto';
import { BusinessInfoService } from '../business-info/business-info-service';
import { PaymentIntegrationCredential } from '../business-info/business-info-interface';
import { CryptoService } from '../crypto/crypto.service';

// Utilities
import { calculateInvoiceData } from './invoice-utility/invoice-utility-calculation';
import { processPaymentIntegration } from './invoice-utility/invoice-utility-payment-integration';
import { sendInvoiceEmail, sendReceiptEmail } from './invoice-utility/invoice-utility-email-sender';

// Repositories
import { createInvoice } from './invoice-repository/invoice-repository-create';
import {
  updateInvoiceStatus,
  UpdateInvoiceStatusData,
  saveBillUrl,
  setPendingStatus,
} from './invoice-repository/invoice-repository-update-status';
import { getInvoiceAsReceipt, getInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { getInvoiceList, InvoiceListQuery, PaginatedInvoiceList } from './invoice-repository/invoice-repository-list';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly BATCH_DELAY_MS = 1500; // Delay between invoices to avoid ToyyibPay/SMTP rate limits

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Queue invoice generation for asynchronous processing
   *
   * @param invoiceDataList - Array of invoice data to process
   * @returns Success confirmation with timestamp
   */
  async queueInvoiceGeneration(
    invoiceDataList: CreateInvoiceInputDTO[],
    encodedBusinessId: string,
    userId: string,
  ): Promise<{ message: string; timestamp: string }> {
    try {
      this.logger.log(
        `Queueing ${invoiceDataList.length} invoice(s) for generation`,
      );

      await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

      const businessId = this.cryptoService.decodeId(encodedBusinessId);

      await this.queueService.sendMessageQue(
        'receiver-create-invoice',
        { businessId, invoiceDataList },
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
    paymentIntegrationCredential: PaymentIntegrationCredential,
    businessId: string,
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

      // Step 2: Save to DB as DRAFT first — ensures a record exists before any external call
      await createInvoice(
        this.prisma,
        { ...calculatedInvoice, status: 'DRAFT' },
        businessId,
        this.logger,
      );

      // Step 3: Create ToyyibPay payment bill
      const processedInvoice = await processPaymentIntegration(
        calculatedInvoice,
        paymentIntegrationCredential,
        this.logger,
      );

      // Step 4: Save billCode and billUrl to DB — status stays DRAFT
      await saveBillUrl(
        this.prisma,
        calculatedInvoice.invoiceNo,
        processedInvoice.billCode,
        processedInvoice.billUrl,
        this.logger,
      );

      // Step 5: Activate invoice status to PENDING
      await setPendingStatus(
        this.prisma,
        calculatedInvoice.invoiceNo,
        this.logger,
      );

      // Step 6: Send invoice email (NON-CRITICAL - fire and forget)
      sendInvoiceEmail(this.mailService, processedInvoice, this.logger).catch(
        () => {
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
   * Fetches payment credential once, then processes each invoice with error isolation
   *
   * @param businessId - Business ID to fetch payment credentials
   * @param invoiceDataList - Array of invoice data to process
   */
  async processInvoiceBatch(
    businessId: string,
    invoiceDataList: CreateInvoiceInputDTO[],
  ): Promise<void> {
    this.logger.log(
      `Processing batch of ${invoiceDataList.length} invoice(s)`,
    );

    const paymentIntegrationCredential = await this.businessInfoService.getPaymentIntegrationCredential(businessId);

    for (let i = 0; i < invoiceDataList.length; i++) {
      const invoiceData = invoiceDataList[i];
      try {
        await this.processInvoiceCreation(invoiceData, paymentIntegrationCredential, businessId);
      } catch (error) {
        this.logger.error(
          `Failed to process invoice in batch for ${invoiceData.recipient.name}: ${error.message}`,
          error.stack,
        );
      }

      if (i < invoiceDataList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
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

      await this.queueService.sendMessageQue(
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

      const invoiceNo = callbackData.order_id;

      this.logger.log(`[Callback] order_id=${invoiceNo} billcode=${callbackData.billcode}`);

      // Step 1: Look up invoice to confirm it exists in our system
      const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);
      this.logger.log(`[Callback] Invoice found: ${invoice.invoiceNo}`);

      // Step 2: Query ToyyibPay directly for authoritative payment status
      const transactions = await ToyyibPayUtil.fetchBillTransactions(callbackData.billcode);
      this.logger.log(`[Callback] getBillTransactions returned ${transactions.length} record(s) for billCode=${callbackData.billcode}`);

      const match = transactions.find(t => t.billExternalReferenceNo === invoiceNo);
      if (!match) {
        this.logger.warn(`[Callback] No matching transaction for invoiceNo=${invoiceNo} in billCode=${callbackData.billcode}`);
        return;
      }

      this.logger.log(`[Callback] Matched transaction — billpaymentStatus: ${match.billpaymentStatus}`);

      const paymentStatus = match.billpaymentStatus === '1' ? InvoiceStatus.PAID : InvoiceStatus.CANCELLED;

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

      this.logger.log(`[Callback] Invoice ${invoiceNo} status updated to ${paymentStatus}`);

      // If payment successful, send receipt email
      if (paymentStatus === InvoiceStatus.PAID) {
        this.logger.log(`[Callback] Payment successful, queueing receipt email`);

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

  async getInvoiceList(encodedBusinessId: string, userId: string, query: InvoiceListQuery): Promise<PaginatedInvoiceList> {
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);
    const businessId = this.cryptoService.decodeId(encodedBusinessId);
    return getInvoiceList(this.prisma, { ...query, businessId }, this.logger);
  }
}
