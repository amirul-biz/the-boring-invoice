import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
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
import { CreateInvoiceInputDTO, InvoiceListQueryDTO } from './invoice-dto';
import { InvoiceService, RetryInvoiceMessage, RetryPaymentCallbackMessage } from './invoice-service';
import { EventPattern } from '@nestjs/microservices';
import { generateInvoiceTemplate } from './invoice-template-generator';
import { UserById } from '../decorator/user.decorator';

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

  @Get('template')
  @ApiOperation({ summary: 'Download invoice Excel template' })
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const buffer = await generateInvoiceTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="invoice-template.xlsx"',
    });
    res.send(buffer);
  }

  @Get('list/:businessId')
  @ApiOperation({ summary: 'Get paginated invoice list' })
  async getInvoiceList(
    @Param('businessId') businessId: string,
    @UserById() userId: string,
    @Query() query: InvoiceListQueryDTO,
  ) {
    return this.invoiceService.getInvoiceList(businessId, userId, query);
  }

  /**
   * Queue invoice generation for asynchronous processing
   */
  @Post('generate/:businessId')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  @ApiResponse({ status: 202, description: 'Invoice processing started' })
  @ApiResponse({ status: 500, description: 'Failed to queue invoice' })
  @ApiBody({ type: CreateInvoiceInputDTO })
  async generateInvoice(
    @Param('businessId') businessId: string,
    @UserById() userId: string,
    @Body() invoiceData: CreateInvoiceInputDTO[],
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.invoiceService.queueInvoiceGeneration(
        invoiceData,
        businessId,
        userId,
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
   * Queue for async processing to avoid serverless timeout
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
      this.logger.log('Payment callback received');
      this.logger.log(`[Callback] raw body: ${JSON.stringify(callbackData)}`);
      this.logger.log(`[Callback] req.body: ${JSON.stringify(req.body)}`);

      const data: ToyyibPayCallback = callbackData || req.body;

      // Queue the callback for async processing
      await this.invoiceService.queuePaymentCallback(data);

      this.logger.log(`Payment callback queued: ${data.order_id}`);

      // Always return 200 OK to ToyyibPay immediately
      res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      this.logger.error('Callback queueing error:', error);
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
    data: { businessId: string; invoiceDataList: CreateInvoiceInputDTO[] },
  ): Promise<void> {
    await this.invoiceService.processInvoiceBatch(data.businessId, data.invoiceDataList);
  }

  /**
   * Event consumer for retry-invoice queue
   * Waits 1 minute then retries idempotent invoice creation
   * Re-emits with incremented attemptNo or routes to failed-invoice after 5 attempts
   */
  @EventPattern('retry-invoice')
  async receiverRetryInvoice(data: RetryInvoiceMessage): Promise<void> {
    await this.invoiceService.processInvoiceRetry(data);
  }

  /**
   * Event consumer for queued payment callback updates
   * Processes payment callbacks from RabbitMQ queue
   * This avoids timeout issues in serverless environments
   */
  @EventPattern('receiver-update-invoice')
  async receiverUpdateInvoice(
    callbackData: ToyyibPayCallback,
  ): Promise<void> {
    await this.invoiceService.processPaymentCallbackFromQueue(callbackData);
  }

  /**
   * Event consumer for retry-payment-callback queue
   * Waits 1 minute then retries payment callback processing
   * Re-emits with incremented attemptNo or routes to failed-payment-callback after 5 attempts
   */
  @EventPattern('retry-payment-callback')
  async receiverRetryPaymentCallback(data: RetryPaymentCallbackMessage): Promise<void> {
    await this.invoiceService.processPaymentCallbackRetry(data);
  }
}
