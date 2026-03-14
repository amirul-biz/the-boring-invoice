import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { rabbitMQInvoiceConfig } from './rabbit-mq-invoice.config';
import { rabbitMQPaymentConfig } from './rabbit-mq-payment.config';
import { rabbitMQNotifyInvoiceViaEmailConfig } from './rabbit-mq-notify-invoice-via-email.config';
import { rabbitMQDeactivateBillConfig } from './rabbit-mq-deactivate-bill.config';
import { rabbitMQRetryDeactivateBillConfig } from './rabbit-mq-retry-deactivate-bill.config';
import { rabbitMQFailedDeactivateBillConfig } from './rabbit-mq-failed-deactivate-bill.config';
import { rabbitMQMarkInvoicePaidConfig } from './rabbit-mq-mark-invoice-paid.config';
import { rabbitMQRetryMarkInvoicePaidConfig } from './rabbit-mq-retry-mark-invoice-paid.config';
import { rabbitMQFailedMarkInvoicePaidConfig } from './rabbit-mq-failed-mark-invoice-paid.config';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from '../invoice/invoice.constants';

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqProducerService.name);
  private invoiceClient: ClientProxy;
  private paymentClient: ClientProxy;
  private notifyInvoiceViaEmailClient: ClientProxy;
  private deactivateBillClient: ClientProxy;
  private retryDeactivateBillClient: ClientProxy;
  private failedDeactivateBillClient: ClientProxy;
  private markInvoicePaidClient: ClientProxy;
  private retryMarkInvoicePaidClient: ClientProxy;
  private failedMarkInvoicePaidClient: ClientProxy;

  constructor() {
    this.invoiceClient = ClientProxyFactory.create(rabbitMQInvoiceConfig(true));
    this.paymentClient = ClientProxyFactory.create(rabbitMQPaymentConfig(true));
    this.notifyInvoiceViaEmailClient = ClientProxyFactory.create(rabbitMQNotifyInvoiceViaEmailConfig(true));
    this.deactivateBillClient = ClientProxyFactory.create(rabbitMQDeactivateBillConfig(true));
    this.retryDeactivateBillClient = ClientProxyFactory.create(rabbitMQRetryDeactivateBillConfig(true));
    this.failedDeactivateBillClient = ClientProxyFactory.create(rabbitMQFailedDeactivateBillConfig(true));
    this.markInvoicePaidClient = ClientProxyFactory.create(rabbitMQMarkInvoicePaidConfig(true));
    this.retryMarkInvoicePaidClient = ClientProxyFactory.create(rabbitMQRetryMarkInvoicePaidConfig(true));
    this.failedMarkInvoicePaidClient = ClientProxyFactory.create(rabbitMQFailedMarkInvoicePaidConfig(true));
  }

  async onModuleInit() {
    await this.invoiceClient.connect();
    this.logger.log('Invoice queue producer connected');
    await this.paymentClient.connect();
    this.logger.log('Payment queue producer connected');
    await this.notifyInvoiceViaEmailClient.connect();
    this.logger.log('Notify-invoice-via-email queue producer connected');
    await this.deactivateBillClient.connect();
    this.logger.log('Deactivate bill queue producer connected');
    await this.retryDeactivateBillClient.connect();
    this.logger.log('Retry-deactivate-bill queue producer connected');
    await this.failedDeactivateBillClient.connect();
    this.logger.log('Failed-deactivate-bill queue producer connected');
    await this.markInvoicePaidClient.connect();
    this.logger.log('Mark-invoice-paid queue producer connected');
    await this.retryMarkInvoicePaidClient.connect();
    this.logger.log('Retry-mark-invoice-paid queue producer connected');
    await this.failedMarkInvoicePaidClient.connect();
    this.logger.log('Failed-mark-invoice-paid queue producer connected');
  }

  async onModuleDestroy() {
    await this.invoiceClient.close();
    this.logger.log('Invoice queue producer closed');
    await this.paymentClient.close();
    this.logger.log('Payment queue producer closed');
    await this.notifyInvoiceViaEmailClient.close();
    this.logger.log('Notify-invoice-via-email queue producer closed');
    await this.deactivateBillClient.close();
    this.logger.log('Deactivate bill queue producer closed');
    await this.retryDeactivateBillClient.close();
    this.logger.log('Retry-deactivate-bill queue producer closed');
    await this.failedDeactivateBillClient.close();
    this.logger.log('Failed-deactivate-bill queue producer closed');
    await this.markInvoicePaidClient.close();
    this.logger.log('Mark-invoice-paid queue producer closed');
    await this.retryMarkInvoicePaidClient.close();
    this.logger.log('Retry-mark-invoice-paid queue producer closed');
    await this.failedMarkInvoicePaidClient.close();
    this.logger.log('Failed-mark-invoice-paid queue producer closed');
  }

  async sendMessageQue(pattern: string, data: any): Promise<void> {
    switch (pattern) {
      // Payment queue
      case INVOICE_QUEUE_PATTERNS.UPDATE_INVOICE_PAYMENT_STATUS:
      case INVOICE_QUEUE_PATTERNS.RETRY_INVOICE_PAYMENT_CALLBACK:
      case INVOICE_QUEUE_PATTERNS.FAILED_INVOICE_PAYMENT_CALLBACK:
        await lastValueFrom(
          this.paymentClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      // Notify invoice via email queue
      case INVOICE_QUEUE_PATTERNS.NOTIFY_INVOICE_VIA_EMAIL:
        await lastValueFrom(
          this.notifyInvoiceViaEmailClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      // Mark invoice paid queue
      case INVOICE_QUEUE_PATTERNS.MARK_INVOICE_AS_PAID:
        await lastValueFrom(
          this.markInvoicePaidClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      case INVOICE_QUEUE_PATTERNS.RETRY_MARK_INVOICE_AS_PAID:
        await lastValueFrom(
          this.retryMarkInvoicePaidClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      case INVOICE_QUEUE_PATTERNS.FAILED_MARK_INVOICE_AS_PAID:
        await lastValueFrom(
          this.failedMarkInvoicePaidClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      // Deactivate bill queue
      case INVOICE_QUEUE_PATTERNS.DEACTIVATE_INVOICE_BILL:
        await lastValueFrom(
          this.deactivateBillClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      case INVOICE_QUEUE_PATTERNS.RETRY_DEACTIVATE_INVOICE_BILL:
        await lastValueFrom(
          this.retryDeactivateBillClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      case INVOICE_QUEUE_PATTERNS.FAILED_DEACTIVATE_INVOICE_BILL:
        await lastValueFrom(
          this.failedDeactivateBillClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      // Invoice queue (default)
      case INVOICE_QUEUE_PATTERNS.CREATE_INVOICE:
      case INVOICE_QUEUE_PATTERNS.RETRY_CREATE_INVOICE:
      case INVOICE_QUEUE_PATTERNS.FAILED_CREATE_INVOICE:
      default:
        await lastValueFrom(
          this.invoiceClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;
    }
  }
}
