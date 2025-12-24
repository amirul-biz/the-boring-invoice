import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice-controller";
import { PrismaService } from "@prismaService";

@Module({
  controllers: [InvoiceController],
  providers: [PrismaService],
})
export class InvoiceModule {}