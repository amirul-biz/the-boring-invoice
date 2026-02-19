import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { rabbitMQOptionsConfig } from './rabbit-mq-options.config';

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create(rabbitMQOptionsConfig());
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  sendMessageQue(pattern: string, data: any) {
    this.client.emit(pattern, data);
  }
}