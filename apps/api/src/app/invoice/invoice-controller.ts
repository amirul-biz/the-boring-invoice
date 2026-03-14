import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateInvoiceInputDTO, DeactivateBatchDTO, InvoiceListQueryDTO, MarkPaidBatchDTO, NotifyEmailBatchDTO, ProcessedInvoiceDto } from './invoice-dto';
import {
  InvoiceService,
  CreateInvoiceMessage,
  DeactivateMessage,
  RetryInvoiceMessage,
  RetryPaymentCallbackMessage,
  FailedInvoiceMessage,
  NotifyEmailMessage,
  MarkInvoicePaidMessage,
  ToyyibPayCallbackData,
} from './invoice-service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { generateInvoiceTemplate } from './invoice-template-generator';
import { UserById } from '../decorator/user.decorator';
import { INVOICE_QUEUE_PATTERNS } from './invoice.constants';

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

  @Get('pay/:invoiceNo')
  @ApiOperation({ summary: 'Redirect to ToyyibPay payment page' })
  @ApiParam({ name: 'invoiceNo', type: String })
  @ApiResponse({ status: 302, description: 'Redirect to payment page' })
  @ApiResponse({ status: 404, description: 'Invoice not found or payment link not available' })
  async payInvoice(@Param('invoiceNo') invoiceNo: string, @Res() res: Response): Promise<void> {
    const billUrl = await this.invoiceService.getPaymentRedirectUrl(invoiceNo);
    res.redirect(billUrl);
  }

  @Get('list/:businessId')
  @ApiOperation({ summary: 'Get paginated invoice list' })
  @ApiParam({ name: 'businessId', type: String })
  @ApiResponse({ status: 200, description: 'Paginated invoice list' })
  async getInvoiceList(
    @Param('businessId') businessId: string,
    @UserById() userId: string,
    @Query() query: InvoiceListQueryDTO,
  ) {
    return this.invoiceService.getInvoiceList(businessId, userId, query);
  }

  @Get('detail/:businessId/:invoiceNo')
  @ApiOperation({ summary: 'Get full invoice detail with decrypted fields' })
  @ApiParam({ name: 'businessId', type: String })
  @ApiParam({ name: 'invoiceNo', type: String })
  @ApiResponse({ status: 200, description: 'Full invoice detail' })
  @ApiResponse({ status: 403, description: 'Invoice does not belong to this business' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceDetail(
    @Param('businessId') businessId: string,
    @Param('invoiceNo') invoiceNo: string,
    @UserById() userId: string,
  ): Promise<ProcessedInvoiceDto> {
    return this.invoiceService.getInvoiceDetail(businessId, invoiceNo, userId);
  }

  /**
   * Queue invoice generation for asynchronous processing
   */
  @Post('generate/:businessId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate invoice PDF' })
  @ApiParam({ name: 'businessId', type: String })
  @ApiResponse({ status: 202, description: 'Invoice processing started' })
  @ApiResponse({ status: 500, description: 'Failed to queue invoice' })
  @ApiBody({ type: CreateInvoiceInputDTO, isArray: true })
  async generateInvoice(
    @Param('businessId') businessId: string,
    @UserById() userId: string,
    @Body() invoiceData: CreateInvoiceInputDTO[],
  ) {
    try {
      return await this.invoiceService.queueInvoiceGeneration(
        invoiceData,
        businessId,
        userId,
      );
    } catch (error) {
      this.logger.error(`Queue Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to queue invoice processing');
    }
  }

  /**
   * Queue a batch of invoice notification emails for async processing
   */
  @Post('notify-email/:businessId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue batch invoice notification emails' })
  @ApiParam({ name: 'businessId', type: String })
  @ApiBody({ type: NotifyEmailBatchDTO })
  @ApiResponse({ status: 202, description: 'Notification batch queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async queueNotifyEmailBatch(
    @Param('businessId') businessId: string,
    @Body() body: NotifyEmailBatchDTO,
    @UserById() userId: string,
  ): Promise<void> {
    await this.invoiceService.queueNotifyEmailBatch(businessId, body.invoiceNumbers, userId);
  }

  /**
   * Queue a batch of invoice deactivations for async processing
   */
  @Post('deactivate/:businessId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue batch invoice deactivation' })
  @ApiParam({ name: 'businessId', type: String })
  @ApiBody({ type: DeactivateBatchDTO })
  @ApiResponse({ status: 202, description: 'Deactivation batch queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async queueDeactivateBatch(
    @Param('businessId') businessId: string,
    @Body() body: DeactivateBatchDTO,
    @UserById() userId: string,
  ): Promise<void> {
    await this.invoiceService.queueDeactivateBatch(businessId, body.invoiceNumbers, userId);
  }

  /**
   * Queue batch mark-as-paid — syncs each invoice against ToyyibPay
   * Only PENDING invoices with confirmed ToyyibPay payment (or no billCode) will be updated
   */
  @Post('mark-paid/:businessId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue batch mark invoice as paid' })
  @ApiParam({ name: 'businessId', type: String })
  @ApiBody({ type: MarkPaidBatchDTO })
  @ApiResponse({ status: 202, description: 'Mark-as-paid batch queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async queueMarkInvoicePaidBatch(
    @Param('businessId') businessId: string,
    @Body() body: MarkPaidBatchDTO,
    @UserById() userId: string,
  ): Promise<void> {
    await this.invoiceService.queueMarkInvoicePaidBatch(businessId, body.invoiceNumbers, userId);
  }

  /**
   * Handle payment callback from ToyyibPay
   * Queue for async processing to avoid serverless timeout
   * Always returns 200 OK to ToyyibPay regardless of processing result
   */
  @Post('callback')
  @UseInterceptors(AnyFilesInterceptor())
  async handleToyyibPayCallback(
    @Body() callbackData: ToyyibPayCallbackData,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log('Payment callback received');
      this.logger.log(`[Callback] raw body: ${JSON.stringify(callbackData)}`);

      // Queue the callback for async processing
      await this.invoiceService.queuePaymentCallback(callbackData);

      this.logger.log(`Payment callback queued: ${callbackData.order_id}`);

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
  @EventPattern(INVOICE_QUEUE_PATTERNS.CREATE_INVOICE)
  async receiverCreateInvoice(
    @Payload() data: CreateInvoiceMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Invoice creation received — ${data.calculatedInvoiceList.length} invoice(s) for business ${data.businessId}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processInvoiceBatch(data.businessId, data.calculatedInvoiceList);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for notify-email batch queue
   * Sends each email with a 1.5 s gap between sends
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.NOTIFY_INVOICE_EMAIL)
  async receiverNotifyEmail(
    @Payload() data: NotifyEmailMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Notify-email consumer triggered — ${data.invoiceNumbers.length} invoice(s)`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processNotifyEmailSingle(data);
    this.logger.log(`[Queue] Notify-email complete — acking message`);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for deactivation batch queue
   * Deactivates each invoice with a 1.5 s gap between items
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.DEACTIVATE_INVOICE_BILL)
  async receiverDeactivate(
    @Payload() data: DeactivateMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Deactivate consumer triggered — ${data.invoiceNumbers.length} invoice(s)`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processDeactivateSingle(data);
    this.logger.log(`[Queue] Deactivate complete — acking message`);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for retry-invoice queue
   * Waits 1 minute then retries idempotent invoice creation
   * Re-emits with incremented attemptNo or routes to failed-invoice after 5 attempts
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.RETRY_CREATE_INVOICE)
  async receiverRetryInvoice(
    @Payload() data: RetryInvoiceMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Invoice retry received — attempt ${data.attemptNo} for ${data.calculatedInvoice.invoiceNo}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processInvoiceRetry(data);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for queued payment callback updates
   * Processes payment callbacks from RabbitMQ queue
   * This avoids timeout issues in serverless environments
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.UPDATE_INVOICE_PAYMENT_STATUS)
  async receiverUpdateInvoice(
    @Payload() callbackData: ToyyibPayCallbackData,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Payment callback received — order_id: ${callbackData.order_id}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processPaymentCallbackFromQueue(callbackData);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for retry-payment-callback queue
   * Waits 1 minute then retries payment callback processing
   * Re-emits with incremented attemptNo or routes to failed-payment-callback after 5 attempts
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.RETRY_INVOICE_PAYMENT_CALLBACK)
  async receiverRetryPaymentCallback(
    @Payload() data: RetryPaymentCallbackMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Payment callback retry received — attempt ${data.attemptNo} for order_id: ${data.callbackData.order_id}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processPaymentCallbackRetry(data);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for permanently failed invoices
   * Cancels invoice status and deactivates ToyyibPay bill
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.FAILED_CREATE_INVOICE)
  async receiverFailedInvoice(
    @Payload() data: FailedInvoiceMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Failed invoice received — ${data.calculatedInvoice.invoiceNo}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processFailedInvoice(data);
    channel.ack(originalMsg);
  }

  /**
   * Event consumer for permanently failed payment callbacks
   * Acks to clear the queue — revisit handling later
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.FAILED_INVOICE_PAYMENT_CALLBACK)
  async receiverFailedPaymentCallback(
    @Payload() _data: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.warn('Payment callback permanently failed — acking to clear queue');
    context.getChannelRef().ack(context.getMessage());
  }

  /**
   * Event consumer for mark-as-paid batch queue
   * Syncs each invoice against ToyyibPay and updates DB to PAID + sends receipt
   */
  @EventPattern(INVOICE_QUEUE_PATTERNS.MARK_INVOICE_AS_PAID)
  async receiverMarkInvoicePaid(
    @Payload() data: MarkInvoicePaidMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(`[Queue] Mark-as-paid consumer triggered — ${data.invoiceNumbers.length} invoice(s)`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    await this.invoiceService.processMarkInvoicePaidBatch(data);
    this.logger.log(`[Queue] Mark-as-paid complete — acking message`);
    channel.ack(originalMsg);
  }
}
