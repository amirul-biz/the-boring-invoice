import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice-controller";
import { InvoiceService } from "./invoice-service";
import { InvoiceCreateService } from "./invoice-create-service";
import { InvoicePaymentCallbackService } from "./invoice-payment-callback-service";
import { InvoiceDeactivateService } from "./invoice-deactivate-service";
import { InvoiceMarkPaidService } from "./invoice-mark-paid-service";
import { InvoiceNotifyService } from "./invoice-notify-service";
import { InvoiceQueryService } from "./invoice-query-service";
import { PrismaService } from "@prismaService";
import { RabbitMqProducerService } from "../rabbit-mq/rabbit-mq-producer.service.config";
import { BusinessInfoService } from "../business-info/business-info-service";
import { CryptoModule } from "../crypto/crypto.module";

@Module({
  imports: [CryptoModule],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    InvoiceCreateService,
    InvoicePaymentCallbackService,
    InvoiceDeactivateService,
    InvoiceMarkPaidService,
    InvoiceNotifyService,
    InvoiceQueryService,
    PrismaService,
    RabbitMqProducerService,
    BusinessInfoService,
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}
