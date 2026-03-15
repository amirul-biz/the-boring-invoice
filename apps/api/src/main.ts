import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { rabbitMQInvoiceConfig } from './app/rabbit-mq/rabbit-mq-invoice.config';
import { rabbitMQPaymentConfig } from './app/rabbit-mq/rabbit-mq-payment.config';
import { rabbitMQNotifyInvoiceViaEmailConfig } from './app/rabbit-mq/rabbit-mq-notify-invoice-via-email.config';
import { rabbitMQDeactivateBillConfig } from './app/rabbit-mq/rabbit-mq-deactivate-bill.config';
import { rabbitMQRetryDeactivateBillConfig } from './app/rabbit-mq/rabbit-mq-retry-deactivate-bill.config';
import { rabbitMQFailedDeactivateBillConfig } from './app/rabbit-mq/rabbit-mq-failed-deactivate-bill.config';
import { rabbitMQMarkInvoicePaidConfig } from './app/rabbit-mq/rabbit-mq-mark-invoice-paid.config';
import { rabbitMQRetryMarkInvoicePaidConfig } from './app/rabbit-mq/rabbit-mq-retry-mark-invoice-paid.config';
import { rabbitMQFailedMarkInvoicePaidConfig } from './app/rabbit-mq/rabbit-mq-failed-mark-invoice-paid.config';
import { rabbitMQRetryPaymentCallbackConfig } from './app/rabbit-mq/rabbit-mq-retry-payment-callback.config';
import { rabbitMQFailedPaymentCallbackConfig } from './app/rabbit-mq/rabbit-mq-failed-payment-callback.config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS first before other configurations
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://the-boring-invoice-client.vercel.app',
        'http://localhost:4200',
        'https://resummonable-pearl-unfinanced.ngrok-free.dev',
        'http://localhost:3000',
        'https://dev-the-boring-invoice-api-188964796220.asia-southeast1.run.app',
        'https://dev-client-the-boring-invoice.ai-solution.cc',
      ];

      const allowedPatterns = [
        /\.ngrok-free\.app$/,
        /\.ngrok-free\.dev$/,
        /\.vercel\.app$/,
      ];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin) || allowedPatterns.some(pattern => pattern.test(origin))) {
        callback(null, true);
      } else {
        console.warn('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Enable global validation and transformation
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable parsing of URL-encoded bodies (for ToyyibPay callbacks)
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));
  app.use(require('express').json({ limit: '10mb' }));

  // Connect microservices but don't let it block startup
  try {
    app.connectMicroservice(rabbitMQInvoiceConfig());
    app.connectMicroservice(rabbitMQPaymentConfig());
    app.connectMicroservice(rabbitMQRetryPaymentCallbackConfig());
    app.connectMicroservice(rabbitMQFailedPaymentCallbackConfig());
    app.connectMicroservice(rabbitMQNotifyInvoiceViaEmailConfig());
    app.connectMicroservice(rabbitMQDeactivateBillConfig());
    app.connectMicroservice(rabbitMQRetryDeactivateBillConfig());
    app.connectMicroservice(rabbitMQFailedDeactivateBillConfig());
    app.connectMicroservice(rabbitMQMarkInvoicePaidConfig());
    app.connectMicroservice(rabbitMQRetryMarkInvoicePaidConfig());
    app.connectMicroservice(rabbitMQFailedMarkInvoicePaidConfig());
  } catch (err) {
    console.error('Failed to connect microservice:', err.message);
  }

  const config = new DocumentBuilder()
    .setTitle('The Boring Invoice API')
    .setDescription('API Description')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // 2. Pass custom options to load assets from CDN
  SwaggerModule.setup('api', app, document, {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
    ],
  });

  // Start microservices in background (non-blocking)
  app.startAllMicroservices().catch(err => {
    console.error('Failed to start microservices:', err.message);
    console.log('API will continue to run without RabbitMQ');
  });

  const port = process.env.PORT ?? 3000;

  // Log database connection info for debugging
  console.log('Starting server with database pooling enabled');

  app.enableShutdownHooks();
  await app.listen(port);
}
bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
