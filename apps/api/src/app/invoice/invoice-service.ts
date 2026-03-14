// Third-party / framework
import { Injectable, Logger, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InvoiceStatus } from '@prisma/client';

// Application services
import { PrismaService } from '@prismaService';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { BusinessInfoService } from '../business-info/business-info-service';
import { PaymentIntegrationCredential } from '../business-info/business-info-interface';
import { CryptoService } from '../crypto/crypto.service';

// Local — DTOs
import {
  CalculatedInvoiceDto,
  CreateInvoiceInputDTO,
  ProcessedInvoiceDto,
  RecipientDTO,
  SupplierDTO,
  ReceiptDTO,
  InvoiceItemDTO,
} from './invoice-dto';

// Local — Utilities
import { calculateInvoiceData } from './invoice-utility/invoice-utility-calculation';
import { processPaymentIntegration } from './invoice-utility/invoice-utility-payment-integration';
import { sendInvoiceEmail, sendReceiptEmail } from './invoice-utility/invoice-utility-email-sender';

// Local — Repositories
import { createInvoice } from './invoice-repository/invoice-repository-create';
import {
  updateInvoiceStatus,
  UpdateInvoiceStatusData,
  saveBillUrl,
  setPendingStatus,
  cancelInvoice,
} from './invoice-repository/invoice-repository-update-status';
import { findInvoiceByNumber, getInvoiceAsReceipt, getInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { getInvoiceList, InvoiceListQuery, PaginatedInvoiceList } from './invoice-repository/invoice-repository-list';

// Local — Generator / Constants
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from './invoice.constants';

export interface CreateInvoiceMessage {
  businessId: string;
  calculatedInvoiceList: CalculatedInvoiceDto[];
}

export interface RetryInvoiceMessage {
  businessId: string;
  calculatedInvoice: CalculatedInvoiceDto;
  attemptNo: number;
}

export interface ToyyibPayCallbackData {
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
}

export interface RetryPaymentCallbackMessage {
  callbackData: ToyyibPayCallbackData;
  attemptNo: number;
}

export interface FailedInvoiceMessage {
  businessId: string;
  calculatedInvoice: CalculatedInvoiceDto;
  error: string;
  failedAt: string;
}

export interface NotifyEmailMessage {
  rawBusinessId: string;
  invoiceNumbers: string[];
  userId: string;
}

export interface DeactivateMessage {
  rawBusinessId: string;
  invoiceNumbers: string[];
  userId: string;
}

export interface MarkInvoicePaidMessage {
  rawBusinessId: string;
  invoiceNumbers: string[];
  userId: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Queue invoice generation for asynchronous processing.
   */
  async queueInvoiceGeneration(
    invoiceDataList: CreateInvoiceInputDTO[],
    encodedBusinessId: string,
    userId: string,
  ): Promise<{ message: string; timestamp: string }> {
    try {
      this.logger.log(`Queueing ${invoiceDataList.length} invoice(s) for generation`);

      await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

      const businessId = this.cryptoService.decodeId(encodedBusinessId);

      // Calculate BEFORE queuing — invoiceNo is stable for idempotency on re-delivery
      const calculatedInvoiceList = await Promise.all(
        invoiceDataList.map(invoiceData => calculateInvoiceData(invoiceData, this.logger)),
      );

      await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.CREATE_INVOICE, { businessId, calculatedInvoiceList });

      this.logger.log('Invoice generation queued successfully');

      return {
        message: 'Invoice generation has been queued successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to queue invoice generation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Idempotent invoice creation workflow.
   * Receives already-calculated invoice data — checks DB state at each step and skips what is already done.
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
      this.logger.log(`Processing invoice creation for: ${calculatedInvoice.invoiceNo}`);

      const existingInvoice = await this.ensureInvoiceDraftExists(calculatedInvoice, businessId);
      const processedInvoice = await this.ensureBillCode(existingInvoice, calculatedInvoice, paymentIntegrationCredential);

      const isDraft = existingInvoice.status === InvoiceStatus.DRAFT;

      // Step 3: Activate to PENDING only if still DRAFT
      if (isDraft) {
        await setPendingStatus(this.prisma, calculatedInvoice.invoiceNo, this.logger);
      } else {
        this.logger.log(`Invoice ${calculatedInvoice.invoiceNo} already ${existingInvoice.status} — skipping setPendingStatus`);
      }

      // Step 4: Send invoice email — only if transitioning from DRAFT (first successful completion)
      // Guard against re-sending on restart: if status was already PENDING, email was already sent
      if (isDraft) {
        sendInvoiceEmail(this.mailService, processedInvoice, this.logger).catch(() => {
          this.logger.warn(`Email failed for ${processedInvoice.invoiceNo} — resend manually or wait for SES migration`);
        });
      } else {
        this.logger.log(`Invoice ${processedInvoice.invoiceNo} already ${existingInvoice.status} — skipping email (already sent)`);
      }

      this.logger.log(`Invoice creation completed: ${processedInvoice.invoiceNo}`);

      return processedInvoice;
    } catch (error) {
      this.logger.error(`Invoice creation failed for ${calculatedInvoice.invoiceNo}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process multiple invoices from queue consumer.
   * Receives pre-calculated invoices (invoiceNo already stable from queue time).
   * On failure, emits to retry-invoice queue immediately — does NOT block the batch.
   */
  async processInvoiceBatch(
    businessId: string,
    calculatedInvoiceList: CalculatedInvoiceDto[],
  ): Promise<void> {
    this.logger.log(`Processing batch of ${calculatedInvoiceList.length} invoice(s)`);

    const paymentIntegrationCredential = await this.businessInfoService.getPaymentIntegrationCredential(businessId);

    for (const [index, calculatedInvoice] of calculatedInvoiceList.entries()) {
      try {
        await this.processInvoiceCreation(calculatedInvoice, paymentIntegrationCredential, businessId);
      } catch (error) {
        this.logger.error(
          `Invoice ${calculatedInvoice.invoiceNo} failed — emitting to retry queue: ${error.message}`,
          error.stack,
        );
        try {
          await this.sendToRetryQueue({ businessId, calculatedInvoice, attemptNo: INVOICE_QUEUE_CONFIG.INITIAL_RETRY_ATTEMPT });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue retry for ${calculatedInvoice.invoiceNo} — message lost: ${queueError.message}`);
        }
      }

      const isLastItem = index === calculatedInvoiceList.length - 1;
      if (!isLastItem) {
        await this.delay(INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS);
      }
    }

    this.logger.log('Batch processing completed');
  }

  /**
   * Process a single invoice from the retry-invoice queue.
   * Waits 1 minute then retries — idempotent, resumes from DB state.
   * On failure, re-emits with incremented attemptNo or routes to failed-invoice.
   */
  async processInvoiceRetry(msg: RetryInvoiceMessage): Promise<void> {
    this.logger.log(
      `Retry attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} for invoice ${msg.calculatedInvoice.invoiceNo} — waiting 1 minute`,
    );

    await this.delay(INVOICE_QUEUE_CONFIG.RETRY_DELAY_MS);

    const paymentIntegrationCredential = await this.businessInfoService.getPaymentIntegrationCredential(msg.businessId);

    try {
      await this.processInvoiceCreation(msg.calculatedInvoice, paymentIntegrationCredential, msg.businessId);
      this.logger.log(`Retry ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} succeeded for invoice ${msg.calculatedInvoice.invoiceNo}`);
    } catch (error) {
      this.logger.error(
        `Retry ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} failed for invoice ${msg.calculatedInvoice.invoiceNo}: ${error.message}`,
        error.stack,
      );

      if (msg.attemptNo < INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS) {
        try {
          await this.sendToRetryQueue({ ...msg, attemptNo: msg.attemptNo + 1 });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to re-queue retry for ${msg.calculatedInvoice.invoiceNo}: ${queueError.message}`);
        }
      } else {
        try {
          await this.sendToFailedQueue(msg.businessId, msg.calculatedInvoice, error);
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue failed-invoice for ${msg.calculatedInvoice.invoiceNo}: ${queueError.message}`);
        }
      }
    }
  }

  /**
   * Process a permanently failed invoice from the failed-invoice queue.
   * Sets status to CANCELLED and deactivates the ToyyibPay bill.
   */
  async processFailedInvoice(msg: FailedInvoiceMessage): Promise<void> {
    const { businessId, calculatedInvoice } = msg;
    const invoiceNo = calculatedInvoice.invoiceNo;

    this.logger.error(`Processing permanently failed invoice ${invoiceNo} — original error: ${msg.error}`);

    try {
      const paymentCredential = await this.businessInfoService.getPaymentIntegrationCredential(businessId);
      const invoice = await findInvoiceByNumber(this.prisma, invoiceNo, this.logger);

      if (invoice?.billCode) {
        ToyyibPayUtil.deactivateBill(invoice.billCode, paymentCredential.userSecretKey).catch(err =>
          this.logger.warn(`deactivateBill failed for ${invoiceNo}: ${err.message}`),
        );
      }

      await cancelInvoice(this.prisma, invoiceNo, this.logger);
      this.logger.log(`Invoice ${invoiceNo} cancelled and bill deactivated`);
    } catch (error) {
      this.logger.error(`Failed to process failed invoice ${invoiceNo}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Queue payment callback for asynchronous processing.
   */
  async queuePaymentCallback(callbackData: ToyyibPayCallbackData): Promise<{ message: string }> {
    try {
      this.logger.log(`Queueing payment callback for invoice: ${callbackData.order_id}`);

      await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.UPDATE_INVOICE_PAYMENT_STATUS, callbackData);

      return { message: 'Payment callback queued successfully' };
    } catch (error) {
      this.logger.error(`Failed to queue payment callback: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process payment callback — first attempt from queue consumer.
   * On failure, emits to retry-payment-callback instead of throwing.
   */
  async processPaymentCallbackFromQueue(callbackData: ToyyibPayCallbackData): Promise<void> {
    try {
      await this.executePaymentCallbackCore(callbackData);
    } catch (error) {
      this.logger.error(
        `Payment callback failed for ${callbackData.order_id} — emitting to retry queue: ${error.message}`,
        error.stack,
      );
      try {
        await this.sendToPaymentRetryQueue({ callbackData, attemptNo: INVOICE_QUEUE_CONFIG.INITIAL_RETRY_ATTEMPT });
      } catch (queueError) {
        this.logger.error(`CRITICAL: Failed to queue payment retry for ${callbackData.order_id} — message lost: ${queueError.message}`);
      }
    }
  }

  /**
   * Process a payment callback from the retry-payment-callback queue.
   * Waits 1 minute then retries — re-emits with incremented attemptNo or routes to failed queue.
   */
  async processPaymentCallbackRetry(msg: RetryPaymentCallbackMessage): Promise<void> {
    this.logger.log(
      `Payment callback retry attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} for invoice ${msg.callbackData.order_id} — waiting 1 minute`,
    );

    await this.delay(INVOICE_QUEUE_CONFIG.RETRY_DELAY_MS);

    try {
      await this.executePaymentCallbackCore(msg.callbackData);
      this.logger.log(`Payment callback retry ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} succeeded for invoice ${msg.callbackData.order_id}`);
    } catch (error) {
      this.logger.error(
        `Payment callback retry ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} failed for invoice ${msg.callbackData.order_id}: ${error.message}`,
        error.stack,
      );

      if (msg.attemptNo < INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS) {
        try {
          await this.sendToPaymentRetryQueue({ ...msg, attemptNo: msg.attemptNo + 1 });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to re-queue payment retry for ${msg.callbackData.order_id}: ${queueError.message}`);
        }
      } else {
        try {
          await this.sendToPaymentFailedQueue(msg.callbackData, error);
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue failed-payment-callback for ${msg.callbackData.order_id}: ${queueError.message}`);
        }
      }
    }
  }

  async getPaymentRedirectUrl(invoiceNo: string): Promise<string> {
    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    if (!invoice.billUrl) throw new HttpException('Payment link not available', HttpStatus.NOT_FOUND);
    return invoice.billUrl;
  }

  async getInvoiceList(encodedBusinessId: string, userId: string, query: InvoiceListQuery): Promise<PaginatedInvoiceList> {
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);
    const businessId = this.cryptoService.decodeId(encodedBusinessId);
    const result = await getInvoiceList(this.prisma, { ...query, businessId }, this.logger);
    result.items = result.items.map(item => ({
      ...item,
      recipientPhone: item.recipientPhone ? this.cryptoService.decrypt(item.recipientPhone) : '',
    }));
    return result;
  }

  async getInvoiceDetail(encodedBusinessId: string, invoiceNo: string, userId: string): Promise<ProcessedInvoiceDto> {
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);

    if (invoice.businessId !== rawBusinessId) {
      throw new ForbiddenException('Invoice does not belong to this business');
    }

    return {
      invoiceNo: invoice.invoiceNo,
      invoiceType: invoice.invoiceType,
      originalInvoiceRef: invoice.originalInvoiceRef ?? undefined,
      currency: invoice.currency,
      status: invoice.status,
      issuedDate: invoice.issuedDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      supplier: this.decryptSupplier(invoice.supplier as unknown as SupplierDTO),
      recipient: this.decryptRecipient(invoice.recipient as unknown as RecipientDTO),
      items: invoice.items as any as InvoiceItemDTO[],
      totalNetAmount: parseFloat(invoice.totalNetAmount.toString()),
      totalTaxAmount: parseFloat(invoice.totalTaxAmount.toString()),
      totalDiscountAmount: parseFloat(invoice.totalDiscountAmount.toString()),
      totalPayableAmount: parseFloat(invoice.totalPayableAmount.toString()),
      billUrl: invoice.billUrl ?? undefined,
      invoiceVersion: invoice.invoiceVersion,
    };
  }

  /**
   * Queue a batch of invoice deactivations for async processing.
   * Verifies ownership at HTTP time; consumer processes with 1.5 s gap between items.
   */
  async queueDeactivateBatch(
    encodedBusinessId: string,
    invoiceNumbers: string[],
    userId: string,
  ): Promise<void> {
    this.logger.log(`[Deactivate:1] Verifying ownership for user ${userId}`);
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

    this.logger.log(`[Deactivate:2] Ownership verified — decoding businessId`);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    this.logger.log(`[Deactivate:3] Emitting batch of ${invoiceNumbers.length} invoice(s) to queue — [${invoiceNumbers.join(', ')}]`);
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.DEACTIVATE_INVOICE_BILL, { rawBusinessId, invoiceNumbers, userId } as DeactivateMessage);
    this.logger.log(`[Deactivate:4] Batch queued successfully by user ${userId}`);
  }

  /**
   * Process a single invoice deactivation from the queue.
   * Each invoice is an independent queue message — no loop, no delay.
   */
  async processDeactivateSingle(data: DeactivateMessage): Promise<void> {
    this.logger.log(`[Deactivate:Consumer:1] Processing batch of ${data.invoiceNumbers.length} invoice(s) — [${data.invoiceNumbers.join(', ')}]`);
    for (const invoiceNo of data.invoiceNumbers) {
      await this.deactivateSingleInvoice(data.rawBusinessId, invoiceNo, data.userId);
      this.logger.log(`[Deactivate:Consumer:2] ${invoiceNo} — deactivated successfully`);
      await new Promise(resolve => setTimeout(resolve, INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS));
    }
  }

  /**
   * Deactivate a single invoice: calls ToyyibPay then cancels in DB.
   * Throws if invoice not found, belongs to different business, or is already PAID.
   * @private
   */
  private async deactivateSingleInvoice(rawBusinessId: string, invoiceNo: string, userId: string): Promise<void> {
    this.logger.log(`[Deactivate:Single:1] Fetching invoice ${invoiceNo} from DB`);
    const invoice = await findInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    if (!invoice) {
      throw new HttpException(`Invoice ${invoiceNo} not found`, HttpStatus.NOT_FOUND);
    }

    if (invoice.businessId !== rawBusinessId) {
      this.logger.warn(`[Deactivate:Single:X] BusinessId mismatch — invoice belongs to ${invoice.businessId}, expected ${rawBusinessId}`);
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Already in a terminal state — nothing to do
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      this.logger.warn(`[Deactivate:Single:X] Skipping ${invoiceNo} — already ${invoice.status}`);
      return;
    }

    // Only PENDING invoices can be deactivated
    if (invoice.status !== InvoiceStatus.PENDING) {
      this.logger.warn(`[Deactivate:Single:X] Skipping ${invoiceNo} — status is ${invoice.status}`);
      return;
    }

    // Cross-check with ToyyibPay before deactivating — guard against race with payment callback
    if (invoice.billCode) {
      this.logger.log(`[Deactivate:Single:2] Checking ToyyibPay for ${invoiceNo} (billCode=${invoice.billCode})`);
      const transactions = await ToyyibPayUtil.fetchBillTransactions(invoice.billCode);
      const paidTx = transactions.find(t => t.billExternalReferenceNo === invoiceNo && t.billpaymentStatus === '1');

      if (paidTx) {
        this.logger.warn(`[Deactivate:Single:X] ToyyibPay confirms payment received for ${invoiceNo} — updating to PAID and sending receipt`);
        await updateInvoiceStatus(this.prisma, {
          invoiceNo,
          status: InvoiceStatus.PAID,
          transactionId: paidTx.billpaymentInvoiceNo,
          transactionTime: this.parseBillPaymentDate(paidTx.billPaymentDate),
        }, this.logger);

        const rawReceipt = await getInvoiceAsReceipt(this.prisma, invoiceNo, this.logger);
        const receiptData: ReceiptDTO = {
          ...rawReceipt,
          recipient: this.decryptRecipient(rawReceipt.recipient),
          supplier: this.decryptSupplier(rawReceipt.supplier),
        };
        sendReceiptEmail(this.mailService, receiptData, this.logger).catch(() => {
          this.logger.warn(`[Deactivate:Single:X] Receipt email failed but status updated to PAID: ${invoiceNo}`);
        });
        return;
      }

      this.logger.log(`[Deactivate:Single:3] ToyyibPay confirms no payment — proceeding with deactivation`);
    }

    const paymentCredential = await this.businessInfoService.getPaymentIntegrationCredential(rawBusinessId);

    if (invoice.billCode) {
      await ToyyibPayUtil.deactivateBill(invoice.billCode, paymentCredential.userSecretKey);
      this.logger.log(`[Deactivate:Single:4] ToyyibPay bill deactivated for ${invoiceNo}`);
    }

    await cancelInvoice(this.prisma, invoiceNo, this.logger);
    this.logger.log(`[Deactivate:Single:5] Invoice ${invoiceNo} cancelled in DB (triggered by user ${userId})`);
  }

  /**
   * Queue a batch of invoice notification emails for async processing.
   * Verifies ownership at HTTP time; consumer processes with 1.5 s gap between sends.
   */
  async queueNotifyEmailBatch(
    encodedBusinessId: string,
    invoiceNumbers: string[],
    userId: string,
  ): Promise<void> {
    this.logger.log(`[NotifyEmail:1] Verifying ownership for user ${userId}`);
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

    this.logger.log(`[NotifyEmail:2] Ownership verified — decoding businessId`);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    this.logger.log(`[NotifyEmail:3] Emitting batch of ${invoiceNumbers.length} invoice(s) to queue — [${invoiceNumbers.join(', ')}]`);
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.NOTIFY_INVOICE_EMAIL, { rawBusinessId, invoiceNumbers, userId } as NotifyEmailMessage);
    this.logger.log(`[NotifyEmail:4] Batch queued successfully by user ${userId}`);
  }

  /**
   * Process a single invoice email notification from the queue.
   * Each invoice is an independent queue message — no loop, no delay.
   */
  async processNotifyEmailSingle(data: NotifyEmailMessage): Promise<void> {
    this.logger.log(`[NotifyEmail:Consumer:1] Processing batch of ${data.invoiceNumbers.length} invoice(s) — [${data.invoiceNumbers.join(', ')}]`);
    for (const invoiceNo of data.invoiceNumbers) {
      await this.sendSingleInvoiceEmail(data.rawBusinessId, invoiceNo, data.userId);
      this.logger.log(`[NotifyEmail:Consumer:2] ${invoiceNo} — email sent successfully`);
      await new Promise(resolve => setTimeout(resolve, INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS));
    }
  }

  /**
   * Send notification email for a single invoice.
   * Throws if invoice not found, belongs to different business, or is PAID/CANCELLED.
   * @private
   */
  private async sendSingleInvoiceEmail(rawBusinessId: string, invoiceNo: string, userId: string): Promise<void> {
    this.logger.log(`[NotifyEmail:Send:1] Fetching invoice ${invoiceNo} from DB`);
    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    this.logger.log(`[NotifyEmail:Send:2] Invoice found — status: ${invoice.status}, businessId: ${invoice.businessId}`);

    if (invoice.businessId !== rawBusinessId) {
      this.logger.warn(`[NotifyEmail:Send:X] BusinessId mismatch — invoice belongs to ${invoice.businessId}, expected ${rawBusinessId}`);
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      this.logger.warn(`[NotifyEmail:Send:X] Skipping ${invoiceNo} — status is ${invoice.status}`);
      throw new HttpException('Cannot send notification for a paid or cancelled invoice', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`[NotifyEmail:Send:3] Decrypting recipient/supplier fields`);
    const processedInvoice: ProcessedInvoiceDto = {
      invoiceNo: invoice.invoiceNo,
      invoiceType: invoice.invoiceType,
      originalInvoiceRef: invoice.originalInvoiceRef ?? undefined,
      currency: invoice.currency,
      status: invoice.status,
      issuedDate: invoice.issuedDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      supplier: this.decryptSupplier(invoice.supplier as unknown as SupplierDTO),
      recipient: this.decryptRecipient(invoice.recipient as unknown as RecipientDTO),
      items: invoice.items as any as InvoiceItemDTO[],
      totalNetAmount: parseFloat(invoice.totalNetAmount.toString()),
      totalTaxAmount: parseFloat(invoice.totalTaxAmount.toString()),
      totalDiscountAmount: parseFloat(invoice.totalDiscountAmount.toString()),
      totalPayableAmount: parseFloat(invoice.totalPayableAmount.toString()),
      billCode: invoice.billCode ?? undefined,
      billUrl: invoice.billUrl ?? undefined,
      invoiceVersion: invoice.invoiceVersion,
    };

    this.logger.log(`[NotifyEmail:Send:4] Calling sendInvoiceEmail for ${invoiceNo} → recipient: ${processedInvoice.recipient.email}`);
    await sendInvoiceEmail(this.mailService, processedInvoice, this.logger);
    this.logger.log(`[NotifyEmail:Send:5] Email dispatched for ${invoiceNo} (triggered by user ${userId})`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Ensure a DRAFT invoice record exists for the given invoice number.
   * Creates one (with encrypted sensitive fields) if not found; otherwise logs resume.
   * @private
   */
  private async ensureInvoiceDraftExists(
    calculatedInvoice: CalculatedInvoiceDto,
    businessId: string,
  ) {
    let existingInvoice = await findInvoiceByNumber(this.prisma, calculatedInvoice.invoiceNo, this.logger);

    if (!existingInvoice) {
      await createInvoice(
        this.prisma,
        {
          ...calculatedInvoice,
          status: 'DRAFT',
          recipient: this.encryptRecipient(calculatedInvoice.recipient),
          supplier: this.encryptSupplier(calculatedInvoice.supplier),
        },
        businessId,
        this.logger,
      );
      existingInvoice = await findInvoiceByNumber(this.prisma, calculatedInvoice.invoiceNo, this.logger);
    } else {
      this.logger.log(`Invoice ${calculatedInvoice.invoiceNo} already exists (${existingInvoice.status}) — resuming`);
    }

    return existingInvoice;
  }

  /**
   * Ensure a ToyyibPay bill code exists for the invoice.
   * Calls processPaymentIntegration + saveBillUrl only if billCode is not yet persisted.
   * @private
   */
  private async ensureBillCode(
    existingInvoice: Awaited<ReturnType<typeof findInvoiceByNumber>>,
    calculatedInvoice: CalculatedInvoiceDto,
    credential: PaymentIntegrationCredential,
  ): Promise<ProcessedInvoiceDto> {
    if (!existingInvoice.billCode) {
      const processedInvoice = await processPaymentIntegration(calculatedInvoice, credential, this.logger);
      await saveBillUrl(this.prisma, calculatedInvoice.invoiceNo, processedInvoice.billCode, processedInvoice.billUrl, this.logger);
      return processedInvoice;
    }

    this.logger.log(`Invoice ${calculatedInvoice.invoiceNo} already has billCode — skipping ToyyibPay`);
    return {
      ...calculatedInvoice,
      billCode: existingInvoice.billCode,
      billUrl: existingInvoice.billUrl,
      status: existingInvoice.status,
    };
  }

  /**
   * Core payment callback processing — shared by first attempt and retries.
   * Throws on failure so callers can handle retry logic.
   * @private
   */
  private async executePaymentCallbackCore(callbackData: ToyyibPayCallbackData): Promise<void> {
    this.logger.log(`Processing payment callback for invoice: ${callbackData.order_id}`);

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
      throw new Error(`No matching transaction for invoiceNo=${invoiceNo} in billCode=${callbackData.billcode}`);
    }

    this.logger.log(`[Callback] Matched transaction — billpaymentStatus: ${match.billpaymentStatus}`);

    const paymentStatus = match.billpaymentStatus === '1' ? InvoiceStatus.PAID : invoice.status;

    // Use billPaymentDate from getBillTransactions — more reliable than callbackData.transaction_time
    const sanitizedTransactionTime = this.parseBillPaymentDate(match.billPaymentDate);

    // Step 3: Update invoice status in DB
    const updateData: UpdateInvoiceStatusData = {
      invoiceNo,
      status: paymentStatus,
      transactionId: callbackData.transaction_id,
      transactionTime: sanitizedTransactionTime,
    };

    await updateInvoiceStatus(this.prisma, updateData, this.logger);
    this.logger.log(`[Callback] Invoice ${invoiceNo} status updated to ${paymentStatus}`);

    // Step 4: Send receipt email if paid (fire & forget — duplicate receipts are acceptable)
    if (paymentStatus === InvoiceStatus.PAID) {
      const rawReceipt = await getInvoiceAsReceipt(this.prisma, invoiceNo, this.logger);
      const receiptData: ReceiptDTO = {
        ...rawReceipt,
        recipient: this.decryptRecipient(rawReceipt.recipient),
        supplier: this.decryptSupplier(rawReceipt.supplier),
      };

      sendReceiptEmail(this.mailService, receiptData, this.logger).catch(() => {
        this.logger.warn(`Receipt email failed but payment processed: ${invoiceNo}`);
      });
    }

    this.logger.log(`Payment callback processed successfully: ${invoiceNo}`);
  }

  /**
   * Queue a batch of invoices to be marked as paid for async processing.
   * Verifies ownership at HTTP time; consumer syncs each invoice against ToyyibPay.
   */
  async queueMarkInvoicePaidBatch(
    encodedBusinessId: string,
    invoiceNumbers: string[],
    userId: string,
  ): Promise<void> {
    this.logger.log(`[MarkPaid:1] Verifying ownership for user ${userId}`);
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

    this.logger.log(`[MarkPaid:2] Ownership verified — decoding businessId`);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    this.logger.log(`[MarkPaid:3] Emitting batch of ${invoiceNumbers.length} invoice(s) to queue — [${invoiceNumbers.join(', ')}]`);
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.MARK_INVOICE_AS_PAID, { rawBusinessId, invoiceNumbers, userId } as MarkInvoicePaidMessage);
    this.logger.log(`[MarkPaid:4] Batch queued successfully by user ${userId}`);
  }

  /**
   * Process a batch of mark-as-paid requests from the queue.
   */
  async processMarkInvoicePaidBatch(data: MarkInvoicePaidMessage): Promise<void> {
    this.logger.log(`[MarkPaid:Consumer:1] Processing batch of ${data.invoiceNumbers.length} invoice(s) — [${data.invoiceNumbers.join(', ')}]`);
    for (const invoiceNo of data.invoiceNumbers) {
      await this.markSingleInvoiceAsPaid(data.rawBusinessId, invoiceNo, data.userId);
      this.logger.log(`[MarkPaid:Consumer:2] ${invoiceNo} — processed`);
      await new Promise(resolve => setTimeout(resolve, INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS));
    }
  }

  /**
   * Mark a single invoice as paid.
   * If a billCode exists, ToyyibPay is the source of truth — only marks PAID if ToyyibPay confirms.
   * If no billCode, allows manual marking (offline/cash payment).
   * @private
   */
  private async markSingleInvoiceAsPaid(rawBusinessId: string, invoiceNo: string, userId: string): Promise<void> {
    this.logger.log(`[MarkPaid:Single:1] Fetching invoice ${invoiceNo} from DB`);
    const invoice = await findInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    if (!invoice) {
      throw new HttpException(`Invoice ${invoiceNo} not found`, HttpStatus.NOT_FOUND);
    }

    if (invoice.businessId !== rawBusinessId) {
      this.logger.warn(`[MarkPaid:Single:X] BusinessId mismatch — invoice belongs to ${invoice.businessId}, expected ${rawBusinessId}`);
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      this.logger.warn(`[MarkPaid:Single:X] Skipping ${invoiceNo} — already ${invoice.status}`);
      return;
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      this.logger.warn(`[MarkPaid:Single:X] Skipping ${invoiceNo} — status is ${invoice.status}`);
      return;
    }

    if (invoice.billCode) {
      // ToyyibPay is source of truth — verify payment before updating DB
      this.logger.log(`[MarkPaid:Single:2] Checking ToyyibPay for ${invoiceNo} (billCode=${invoice.billCode})`);
      const transactions = await ToyyibPayUtil.fetchBillTransactions(invoice.billCode);
      const paidTx = transactions.find(t => t.billExternalReferenceNo === invoiceNo && t.billpaymentStatus === '1');

      if (!paidTx) {
        this.logger.warn(`[MarkPaid:Single:X] ToyyibPay has no confirmed payment for ${invoiceNo} — skipping`);
        return;
      }

      this.logger.log(`[MarkPaid:Single:3] ToyyibPay confirms payment — updating DB to PAID`);
      await updateInvoiceStatus(this.prisma, {
        invoiceNo,
        status: InvoiceStatus.PAID,
        transactionId: paidTx.billpaymentInvoiceNo,
        transactionTime: this.parseBillPaymentDate(paidTx.billPaymentDate),
      }, this.logger);
    } else {
      // No online payment link — allow manual marking (offline/cash payment)
      this.logger.log(`[MarkPaid:Single:2] No billCode — manual mark as PAID for ${invoiceNo} (triggered by user ${userId})`);
      await updateInvoiceStatus(this.prisma, {
        invoiceNo,
        status: InvoiceStatus.PAID,
        transactionId: '',
        transactionTime: new Date().toISOString(),
      }, this.logger);
    }

    const rawReceipt = await getInvoiceAsReceipt(this.prisma, invoiceNo, this.logger);
    const receiptData: ReceiptDTO = {
      ...rawReceipt,
      recipient: this.decryptRecipient(rawReceipt.recipient),
      supplier: this.decryptSupplier(rawReceipt.supplier),
    };
    sendReceiptEmail(this.mailService, receiptData, this.logger).catch(() => {
      this.logger.warn(`[MarkPaid:Single:X] Receipt email failed but status updated to PAID: ${invoiceNo}`);
    });
    this.logger.log(`[MarkPaid:Single:4] Invoice ${invoiceNo} marked as PAID successfully`);
  }

  /**
   * @private
   */
  private async sendToRetryQueue(msg: RetryInvoiceMessage): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.RETRY_CREATE_INVOICE, msg);
    this.logger.log(`Invoice ${msg.calculatedInvoice.invoiceNo} emitted to retry-invoice (attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS})`);
  }

  /**
   * @private
   */
  private async sendToFailedQueue(businessId: string, calculatedInvoice: CalculatedInvoiceDto, error: Error): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.FAILED_CREATE_INVOICE, {
      businessId,
      calculatedInvoice,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
    this.logger.error(
      `Invoice ${calculatedInvoice.invoiceNo} permanently failed after ${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} attempts — moved to failed-invoice queue`,
    );
  }

  /**
   * @private
   */
  private async sendToPaymentRetryQueue(msg: RetryPaymentCallbackMessage): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.RETRY_INVOICE_PAYMENT_CALLBACK, msg);
    this.logger.log(
      `Payment callback for ${msg.callbackData.order_id} emitted to retry-payment-callback (attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS})`,
    );
  }

  /**
   * @private
   */
  private async sendToPaymentFailedQueue(callbackData: ToyyibPayCallbackData, error: Error): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.FAILED_INVOICE_PAYMENT_CALLBACK, {
      callbackData,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
    this.logger.error(
      `Payment callback for ${callbackData.order_id} permanently failed after ${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} attempts — moved to failed-payment-callback queue`,
    );
  }

  /**
   * Parse billPaymentDate from ToyyibPay getBillTransactions response.
   * Handles both 24h ("DD-MM-YYYY HH:MM:SS") and 12h ("DD-MM-YYYY HH:MM:SS am/pm") formats in MYT (UTC+8).
   * Returns UTC ISO string for DB storage.
   * @private
   */
  private parseBillPaymentDate(billPaymentDate: string): string {
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
   * Encrypt sensitive fields on a recipient before DB storage.
   * @private
   */
  private encryptRecipient(recipient: RecipientDTO): RecipientDTO {
    return {
      ...recipient,
      email: recipient.email ? this.cryptoService.encrypt(recipient.email) : recipient.email,
      phone: this.cryptoService.encrypt(recipient.phone),
      tin: recipient.tin ? this.cryptoService.encrypt(recipient.tin) : recipient.tin,
      registrationNumber: this.cryptoService.encrypt(recipient.registrationNumber),
    };
  }

  /**
   * Encrypt sensitive fields on a supplier before DB storage.
   * @private
   */
  private encryptSupplier(supplier: SupplierDTO): SupplierDTO {
    return {
      ...supplier,
      email: this.cryptoService.encrypt(supplier.email),
      tin: this.cryptoService.encrypt(supplier.tin),
      registrationNumber: this.cryptoService.encrypt(supplier.registrationNumber),
      msicCode: this.cryptoService.encrypt(supplier.msicCode),
      contactNumber: supplier.contactNumber ? this.cryptoService.encrypt(supplier.contactNumber) : undefined,
    };
  }

  /**
   * Decrypt sensitive fields on a recipient after DB retrieval.
   * @private
   */
  private decryptRecipient(recipient: RecipientDTO): RecipientDTO {
    return {
      ...recipient,
      email: recipient.email ? this.cryptoService.decrypt(recipient.email) : recipient.email,
      phone: this.cryptoService.decrypt(recipient.phone),
      tin: recipient.tin ? this.cryptoService.decrypt(recipient.tin) : recipient.tin,
      registrationNumber: this.cryptoService.decrypt(recipient.registrationNumber),
    };
  }

  /**
   * Decrypt sensitive fields on a supplier after DB retrieval.
   * @private
   */
  private decryptSupplier(supplier: SupplierDTO): SupplierDTO {
    return {
      ...supplier,
      email: this.cryptoService.decrypt(supplier.email),
      tin: this.cryptoService.decrypt(supplier.tin),
      registrationNumber: this.cryptoService.decrypt(supplier.registrationNumber),
      msicCode: this.cryptoService.decrypt(supplier.msicCode),
      contactNumber: supplier.contactNumber ? this.cryptoService.decrypt(supplier.contactNumber as string) : undefined,
    };
  }

  /**
   * Resolves after the given number of milliseconds.
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
