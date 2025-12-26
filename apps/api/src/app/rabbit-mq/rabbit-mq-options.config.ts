import { Transport, RmqOptions } from '@nestjs/microservices';

export const rabbitMQOptionsConfig = (): RmqOptions => ({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RBBIT_MQ_QUE_URL], // Replace with your RabbitMQ server URL
    queue: 'rabbit_mq_que',
    queueOptions: {
      durable: true,
    },
    socketOptions: {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    },
    noAck: true,
    prefetchCount: 1,
  },
});