import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InvoiceStatus } from '@prisma/client';

import { PrismaService } from '@prismaService';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { CryptoService } from '../crypto/crypto.service';

import { ReceiptDTO } from './invoice-dto';
import { RetryPaymentCallbackMessage, ToyyibPayCallbackData } from './invoice-messages';
import { sendReceiptEmail } from './invoice-utility/invoice-utility-email-sender';
import { parseBillPaymentDate } from './invoice-utility/invoice-utility-payment-integration';
import { decryptRecipient, decryptSupplier } from './invoice-utility/invoice-utility-crypto';
import { updateInvoiceStatus, UpdateInvoiceStatusData } from './invoice-repository/invoice-repository-update-status';
import { getInvoiceAsReceipt, getInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from './invoice.constants';

@Injectable()
export class InvoicePaymentCallbackService {
  private readonly logger = new Logger(InvoicePaymentCallbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly cryptoService: CryptoService,
  ) {}

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

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async executePaymentCallbackCore(callbackData: ToyyibPayCallbackData): Promise<void> {
    this.logger.log(`Processing payment callback for invoice: ${callbackData.order_id}`);

    const invoiceNo = callbackData.order_id;
    this.logger.log(`[Callback] order_id=${invoiceNo} billcode=${callbackData.billcode}`);

    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    this.logger.log(`[Callback] Invoice found: ${invoice.invoiceNo} — current status: ${invoice.status}`);

    // Fetch only confirmed (status=1) transactions from ToyyibPay — source of truth
    const transactions = await ToyyibPayUtil.fetchBillTransactions(callbackData.billcode, '1');
    this.logger.log(`[Callback] getBillTransactions returned ${transactions.length} confirmed payment(s) for billCode=${callbackData.billcode}`);
    transactions.forEach((t, i) => {
      this.logger.log(`[Callback] tx[${i}] billExternalReferenceNo=${t.billExternalReferenceNo} billpaymentStatus=${t.billpaymentStatus} billpaymentInvoiceNo=${t.billpaymentInvoiceNo}`);
    });

    const match = transactions.find(t => t.billExternalReferenceNo === invoiceNo);
    this.logger.log(`[Callback] match for invoiceNo=${invoiceNo}: ${match ? 'FOUND' : 'NOT FOUND'}`);
    if (!match) {
      throw new Error(`No confirmed payment for invoiceNo=${invoiceNo} in billCode=${callbackData.billcode} — will retry`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      this.logger.log(`[Callback] Invoice ${invoiceNo} already PAID — skipping`);
      return;
    }

    const updateData: UpdateInvoiceStatusData = {
      invoiceNo,
      status: InvoiceStatus.PAID,
      transactionId: callbackData.transaction_id,
      transactionTime: parseBillPaymentDate(match.billPaymentDate),
    };

    await updateInvoiceStatus(this.prisma, updateData, this.logger);
    this.logger.log(`[Callback] Invoice ${invoiceNo} updated to PAID`);

    const rawReceipt = await getInvoiceAsReceipt(this.prisma, invoiceNo, this.logger);
    const receiptData: ReceiptDTO = {
      ...rawReceipt,
      recipient: decryptRecipient(rawReceipt.recipient, this.cryptoService),
      supplier: decryptSupplier(rawReceipt.supplier, this.cryptoService),
    };

    sendReceiptEmail(this.mailService, receiptData, this.logger).catch(() => {
      this.logger.warn(`Receipt email failed but payment processed: ${invoiceNo}`);
    });

    this.logger.log(`Payment callback processed successfully: ${invoiceNo}`);
  }

  private async sendToPaymentRetryQueue(msg: RetryPaymentCallbackMessage): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.RETRY_INVOICE_PAYMENT_CALLBACK, msg);
    this.logger.log(
      `Payment callback for ${msg.callbackData.order_id} emitted to retry-payment-callback (attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS})`,
    );
  }

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
