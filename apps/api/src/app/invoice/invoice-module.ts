import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice-controller";
import { PrismaService } from "@prismaService";
import { RabbitMqProducerService } from "../rabbit-mq/rabbit-mq-producer.service.config";

@Module({
  controllers: [InvoiceController],
  providers: [PrismaService, RabbitMqProducerService],
})
export class InvoiceModule {}