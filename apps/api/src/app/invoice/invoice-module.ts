import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice-controller";
import { InvoiceService } from "./invoice-service";
import { PrismaService } from "@prismaService";
import { RabbitMqProducerService } from "../rabbit-mq/rabbit-mq-producer.service.config";

@Module({
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    PrismaService,
    RabbitMqProducerService,
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}