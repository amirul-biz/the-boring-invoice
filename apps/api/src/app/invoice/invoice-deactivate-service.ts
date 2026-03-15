import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InvoiceStatus } from '@prisma/client';

import { PrismaService } from '@prismaService';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { BusinessInfoService } from '../business-info/business-info-service';
import { CryptoService } from '../crypto/crypto.service';

import { ReceiptDTO } from './invoice-dto';
import { DeactivateMessage, RetryDeactivateMessage } from './invoice-messages';
import { sendReceiptEmail } from './invoice-utility/invoice-utility-email-sender';
import { parseBillPaymentDate } from './invoice-utility/invoice-utility-payment-integration';
import { decryptRecipient, decryptSupplier } from './invoice-utility/invoice-utility-crypto';
import { updateInvoiceStatus, cancelInvoice } from './invoice-repository/invoice-repository-update-status';
import { findInvoiceByNumber, getInvoiceAsReceipt } from './invoice-repository/invoice-repository-get';
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from './invoice.constants';

@Injectable()
export class InvoiceDeactivateService {
  private readonly logger = new Logger(InvoiceDeactivateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  async queueDeactivateBatch(encodedBusinessId: string, invoiceNumbers: string[], userId: string): Promise<void> {
    this.logger.log(`[Deactivate:1] Verifying ownership for user ${userId}`);
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

    this.logger.log(`[Deactivate:2] Ownership verified — decoding businessId`);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    this.logger.log(`[Deactivate:3] Emitting batch of ${invoiceNumbers.length} invoice(s) to queue — [${invoiceNumbers.join(', ')}]`);
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.DEACTIVATE_INVOICE_BILL, { rawBusinessId, invoiceNumbers, userId } as DeactivateMessage);
    this.logger.log(`[Deactivate:4] Batch queued successfully by user ${userId}`);
  }

  async processDeactivateSingle(data: DeactivateMessage): Promise<void> {
    this.logger.log(`[Deactivate:Consumer:1] Processing batch of ${data.invoiceNumbers.length} invoice(s) — [${data.invoiceNumbers.join(', ')}]`);
    for (const [index, invoiceNo] of data.invoiceNumbers.entries()) {
      try {
        await this.deactivateSingleInvoice(data.rawBusinessId, invoiceNo, data.userId);
        this.logger.log(`[Deactivate:Consumer:2] ${invoiceNo} — deactivated successfully`);
      } catch (error) {
        this.logger.error(`[Deactivate:Consumer:X] ${invoiceNo} failed — emitting to retry queue: ${error.message}`, error.stack);
        try {
          await this.sendToDeactivateRetryQueue({ rawBusinessId: data.rawBusinessId, invoiceNo, userId: data.userId, attemptNo: INVOICE_QUEUE_CONFIG.INITIAL_RETRY_ATTEMPT });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue deactivate retry for ${invoiceNo} — message lost: ${queueError.message}`);
        }
      }
      const isLastItem = index === data.invoiceNumbers.length - 1;
      if (!isLastItem) {
        await this.delay(INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS);
      }
    }
  }

  async processDeactivateRetry(msg: RetryDeactivateMessage): Promise<void> {
    this.logger.log(`[Deactivate:Retry] Attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} for ${msg.invoiceNo} — waiting 1 minute`);
    await this.delay(INVOICE_QUEUE_CONFIG.RETRY_DELAY_MS);

    try {
      await this.deactivateSingleInvoice(msg.rawBusinessId, msg.invoiceNo, msg.userId);
      this.logger.log(`[Deactivate:Retry] Attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} succeeded for ${msg.invoiceNo}`);
    } catch (error) {
      this.logger.error(`[Deactivate:Retry] Attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} failed for ${msg.invoiceNo}: ${error.message}`, error.stack);
      if (msg.attemptNo < INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS) {
        try {
          await this.sendToDeactivateRetryQueue({ ...msg, attemptNo: msg.attemptNo + 1 });
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to re-queue deactivate retry for ${msg.invoiceNo}: ${queueError.message}`);
        }
      } else {
        try {
          await this.sendToDeactivateFailedQueue(msg, error);
        } catch (queueError) {
          this.logger.error(`CRITICAL: Failed to queue failed-deactivate for ${msg.invoiceNo}: ${queueError.message}`);
        }
      }
    }
  }

  async processDeactivateFailed(msg: RetryDeactivateMessage & { error: string; failedAt: string }): Promise<void> {
    this.logger.error(`[Deactivate:Failed] Invoice ${msg.invoiceNo} permanently failed deactivation after ${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} attempts — error: ${msg.error}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

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

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      this.logger.warn(`[Deactivate:Single:X] Skipping ${invoiceNo} — already ${invoice.status}`);
      return;
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      this.logger.warn(`[Deactivate:Single:X] Skipping ${invoiceNo} — status is ${invoice.status}`);
      return;
    }

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
          transactionTime: parseBillPaymentDate(paidTx.billPaymentDate),
        }, this.logger);

        const rawReceipt = await getInvoiceAsReceipt(this.prisma, invoiceNo, this.logger);
        const receiptData: ReceiptDTO = {
          ...rawReceipt,
          recipient: decryptRecipient(rawReceipt.recipient, this.cryptoService),
          supplier: decryptSupplier(rawReceipt.supplier, this.cryptoService),
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

  private async sendToDeactivateRetryQueue(msg: RetryDeactivateMessage): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.RETRY_DEACTIVATE_INVOICE_BILL, msg);
    this.logger.log(`Invoice ${msg.invoiceNo} emitted to retry-deactivate (attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS})`);
  }

  private async sendToDeactivateFailedQueue(msg: RetryDeactivateMessage, error: Error): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.FAILED_DEACTIVATE_INVOICE_BILL, {
      ...msg,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
    this.logger.error(`Invoice ${msg.invoiceNo} permanently failed deactivation after ${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS} attempts — moved to failed-deactivate queue`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
