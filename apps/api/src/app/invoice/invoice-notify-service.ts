import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InvoiceStatus } from '@prisma/client';

import { PrismaService } from '@prismaService';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { BusinessInfoService } from '../business-info/business-info-service';
import { CryptoService } from '../crypto/crypto.service';

import { InvoiceItemDTO, ProcessedInvoiceDto } from './invoice-dto';
import { NotifyInvoiceViaEmailMessage } from './invoice-messages';
import { sendInvoiceEmail } from './invoice-utility/invoice-utility-email-sender';
import { decryptRecipient, decryptSupplier } from './invoice-utility/invoice-utility-crypto';
import { getInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from './invoice.constants';

@Injectable()
export class InvoiceNotifyService {
  private readonly logger = new Logger(InvoiceNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  async queueNotifyInvoiceViaEmailBatch(encodedBusinessId: string, invoiceNumbers: string[], userId: string): Promise<void> {
    this.logger.log(`[NotifyInvoiceViaEmail:1] Verifying ownership for user ${userId}`);
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

    this.logger.log(`[NotifyInvoiceViaEmail:2] Ownership verified — decoding businessId`);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    this.logger.log(`[NotifyInvoiceViaEmail:3] Emitting batch of ${invoiceNumbers.length} invoice(s) to queue — [${invoiceNumbers.join(', ')}]`);
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.NOTIFY_INVOICE_VIA_EMAIL, { rawBusinessId, invoiceNumbers, userId } as NotifyInvoiceViaEmailMessage);
    this.logger.log(`[NotifyInvoiceViaEmail:4] Batch queued successfully by user ${userId}`);
  }

  async processNotifyInvoiceViaEmailBatch(data: NotifyInvoiceViaEmailMessage): Promise<void> {
    this.logger.log(`[NotifyInvoiceViaEmail:Consumer:1] Processing batch of ${data.invoiceNumbers.length} invoice(s) — [${data.invoiceNumbers.join(', ')}]`);
    for (const invoiceNo of data.invoiceNumbers) {
      try {
        await this.sendSingleInvoiceEmail(data.rawBusinessId, invoiceNo, data.userId);
        this.logger.log(`[NotifyInvoiceViaEmail:Consumer:2] ${invoiceNo} — email sent successfully`);
      } catch (error) {
        this.logger.error(`[NotifyInvoiceViaEmail:Consumer:X] ${invoiceNo} — skipped: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, INVOICE_QUEUE_CONFIG.BATCH_DELAY_MS));
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async sendSingleInvoiceEmail(rawBusinessId: string, invoiceNo: string, userId: string): Promise<void> {
    this.logger.log(`[NotifyInvoiceViaEmail:Send:1] Fetching invoice ${invoiceNo} from DB`);
    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    this.logger.log(`[NotifyInvoiceViaEmail:Send:2] Invoice found — status: ${invoice.status}, businessId: ${invoice.businessId}`);

    if (invoice.businessId !== rawBusinessId) {
      this.logger.warn(`[NotifyInvoiceViaEmail:Send:X] BusinessId mismatch — invoice belongs to ${invoice.businessId}, expected ${rawBusinessId}`);
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      this.logger.warn(`[NotifyInvoiceViaEmail:Send:X] Skipping ${invoiceNo} — status is ${invoice.status}`);
      throw new HttpException('Cannot send notification for a paid or cancelled invoice', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`[NotifyInvoiceViaEmail:Send:3] Decrypting recipient/supplier fields`);
    const processedInvoice: ProcessedInvoiceDto = {
      invoiceNo: invoice.invoiceNo,
      invoiceType: invoice.invoiceType,
      originalInvoiceRef: invoice.originalInvoiceRef ?? undefined,
      currency: invoice.currency,
      status: invoice.status,
      issuedDate: invoice.issuedDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      supplier: decryptSupplier(invoice.supplier as any, this.cryptoService),
      recipient: decryptRecipient(invoice.recipient as any, this.cryptoService),
      items: invoice.items as any as InvoiceItemDTO[],
      totalNetAmount: parseFloat(invoice.totalNetAmount.toString()),
      totalTaxAmount: parseFloat(invoice.totalTaxAmount.toString()),
      totalDiscountAmount: parseFloat(invoice.totalDiscountAmount.toString()),
      totalPayableAmount: parseFloat(invoice.totalPayableAmount.toString()),
      billCode: invoice.billCode ?? undefined,
      billUrl: invoice.billUrl ?? undefined,
      invoiceVersion: invoice.invoiceVersion,
    };

    this.logger.log(`[NotifyInvoiceViaEmail:Send:4] Calling sendInvoiceEmail for ${invoiceNo} → recipient: ${processedInvoice.recipient.email}`);
    await sendInvoiceEmail(this.mailService, processedInvoice, this.logger);
    this.logger.log(`[NotifyInvoiceViaEmail:Send:5] Email dispatched for ${invoiceNo} (triggered by user ${userId})`);
  }
}
