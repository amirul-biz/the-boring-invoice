import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InvoiceStatus } from '@prisma/client';

import { PrismaService } from '@prismaService';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { BusinessInfoService } from '../business-info/business-info-service';
import { PaymentIntegrationCredential } from '../business-info/business-info-interface';
import { CryptoService } from '../crypto/crypto.service';

import { CalculatedInvoiceDto, CreateInvoiceInputDTO, ProcessedInvoiceDto } from './invoice-dto';
import { CreateInvoiceMessage, FailedInvoiceMessage, RetryInvoiceMessage } from './invoice-messages';
import { calculateInvoiceData } from './invoice-utility/invoice-utility-calculation';
import { processPaymentIntegration } from './invoice-utility/invoice-utility-payment-integration';
import { sendInvoiceEmail } from './invoice-utility/invoice-utility-email-sender';
import { encryptRecipient, encryptSupplier } from './invoice-utility/invoice-utility-crypto';
import { createInvoice } from './invoice-repository/invoice-repository-create';
import { saveBillUrl, setPendingStatus, cancelInvoice } from './invoice-repository/invoice-repository-update-status';
import { findInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { ToyyibPayUtil } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from './invoice.constants';

@Injectable()
export class InvoiceCreateService {
  private readonly logger = new Logger(InvoiceCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailerService,
    private readonly queueService: RabbitMqProducerService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  async queueInvoiceGeneration(
    invoiceDataList: CreateInvoiceInputDTO[],
    encodedBusinessId: string,
    userId: string,
  ): Promise<{ message: string; timestamp: string }> {
    try {
      this.logger.log(`Queueing ${invoiceDataList.length} invoice(s) for generation`);

      await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);

      const businessId = this.cryptoService.decodeId(encodedBusinessId);

      const calculatedInvoiceList = await Promise.all(
        invoiceDataList.map(invoiceData => calculateInvoiceData(invoiceData, this.logger)),
      );

      await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.CREATE_INVOICE, { businessId, calculatedInvoiceList } as CreateInvoiceMessage);

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

      if (isDraft) {
        await setPendingStatus(this.prisma, calculatedInvoice.invoiceNo, this.logger);
      } else {
        this.logger.log(`Invoice ${calculatedInvoice.invoiceNo} already ${existingInvoice.status} — skipping setPendingStatus`);
      }

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

  async processInvoiceBatch(businessId: string, calculatedInvoiceList: CalculatedInvoiceDto[]): Promise<void> {
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

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async ensureInvoiceDraftExists(calculatedInvoice: CalculatedInvoiceDto, businessId: string) {
    let existingInvoice = await findInvoiceByNumber(this.prisma, calculatedInvoice.invoiceNo, this.logger);

    if (!existingInvoice) {
      await createInvoice(
        this.prisma,
        {
          ...calculatedInvoice,
          status: 'DRAFT',
          recipient: encryptRecipient(calculatedInvoice.recipient, this.cryptoService),
          supplier: encryptSupplier(calculatedInvoice.supplier, this.cryptoService),
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

  private async sendToRetryQueue(msg: RetryInvoiceMessage): Promise<void> {
    await this.queueService.sendMessageQue(INVOICE_QUEUE_PATTERNS.RETRY_CREATE_INVOICE, msg);
    this.logger.log(`Invoice ${msg.calculatedInvoice.invoiceNo} emitted to retry-invoice (attempt ${msg.attemptNo}/${INVOICE_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS})`);
  }

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
