import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InvoiceModule } from './invoice/invoice-module';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    InvoiceModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_MAILER_HOST'),
          port: 465,
          secure: true,
          auth: {
            user: config.get('SMTP_MAILER_EMAIL'),
            pass: config.get('SMTP_MAILER_SERVER_PASSWORD'),
          },
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
