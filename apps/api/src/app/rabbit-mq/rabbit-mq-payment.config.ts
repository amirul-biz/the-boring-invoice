import { Transport, RmqOptions } from '@nestjs/microservices';

export const rabbitMQPaymentConfig = (noAck = false): RmqOptions => ({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RBBIT_MQ_QUE_URL],
    queue: 'payment_callback_queue',
    queueOptions: {
      durable: true,
    },
    socketOptions: {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    },
    noAck,
    prefetchCount: 1,
  },
});
