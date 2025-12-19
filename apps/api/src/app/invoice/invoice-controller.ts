import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { CreateInvoiceInputDTO } from './invoice-dto';

@ApiTags('invoice')
@Controller('invoice')
export class InvoiceController {
  @Get()
  getInvoices() {
    return 'Invoices';
  }

  @ApiBody({
    type: CreateInvoiceInputDTO,
    description: 'Json Structure'
  })
  @Post()
  addInvoice(@Body() invoiceInputDTO: CreateInvoiceInputDTO) {
    return invoiceInputDTO;
  }
}
