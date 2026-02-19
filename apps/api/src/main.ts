import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { rabbitMQOptionsConfig } from './app/rabbit-mq/rabbit-mq-options.config';
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
        'http://localhost:3000'
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

  // Connect microservice but don't let it block startup
  try {
    app.connectMicroservice(rabbitMQOptionsConfig());
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

  await app.listen(port);
}
bootstrap();
