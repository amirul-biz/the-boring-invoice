import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { rabbitMQInvoiceConfig } from './rabbit-mq-invoice.config';
import { rabbitMQPaymentConfig } from './rabbit-mq-payment.config';
import { rabbitMQNotifyEmailConfig } from './rabbit-mq-notify-email.config';
import { INVOICE_QUEUE_CONFIG, INVOICE_QUEUE_PATTERNS } from '../invoice/invoice.constants';

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqProducerService.name);
  private invoiceClient: ClientProxy;
  private paymentClient: ClientProxy;
  private notifyEmailClient: ClientProxy;

  constructor() {
    this.invoiceClient = ClientProxyFactory.create(rabbitMQInvoiceConfig(true));
    this.paymentClient = ClientProxyFactory.create(rabbitMQPaymentConfig(true));
    this.notifyEmailClient = ClientProxyFactory.create(rabbitMQNotifyEmailConfig(true));
  }

  async onModuleInit() {
    await this.invoiceClient.connect();
    this.logger.log('Invoice queue producer connected');
    await this.paymentClient.connect();
    this.logger.log('Payment queue producer connected');
    await this.notifyEmailClient.connect();
    this.logger.log('Notify-email queue producer connected');
  }

  async onModuleDestroy() {
    await this.invoiceClient.close();
    this.logger.log('Invoice queue producer closed');
    await this.paymentClient.close();
    this.logger.log('Payment queue producer closed');
    await this.notifyEmailClient.close();
    this.logger.log('Notify-email queue producer closed');
  }

  async sendMessageQue(pattern: string, data: any): Promise<void> {
    switch (pattern) {
      // Payment queue
      case INVOICE_QUEUE_PATTERNS.CALLBACK:
      case INVOICE_QUEUE_PATTERNS.CALLBACK_RETRY:
      case INVOICE_QUEUE_PATTERNS.CALLBACK_FAILED:
        await lastValueFrom(
          this.paymentClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      // Notify-email queue
      case INVOICE_QUEUE_PATTERNS.NOTIFY_EMAIL:
        await lastValueFrom(
          this.notifyEmailClient.emit(pattern, data).pipe(
            timeout(INVOICE_QUEUE_CONFIG.QUEUE_EMIT_TIMEOUT_MS),
          ),
        );
        break;

      // Invoice queue (default)
      case INVOICE_QUEUE_PATTERNS.CREATE:
      case INVOICE_QUEUE_PATTERNS.RETRY:
      case INVOICE_QUEUE_PATTERNS.FAILED:
      case INVOICE_QUEUE_PATTERNS.DEACTIVATE:
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
