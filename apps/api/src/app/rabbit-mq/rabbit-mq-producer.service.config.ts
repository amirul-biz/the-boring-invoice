import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { rabbitMQInvoiceConfig } from './rabbit-mq-invoice.config';
import { rabbitMQPaymentConfig } from './rabbit-mq-payment.config';
import { rabbitMQNotifyEmailConfig } from './rabbit-mq-notify-email.config';
import { rabbitMQDeactivateBillConfig } from './rabbit-mq-deactivate-bill.config';
import { rabbitMQMarkInvoicePaidConfig } from './rabbit-mq-mark-invoice-paid.config';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from '../invoice/invoice.constants';

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqProducerService.name);
  private invoiceClient: ClientProxy;
  private paymentClient: ClientProxy;
  private notifyEmailClient: ClientProxy;
  private deactivateBillClient: ClientProxy;
  private markInvoicePaidClient: ClientProxy;

  constructor() {
    this.invoiceClient = ClientProxyFactory.create(rabbitMQInvoiceConfig(true));
    this.paymentClient = ClientProxyFactory.create(rabbitMQPaymentConfig(true));
    this.notifyEmailClient = ClientProxyFactory.create(rabbitMQNotifyEmailConfig(true));
    this.deactivateBillClient = ClientProxyFactory.create(rabbitMQDeactivateBillConfig(true));
    this.markInvoicePaidClient = ClientProxyFactory.create(rabbitMQMarkInvoicePaidConfig(true));
  }

  async onModuleInit() {
    await this.invoiceClient.connect();
    this.logger.log('Invoice queue producer connected');
    await this.paymentClient.connect();
    this.logger.log('Payment queue producer connected');
    await this.notifyEmailClient.connect();
    this.logger.log('Notify-email queue producer connected');
    await this.deactivateBillClient.connect();
    this.logger.log('Deactivate bill queue producer connected');
    await this.markInvoicePaidClient.connect();
    this.logger.log('Mark-invoice-paid queue producer connected');
  }

  async onModuleDestroy() {
    await this.invoiceClient.close();
    this.logger.log('Invoice queue producer closed');
    await this.paymentClient.close();
    this.logger.log('Payment queue producer closed');
    await this.notifyEmailClient.close();
    this.logger.log('Notify-email queue producer closed');
    await this.deactivateBillClient.close();
    this.logger.log('Deactivate bill queue producer closed');
    await this.markInvoicePaidClient.close();
    this.logger.log('Mark-invoice-paid queue producer closed');
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

      // Notify-email queue
      case INVOICE_QUEUE_PATTERNS.NOTIFY_INVOICE_EMAIL:
        await lastValueFrom(
          this.notifyEmailClient.emit(pattern, data).pipe(
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

      // Deactivate bill queue
      case INVOICE_QUEUE_PATTERNS.DEACTIVATE_INVOICE_BILL:
        await lastValueFrom(
          this.deactivateBillClient.emit(pattern, data).pipe(
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
