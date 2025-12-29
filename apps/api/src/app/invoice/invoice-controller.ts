import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateInvoiceInputDTO } from './invoice-dto';
import { InvoiceService } from './invoice-service';
import { EventPattern } from '@nestjs/microservices';

/**
 * ToyyibPay callback data interface
 */
interface ToyyibPayCallback {
  refno: string;
  status: string;
  reason: string;
  billcode: string;
  order_id: string;
  amount: string;
  status_id: string;
  msg: string;
  transaction_id: string;
  fpx_transaction_id: string;
  hash: string;
  transaction_time: string;
}

@ApiTags('invoice')
@Controller('invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Queue invoice generation for asynchronous processing
   */
  @Post('generate')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  @ApiResponse({ status: 202, description: 'Invoice processing started' })
  @ApiResponse({ status: 500, description: 'Failed to queue invoice' })
  @ApiBody({ type: CreateInvoiceInputDTO })
  async generateInvoice(
    @Body() invoiceData: CreateInvoiceInputDTO[],
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.invoiceService.queueInvoiceGeneration(
        invoiceData,
      );

      res.status(HttpStatus.ACCEPTED).json(result);
    } catch (error) {
      this.logger.error(
        `Queue Error: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Failed to queue invoice processing',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle payment callback from ToyyibPay
   * Always returns 200 OK to ToyyibPay regardless of processing result
   */
  @Post('callback')
  @UseInterceptors(AnyFilesInterceptor())
  async handleToyyibPayCallback(
    @Req() req: any,
    @Body() callbackData: any,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(
        'Payment callback received',
        JSON.stringify(callbackData, null, 2),
      );

      const data: ToyyibPayCallback = callbackData || req.body;

      await this.invoiceService.handlePaymentCallback(data);

      // Always return 200 OK to ToyyibPay
      res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      this.logger.error('Callback processing error:', error);
      // Still return 200 OK to prevent ToyyibPay retries
      res.status(HttpStatus.OK).send('OK');
    }
  }

  /**
   * Event consumer for queued invoice creation
   * Processes invoices from RabbitMQ queue
   */
  @EventPattern('receiver-create-invoice')
  async receiverCreateInvoice(
    invoiceData: CreateInvoiceInputDTO[],
  ): Promise<void> {
    await this.invoiceService.processInvoiceBatch(invoiceData);
  }
}
