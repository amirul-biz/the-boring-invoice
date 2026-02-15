import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice-controller";
import { InvoiceService } from "./invoice-service";
import { PrismaService } from "@prismaService";
import { RabbitMqProducerService } from "../rabbit-mq/rabbit-mq-producer.service.config";
import { BusinessInfoService } from "../business-info/business-info-service";

@Module({
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    PrismaService,
    RabbitMqProducerService,
    BusinessInfoService,
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}