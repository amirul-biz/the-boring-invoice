import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  Res,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateInvoiceInputDTO,
  CalculatedInvoiceDto,
  ProcessedInvoiceDto,
  ReceiptDTO,
  RecipientDTO,
  SupplierDTO,
  InvoiceItemDTO,
} from './invoice-dto';
import { generatePdfInvoiceTemplate } from './invoice-generator/invoice-generator-pdf-invoice-template';
import { generateToyyibpayBill } from './invoice-generator/invoice-generator-toyyibpay-bill';
import { MailerService } from '@nestjs-modules/mailer';
import { generateInvoiceEmailTemplate } from './invoice-generator/invoice-generator-invoice-email-template';
import { generatePdfReceiptTemplate } from './invoice-generator/invoice-generator-pdf-receipt-template';
import { generateReceiptEmailTemplate } from './invoice-generator/invoice-generator-receipt-email-template';
import { PrismaService } from '@prismaService';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { ExceptionsHandler } from '@nestjs/core/exceptions/exceptions-handler';
import { RabbitMqProducerService } from '../rabbit-mq/rabbit-mq-producer.service.config';
import { EventPattern } from '@nestjs/microservices';

@ApiTags('invoice')
@Controller('invoice')
export class InvoiceController {
  constructor(
    private readonly mailService: MailerService,
    private readonly prisma: PrismaService,
    private readonly queService: RabbitMqProducerService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  @ApiResponse({ status: 202, description: 'Invoice processing started' }) // 202 is more accurate for queues
  @ApiResponse({ status: 500, description: 'Failed to queue invoice' })
  @ApiBody({ type: CreateInvoiceInputDTO })
  async generateInvoice(
    @Body() invoiceData: CreateInvoiceInputDTO[],
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.queService.sendMessageQue('receiver-create-invoice', invoiceData);

      res.status(HttpStatus.ACCEPTED).json({
        message: 'Invoice generation has been queued successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error(
        `Queue Error: ${error.message}`,
        error.stack,
        'InvoiceController',
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

  @Post('callback')
  @UseInterceptors(AnyFilesInterceptor())
  async handleToyyibPayCallback(
    @Req() req: any,
    @Body() callbackData: any,
    @Res() res,
  ) {
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

    try {
      Logger.log('payment data', JSON.stringify(callbackData, null, 2));

      const data: ToyyibPayCallback = callbackData || req.body;

      const invoiceNo = data.order_id;
      const paymentStatus =
        data.status === '1' ? InvoiceStatus.PAID : InvoiceStatus.CANCELLED;

      const sanitizedTransactionTime = data.transaction_time
        ? new Date(data.transaction_time.replace(' ', 'T')).toISOString()
        : new Date().toISOString();

      await this.updateInvoiceStatus({
        status: paymentStatus,
        transactionTime: sanitizedTransactionTime,
        transactionId: data.transaction_id,
        invoiceNo: invoiceNo,
      });

      const isSuccess = paymentStatus === InvoiceStatus.PAID;

      if (!isSuccess) return;

      const invoiceData = await this.getInvoiceData(invoiceNo);

      const pdfReceipt = await generatePdfReceiptTemplate(invoiceData);

      await generateReceiptEmailTemplate(
        this.mailService,
        invoiceData,
        pdfReceipt,
      );

      return res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      Logger.error('Callback processing error:', error);
      return res.status(HttpStatus.OK).send('OK');
    }
  }

  async getProcessedIncvoiceData(
    calculatedInvoiceData: CalculatedInvoiceDto,
  ): Promise<ProcessedInvoiceDto> {
    const returnUrl = `${process.env.PAYMENT_RETURN_URL}`;
    const callbackUrl = `${process.env.NG_APP_API_URL}/invoice/callback`;

    Logger.log('Creating ToyyibPay bill with URLs:', {
      returnUrl,
      callbackUrl,
    });

    const toyyibPay = generateToyyibpayBill({
      returnUrl,
      callbackUrl,
    });

    const paymentUrl = (
      await toyyibPay.createBillFromCalculatedInvoiceData(calculatedInvoiceData)
    ).paymentUrl;

    return {
      ...calculatedInvoiceData,
      billUrl: paymentUrl,
    };
  }

  getCalculatedInvoiceData(input: CreateInvoiceInputDTO): CalculatedInvoiceDto {
    // 1. Calculate and map items with LHDN mathematical accuracy
    const mappedItems = input.items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      const taxDecimal = input.taxRate / 100;

      return {
        ...item,
        // LHDN requires each line to have its own tax amount calculated
        taxAmount: parseFloat((subtotal * taxDecimal).toFixed(2)),
        lineTotal: parseFloat((subtotal * (1 + taxDecimal)).toFixed(2)),
      };
    });

    // 2. Generate the internal reference ID (Maintaining the 50-character limit)
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(2, 12); // e.g., 2512191830
    const rawName = input.recipient.name || 'guest';

    // 2. Replace all spaces with hyphens and remove any other illegal special characters
    const sanitizedName = rawName
      .trim()
      .split(' ')[0] // Optional: Take only the first name to keep it short
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^a-zA-Z0-9-]/g, ''); // Remove symbols like @, #, $

    // 3. Final construction (Upper case for professional look)
    const namePrefix = sanitizedName.substring(0, 8).toUpperCase();

    const randomSuffix = Math.random().toString(36).substring(2, 6); // 4-char random string

    // Format: INV-2512191830-amirul-8d2f (~28 characters)
    const internalRef = `INV-${timestamp}-${namePrefix}-${randomSuffix}`;

    // 3. Construct the Output DTO
    const output = new CalculatedInvoiceDto();
    Object.assign(output, input);

    // System-Generated Fields
    output.invoiceNo = internalRef.toUpperCase(); // Internal Tracking
    output.issuedDate = new Date().toISOString(); // Full timestamp often required for API

    // Financial Totals with precision
    const totalExcludingTax = mappedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const totalTaxAmount = mappedItems.reduce(
      (sum, item) => sum + item.taxAmount,
      0,
    );

    output.items = mappedItems;
    output.totalExcludingTax = parseFloat(totalExcludingTax.toFixed(2));
    output.totalIncludingTax = parseFloat(
      (totalExcludingTax + totalTaxAmount).toFixed(2),
    );

    return output;
  }

  async createInvoice(dto: ProcessedInvoiceDto): Promise<void> {
    try {
      await this.prisma.invoice.create({
        data: {
          invoiceNo: dto.invoiceNo,
          invoiceType: dto.invoiceType,
          currency: dto.currency,
          status: (dto.status as InvoiceStatus) || 'PENDING',

          issuedDate: new Date(dto.issuedDate),
          dueDate: new Date(dto.dueDate),

          recipientRegistrationNo: dto.recipient.registrationNumber,
          recipient: dto.recipient as any as Prisma.JsonObject,

          supplierRegistrationNo: dto.supplier.registrationNumber,
          supplier: dto.supplier as any as Prisma.JsonObject,

          items: dto.items as unknown as Prisma.JsonArray,

          taxRate: dto.taxRate,
          totalExcludingTax: dto.totalExcludingTax,
          totalIncludingTax: dto.totalIncludingTax,

          billUrl: dto.billUrl,
        },
      });
    } catch (error) {
      throw new HttpException('cannot save db', error);
    }
  }

  async updateInvoiceStatus(data: {
    invoiceNo: string;
    transactionTime: string;
    transactionId: string;
    status: InvoiceStatus;
  }): Promise<void> {
    try {
      await this.prisma.invoice.update({
        where: { invoiceNo: data.invoiceNo },
        data: {
          status: data.status,
          transactionTime: data.transactionTime,
          transactionId: data.transactionId,
        },
      });
      Logger.log(`Invoice ${data.invoiceNo} status updated to ${data.status}`);
    } catch (error) {
      Logger.error(`Failed to update invoice ${data.invoiceNo} status:`, error);
      throw new HttpException(
        'Failed to update invoice status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getInvoiceData(invoiceNo: string): Promise<ReceiptDTO> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { invoiceNo },
      });

      if (!invoice) {
        throw new HttpException(
          `Invoice ${invoiceNo} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (!invoice.transactionId || !invoice.transactionTime) {
        throw new HttpException(
          `Invoice ${invoiceNo} does not have transaction details`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const receiptDto: ReceiptDTO = {
        invoiceNo: invoice.invoiceNo,
        invoiceType: invoice.invoiceType,
        currency: invoice.currency,
        status: invoice.status,

        issuedDate: invoice.issuedDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),

        supplier: invoice.supplier as unknown as SupplierDTO,
        recipient: invoice.recipient as unknown as RecipientDTO,

        items: invoice.items as any as InvoiceItemDTO[],

        taxRate: parseFloat(invoice.taxRate.toString()),
        totalExcludingTax: parseFloat(invoice.totalExcludingTax.toString()),
        totalIncludingTax: parseFloat(invoice.totalIncludingTax.toString()),

        billUrl: invoice.billUrl || '',

        transactionId: invoice.transactionId,
        transactionTime: invoice.transactionTime.toISOString(),
      };

      return receiptDto;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      Logger.error(`Failed to retrieve invoice ${invoiceNo}:`, error);
      throw new HttpException(
        'Failed to retrieve invoice',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @EventPattern('receiver-create-invoice')
  async receiverCreateInvoice(invoiceData: CreateInvoiceInputDTO[]) {
    for (const data of invoiceData) {
      try {
        //CRITICAL
        const calculated = await this.getCalculatedInvoiceData(data);
        const processedInvoiceData =
          await this.getProcessedIncvoiceData(calculated);
        await this.createInvoice(processedInvoiceData);

        //  LESS CRITICAL
        this.sendInvoiceEmail(processedInvoiceData);
      } catch (error) {
        Logger.log(error);
        continue;
      }
    }
  }

  private async sendInvoiceEmail(processedInvoiceData: ProcessedInvoiceDto) {
    const pdfBuffer = await generatePdfInvoiceTemplate(processedInvoiceData);
    await generateInvoiceEmailTemplate(
      this.mailService,
      processedInvoiceData,
      pdfBuffer,
    );
  }
}
