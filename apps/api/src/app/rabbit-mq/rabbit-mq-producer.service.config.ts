import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { rabbitMQInvoiceConfig } from './rabbit-mq-invoice.config';
import { rabbitMQPaymentConfig } from './rabbit-mq-payment.config';
import { INVOICE_QUEUE_PATTERNS } from '../invoice/invoice.constants';

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private invoiceClient: ClientProxy;
  private paymentClient: ClientProxy;

  constructor() {
    this.invoiceClient = ClientProxyFactory.create(rabbitMQInvoiceConfig(true));
    this.paymentClient = ClientProxyFactory.create(rabbitMQPaymentConfig(true));
  }

  async onModuleInit() {
    await this.invoiceClient.connect();
    await this.paymentClient.connect();
  }

  async onModuleDestroy() {
    await this.invoiceClient.close();
    await this.paymentClient.close();
  }

  async sendMessageQue(pattern: string, data: any): Promise<void> {
    switch (pattern) {
      // Payment queue
      case INVOICE_QUEUE_PATTERNS.CALLBACK:
      case INVOICE_QUEUE_PATTERNS.CALLBACK_RETRY:
      case INVOICE_QUEUE_PATTERNS.CALLBACK_FAILED:
        await lastValueFrom(this.paymentClient.emit(pattern, data));
        break;

      // Invoice queue (default)
      case INVOICE_QUEUE_PATTERNS.CREATE:
      case INVOICE_QUEUE_PATTERNS.RETRY:
      case INVOICE_QUEUE_PATTERNS.FAILED:
      default:
        await lastValueFrom(this.invoiceClient.emit(pattern, data));
        break;
    }
  }
}
