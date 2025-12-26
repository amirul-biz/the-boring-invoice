import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { rabbitMQOptionsConfig } from './app/rabbit-mq/rabbit-mq-options.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS first before other configurations
  app.enableCors({
    origin: [
      'https://the-boring-invoice-client.vercel.app',
      'http://localhost:4200',
      'https://resummonable-pearl-unfinanced.ngrok-free.dev',
      /\.ngrok-free\.app$/,
      /\.ngrok-free\.dev$/,
    ],
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
  });

  // Enable parsing of URL-encoded bodies (for ToyyibPay callbacks)
  app.use(require('express').urlencoded({ extended: true }));
  app.use(require('express').json());

  app.connectMicroservice(rabbitMQOptionsConfig());

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


  await app.startAllMicroservices()
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
