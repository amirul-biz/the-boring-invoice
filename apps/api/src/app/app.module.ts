import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { InvoiceModule } from './invoice/invoice-module';
import { BusinessInfoModule } from './business-info/business-info.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    InvoiceModule,
    AuthModule,
    BusinessInfoModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config: Record<string, unknown>) => {
        const required = [
          'DATABASE_URL',
          'ENCRYPTION_KEY',
          'RBBIT_MQ_QUE_URL',
          'SMTP_MAILER_EMAIL',
          'SMTP_MAILER_SERVER_PASSWORD',
          'SMTP_MAILER_HOST',
          'SMTP_MAILER_FROM',
          'PAYMENT_RETURN_URL',
          'API_URL',
        ];
        const missing = required.filter((key) => !config[key]);
        if (missing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`,
          );
        }
        return config;
      },
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // SMTP transport — Amazon SES
        transport: {
          host: config.get('SMTP_MAILER_HOST'),
          port: 2465,
          secure: true,
          auth: {
            user: config.get('SMTP_MAILER_EMAIL'),
            pass: config.get('SMTP_MAILER_SERVER_PASSWORD'),
          },
        },
        defaults: {
          from: `"The Boring Invoice" <${config.get('SMTP_MAILER_FROM')}>`,
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'invoice/callback', method: RequestMethod.POST },
        { path: 'business-info/:id/public', method: RequestMethod.GET },
      )
      .forRoutes('invoice', 'business-info');
  }
}
