import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InvoiceStatus } from '@prisma/client';

import { PrismaService } from '@prismaService';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { BusinessInfoService } from '../business-info/business-info-service';
import { CryptoService } from '../crypto/crypto.service';

import { ReceiptDTO } from './invoice-dto';
import { MarkInvoicePaidMessage, RetryMarkPaidMessage } from './invoice-messages';
import { sendReceiptEmail } from './invoice-utility/invoice-utility-email-sender';
import { parseBillPaymentDate } from './invoice-utility/invoice-utility-payment-integration';
import { decryptRecipient, decryptSupplier } from './invoice-utility/invoice-utility-crypto';
import { updateInvoiceStatus } from './invoice-repository/invoice-repository-update-status';
import { findInvoiceByNumber, getInvoiceAsReceipt } from './invoice-repository/invoice-repository-get';
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from './invoice.constants';

@Injectable()
export class InvoiceMarkPaidService {
  private readonly logger = new Logger(InvoiceMarkPaidService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  async queueMarkInvoicePaidBatch(encodedBusinessId: string, invoiceNumbers: string[], userId: string): Promise<void> {
    this.logger.log(`[MarkPaid:1] Verifying ownership for user ${userId}`);
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

    this.logger.log(`[MarkPaid:2] Ownership verified — decoding businessId`);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    this.logger.log(`[MarkPaid:3] Emitting batch of ${invoiceNumbers.length} invoice(s) to queue — [${invoiceNumbers.join(', ')}]`);
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.MARK_INVOICE_AS_PAID, { rawBusinessId, invoiceNumbers, userId } as MarkInvoicePaidMessage);
    this.logger.log(`[MarkPaid:4] Batch queued successfully by user ${userId}`);
  }

  async processMarkInvoicePaidBatch(data: MarkInvoicePaidMessage): Promise<void> {
    this.logger.log(`[MarkPaid:Consumer:1] Processing batch of ${data.invoiceNumbers.length} invoice(s) — [${data.invoiceNumbers.join(', ')}]`);
    for (const [index, invoiceNo] of data.invoiceNumbers.entries()) {
      try {
        await this.markSingleInvoiceAsPaid(data.rawBusinessId, invoiceNo, data.userId);
        this.logger.log(`[MarkPaid:Consumer:2] ${invoiceNo} — processed`);
      } catch (error) {
        this.logger.error(`[MarkPaid:Consumer:X] ${invoiceNo} failed — emitting to retry queue: ${error.message}`, error.stack);
        try {
          await this.sendToMarkPaidRetryQueue({ rawBusinessId: data.rawBusinessId, invoiceNo, userId: data.userId, attemptNo: INVOICE_QUEUE_CONFIG.INITIAL_RETRY_ATTEMPT });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue mark-paid retry for ${invoiceNo} — message lost: ${queueError.message}`);
        }
      }
      const isLastItem = index === data.invoiceNumbers.length - 1;
      if (!isLastItem) {
        await this.delay(INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS);
      }
    }
  }

  async processMarkPaidRetry(msg: RetryMarkPaidMessage): Promise<void> {
    this.logger.log(`[MarkPaid:Retry] Attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} for ${msg.invoiceNo} — waiting 1 minute`);
    await this.delay(INVOICE_QUEUE_CONFIG.RETRY_DELAY_MS);

    try {
      await this.markSingleInvoiceAsPaid(msg.rawBusinessId, msg.invoiceNo, msg.userId);
      this.logger.log(`[MarkPaid:Retry] Attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} succeeded for ${msg.invoiceNo}`);
    } catch (error) {
      this.logger.error(`[MarkPaid:Retry] Attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} failed for ${msg.invoiceNo}: ${error.message}`, error.stack);
      if (msg.attemptNo < INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS) {
        try {
          await this.sendToMarkPaidRetryQueue({ ...msg, attemptNo: msg.attemptNo + 1 });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to re-queue mark-paid retry for ${msg.invoiceNo}: ${queueError.message}`);
        }
      } else {
        try {
          await this.sendToMarkPaidFailedQueue(msg, error);
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue failed-mark-paid for ${msg.invoiceNo}: ${queueError.message}`);
        }
      }
    }
  }

  async processMarkPaidFailed(msg: RetryMarkPaidMessage & { error: string; failedAt: string }): Promise<void> {
    this.logger.error(`[MarkPaid:Failed] Invoice ${msg.invoiceNo} permanently failed mark-as-paid after ${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} attempts — error: ${msg.error}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

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
      this.logger.log(`[MarkPaid:Single:2] Checking ToyyibPay for ${invoiceNo} (billCode=${invoice.billCode})`);
      const transactions = await ToyyibPayUtil.fetchBillTransactions(invoice.billCode, '1');
      this.logger.log(`[MarkPaid:Single:2] getBillTransactions returned ${transactions.length} confirmed payment(s) for billCode=${invoice.billCode}`);
      transactions.forEach((t, i) => {
        this.logger.log(`[MarkPaid:Single:2] tx[${i}] billExternalReferenceNo=${t.billExternalReferenceNo} billpaymentStatus=${t.billpaymentStatus} billpaymentInvoiceNo=${t.billpaymentInvoiceNo}`);
      });

      const paidTx = transactions.find(t => t.billExternalReferenceNo === invoiceNo);
      this.logger.log(`[MarkPaid:Single:2] match for invoiceNo=${invoiceNo}: ${paidTx ? 'FOUND' : 'NOT FOUND'}`);

      if (!paidTx) {
        this.logger.warn(`[MarkPaid:Single:X] ToyyibPay has no confirmed payment for ${invoiceNo} — skipping`);
        return;
      }

      this.logger.log(`[MarkPaid:Single:3] ToyyibPay confirms payment — updating DB to PAID`);
      await updateInvoiceStatus(this.prisma, {
        invoiceNo,
        status: InvoiceStatus.PAID,
        transactionId: paidTx.billpaymentInvoiceNo,
        transactionTime: parseBillPaymentDate(paidTx.billPaymentDate),
      }, this.logger);
    } else {
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
      recipient: decryptRecipient(rawReceipt.recipient, this.cryptoService),
      supplier: decryptSupplier(rawReceipt.supplier, this.cryptoService),
    };
    sendReceiptEmail(this.mailService, receiptData, this.logger).catch(() => {
      this.logger.warn(`[MarkPaid:Single:X] Receipt email failed but status updated to PAID: ${invoiceNo}`);
    });
    this.logger.log(`[MarkPaid:Single:4] Invoice ${invoiceNo} marked as PAID successfully`);
  }

  private async sendToMarkPaidRetryQueue(msg: RetryMarkPaidMessage): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.RETRY_MARK_INVOICE_AS_PAID, msg);
    this.logger.log(`Invoice ${msg.invoiceNo} emitted to retry-mark-paid (attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS})`);
  }

  private async sendToMarkPaidFailedQueue(msg: RetryMarkPaidMessage, error: Error): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.FAILED_MARK_INVOICE_AS_PAID, {
      ...msg,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
    this.logger.error(`Invoice ${msg.invoiceNo} permanently failed mark-as-paid after ${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} attempts — moved to failed-mark-paid queue`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
