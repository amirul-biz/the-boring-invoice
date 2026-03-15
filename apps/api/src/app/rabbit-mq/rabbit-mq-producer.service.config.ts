import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { INVOICE_QUEUE_PATTERNS } from '../invoice/invoice.constants';

// Maps each pattern to its target queue name
const PATTERN_TO_QUEUE: Record<string, string> = {
  [INVOICE_QUEUE_PATTERNS.CREATE_INVOICE]:                 'invoice_creation_queue',
  [INVOICE_QUEUE_PATTERNS.RETRY_CREATE_INVOICE]:           'invoice_creation_queue',
  [INVOICE_QUEUE_PATTERNS.FAILED_CREATE_INVOICE]:          'invoice_creation_queue',

  [INVOICE_QUEUE_PATTERNS.UPDATE_INVOICE_PAYMENT_STATUS]:  'payment_callback_queue',
  [INVOICE_QUEUE_PATTERNS.RETRY_INVOICE_PAYMENT_CALLBACK]: 'payment_callback_queue',
  [INVOICE_QUEUE_PATTERNS.FAILED_INVOICE_PAYMENT_CALLBACK]:'payment_callback_queue',

  [INVOICE_QUEUE_PATTERNS.NOTIFY_INVOICE_VIA_EMAIL]:       'notify_invoice_via_email_queue',

  [INVOICE_QUEUE_PATTERNS.DEACTIVATE_INVOICE_BILL]:        'deactivate_bill_queue',
  [INVOICE_QUEUE_PATTERNS.RETRY_DEACTIVATE_INVOICE_BILL]:  'retry_deactivate_bill_queue',
  [INVOICE_QUEUE_PATTERNS.FAILED_DEACTIVATE_INVOICE_BILL]: 'failed_deactivate_bill_queue',

  [INVOICE_QUEUE_PATTERNS.MARK_INVOICE_AS_PAID]:           'mark_invoice_paid_queue',
  [INVOICE_QUEUE_PATTERNS.RETRY_MARK_INVOICE_AS_PAID]:     'retry_mark_invoice_paid_queue',
  [INVOICE_QUEUE_PATTERNS.FAILED_MARK_INVOICE_AS_PAID]:    'failed_mark_invoice_paid_queue',
};

const UNIQUE_QUEUES = [...new Set(Object.values(PATTERN_TO_QUEUE))];

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqProducerService.name);
  private connection: AmqpConnectionManager;
  private channel: ChannelWrapper;

  async onModuleInit() {
    const url = process.env.RBBIT_MQ_QUE_URL;

    this.connection = amqp.connect([url], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () =>
      this.logger.log('Producer AMQP connection established'),
    );
    this.connection.on('disconnect', ({ err }: { err?: Error }) =>
      this.logger.warn(`Producer AMQP disconnected — will reconnect: ${err?.message ?? 'unknown'}`),
    );

    this.channel = this.connection.createChannel({
      json: true,
      setup: async (ch: any) => {
        for (const queue of UNIQUE_QUEUES) {
          await ch.assertQueue(queue, { durable: true });
        }
        this.logger.log(`Producer channel ready — ${UNIQUE_QUEUES.length} queues asserted on single connection`);
      },
    });

    await this.channel.waitForConnect();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('Producer AMQP connection closed');
  }

  async sendMessageQue(pattern: string, data: any): Promise<void> {
    const queue = PATTERN_TO_QUEUE[pattern];
    if (!queue) {
      throw new Error(`No queue mapped for pattern: ${pattern}`);
    }
    await this.channel.sendToQueue(queue, { pattern, data }, { persistent: true } as any);
  }
}
