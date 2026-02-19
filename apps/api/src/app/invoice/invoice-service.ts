import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { MailerService } from '@nestjs-modules/mailer';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { InvoiceStatus } from '@prisma/client';
import {
  CalculatedInvoiceDto,
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
import { findInvoiceByNumber, getInvoiceAsReceipt, getInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { getInvoiceList, InvoiceListQuery, PaginatedInvoiceList } from './invoice-repository/invoice-repository-list';

export interface RetryInvoiceMessage {
  businessId: string;
  calculatedInvoice: CalculatedInvoiceDto;
  attemptNo: number;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly BATCH_DELAY_MS = 1500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Queue invoice generation for asynchronous processing
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
   * Idempotent invoice creation workflow
   * Receives already-calculated invoice data — checks DB state at each step and skips what is already done
   *
   * Step 1: findInvoiceByNumber → null → createInvoice(DRAFT) / found → skip
   * Step 2: billCode null → processPaymentIntegration → saveBillUrl / set → skip
   * Step 3: status DRAFT → setPendingStatus / other → skip
   * Step 4: sendInvoiceEmail (fire & forget)
   */
  async processInvoiceCreation(
    calculatedInvoice: CalculatedInvoiceDto,
    paymentIntegrationCredential: PaymentIntegrationCredential,
    businessId: string,
  ): Promise<ProcessedInvoiceDto> {
    try {
      this.logger.log(
        `Processing invoice creation for: ${calculatedInvoice.invoiceNo}`,
      );

      // Step 1: Check if invoice already exists — create DRAFT only if not
      let existingInvoice = await findInvoiceByNumber(
        this.prisma,
        calculatedInvoice.invoiceNo,
        this.logger,
      );

      if (!existingInvoice) {
        await createInvoice(
          this.prisma,
          { ...calculatedInvoice, status: 'DRAFT' },
          businessId,
          this.logger,
        );
        existingInvoice = await findInvoiceByNumber(
          this.prisma,
          calculatedInvoice.invoiceNo,
          this.logger,
        );
      } else {
        this.logger.log(
          `Invoice ${calculatedInvoice.invoiceNo} already exists (${existingInvoice.status}) — resuming`,
        );
      }

      // Step 2: Create ToyyibPay bill only if billCode not yet saved
      let processedInvoice: ProcessedInvoiceDto;

      if (!existingInvoice.billCode) {
        processedInvoice = await processPaymentIntegration(
          calculatedInvoice,
          paymentIntegrationCredential,
          this.logger,
        );

        await saveBillUrl(
          this.prisma,
          calculatedInvoice.invoiceNo,
          processedInvoice.billCode,
          processedInvoice.billUrl,
          this.logger,
        );
      } else {
        this.logger.log(
          `Invoice ${calculatedInvoice.invoiceNo} already has billCode — skipping ToyyibPay`,
        );
        processedInvoice = {
          ...calculatedInvoice,
          billCode: existingInvoice.billCode,
          billUrl: existingInvoice.billUrl,
          status: existingInvoice.status,
        };
      }

      // Step 3: Activate to PENDING only if still DRAFT
      if (existingInvoice.status === InvoiceStatus.DRAFT) {
        await setPendingStatus(
          this.prisma,
          calculatedInvoice.invoiceNo,
          this.logger,
        );
      } else {
        this.logger.log(
          `Invoice ${calculatedInvoice.invoiceNo} already ${existingInvoice.status} — skipping setPendingStatus`,
        );
      }

      // Step 4: Send invoice email (NON-CRITICAL — fire and forget)
      sendInvoiceEmail(this.mailService, processedInvoice, this.logger).catch(
        () => {
          this.logger.warn(
            `Email failed for ${processedInvoice.invoiceNo} — resend manually or wait for SES migration`,
          );
        },
      );

      this.logger.log(
        `Invoice creation completed: ${processedInvoice.invoiceNo}`,
      );

      return processedInvoice;
    } catch (error) {
      this.logger.error(
        `Invoice creation failed for ${calculatedInvoice.invoiceNo}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process multiple invoices from queue consumer
   * Calculates each invoice first (generates invoiceNo), then attempts creation once.
   * On failure, emits to retry-invoice queue immediately — does NOT block the batch.
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

      // Calculate first (pure computation, generates invoiceNo) — invoiceNo is stable for retries
      const calculatedInvoice = await calculateInvoiceData(invoiceData, this.logger);

      try {
        await this.processInvoiceCreation(calculatedInvoice, paymentIntegrationCredential, businessId);
      } catch (error) {
        this.logger.error(
          `Invoice ${calculatedInvoice.invoiceNo} failed — emitting to retry queue: ${error.message}`,
          error.stack,
        );
        this.sendToRetryQueue({ businessId, calculatedInvoice, attemptNo: 1 });
      }

      if (i < invoiceDataList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
      }
    }

    this.logger.log('Batch processing completed');
  }

  /**
   * Process a single invoice from the retry-invoice queue
   * Waits 1 minute then retries — idempotent, resumes from DB state
   * On failure, re-emits with incremented attemptNo or routes to failed-invoice
   */
  async processInvoiceRetry(msg: RetryInvoiceMessage): Promise<void> {
    this.logger.log(
      `Retry attempt ${msg.attemptNo}/5 for invoice ${msg.calculatedInvoice.invoiceNo} — waiting 1 minute`,
    );

    await new Promise(resolve => setTimeout(resolve, 60_000));

    const paymentIntegrationCredential = await this.businessInfoService.getPaymentIntegrationCredential(msg.businessId);

    try {
      await this.processInvoiceCreation(
        msg.calculatedInvoice,
        paymentIntegrationCredential,
        msg.businessId,
      );
      this.logger.log(
        `Retry ${msg.attemptNo}/5 succeeded for invoice ${msg.calculatedInvoice.invoiceNo}`,
      );
    } catch (error) {
      this.logger.error(
        `Retry ${msg.attemptNo}/5 failed for invoice ${msg.calculatedInvoice.invoiceNo}: ${error.message}`,
        error.stack,
      );

      if (msg.attemptNo < 5) {
        this.sendToRetryQueue({ ...msg, attemptNo: msg.attemptNo + 1 });
      } else {
        this.sendToFailedQueue(msg.businessId, msg.calculatedInvoice, error);
      }
    }
  }

  private sendToRetryQueue(msg: RetryInvoiceMessage): void {
    this.queueService.sendMessageQue('retry-invoice', msg);
    this.logger.log(
      `Invoice ${msg.calculatedInvoice.invoiceNo} emitted to retry-invoice (attempt ${msg.attemptNo}/5)`,
    );
  }

  private sendToFailedQueue(
    businessId: string,
    calculatedInvoice: CalculatedInvoiceDto,
    error: Error,
  ): void {
    // TODO: decide whether to delete the DRAFT invoice or mark as CANCELLED — KIV
    this.queueService.sendMessageQue('failed-invoice', {
      businessId,
      calculatedInvoice,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
    this.logger.error(
      `Invoice ${calculatedInvoice.invoiceNo} permanently failed after 5 attempts — moved to failed-invoice queue`,
    );
  }

  /**
   * Queue payment callback for asynchronous processing
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

        const receiptData = await getInvoiceAsReceipt(
          this.prisma,
          invoiceNo,
          this.logger,
        );

        sendReceiptEmail(this.mailService, receiptData, this.logger).catch(
          () => {
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
      throw error;
    }
  }

  async getInvoiceList(encodedBusinessId: string, userId: string, query: InvoiceListQuery): Promise<PaginatedInvoiceList> {
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);
    const businessId = this.cryptoService.decodeId(encodedBusinessId);
    return getInvoiceList(this.prisma, { ...query, businessId }, this.logger);
  }
}
