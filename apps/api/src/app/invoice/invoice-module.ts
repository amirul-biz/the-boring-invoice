import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice-controller";

@Module({
  controllers: [InvoiceController],
  providers: [],
})
export class InvoiceModule {}