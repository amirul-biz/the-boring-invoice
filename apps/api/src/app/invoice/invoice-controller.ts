import {
  Body,
  Controller,
  Get,
  Header,
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
} from './invoice-dto';
import { generateInvoice } from './invoice-utility/invoice-generator.utility';
import { createToyyibPayUtil } from './invoice-utility/invoice-toyyibpay-bill-generator.utility';
import { MailerService } from '@nestjs-modules/mailer';
import { sendInvoiceEmail } from './invoice-utility/invoice-email-generator.utility';
import { generateReceipt } from './invoice-utility/utility-pdf-receipt-generator';
import { sendReceiptEmail } from './invoice-utility/utility-email-receipt-generator';

@ApiTags('invoice')
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly mailService: MailerService) {}

  @Get('test-email')
  async getInvoices(): Promise<any> {
    try {
      await this.mailService.sendMail({
        to: 'amirul.irfan.biz@gmail.com',
        subject: 'Invoice Ready',
        text: 'Your invoice has been processed.',
      });
      return { status: 'Success', message: 'Invoice email sent' };
    } catch (error) {
      Logger.log(error);
      throw new InternalServerErrorException('Failed to send email', error);
    }
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF streamed successfully' })
  @ApiResponse({ status: 500, description: 'Failed to generate PDF' })
  @Header('Content-Type', 'application/pdf')
  @ApiBody({
    type: CreateInvoiceInputDTO,
    description: 'Json Structure',
  })
  async generateInvoice(
    @Body() invoiceData: CreateInvoiceInputDTO,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const calculatedInvoiceData =
      await this.getCalculatedInvoiceData(invoiceData);
    const processedInvoiceData = await this.getProcessedIncvoiceData(
      calculatedInvoiceData,
    );

    const pdfBuffer = await generateInvoice(processedInvoiceData);

    res.set({
      'Content-Disposition': `attachment; filename="invoice-${processedInvoiceData.invoiceNo}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    await sendInvoiceEmail(this.mailService, processedInvoiceData, pdfBuffer);

    return new StreamableFile(pdfBuffer);
  }

  @Post('callback')
  @UseInterceptors(AnyFilesInterceptor())
  async handleToyyibPayCallback(
    @Req() req: any,
    @Body() callbackData: any,
    @Res() res,
  ) {
    // ToyyibPay Callback Interface

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

    const  mockBillResponse: ProcessedInvoiceDto = {
      invoiceType: 'Invoice',
      currency: 'MYR',
      supplier: {
        name: 'Energizing Wellness Taekwondo',
        email: 'amirul.irfan.biz@gmail.com',
        tin: 'C25845632020',
        registrationNumber: '202401012345',
        msicCode: '85412',
        businessActivityDescription:
          'Martial arts instruction and sports goods',
      },
      recipient: {
        name: 'Amirul Irfan Bin Khairul Azreem',
        email: 'amirul.irfan.1022000@gmail.com',
        phone: '+60196643494',
        tin: 'EI00000000010',
        registrationNumber: '900101015555',
        addressLine1: 'No 50 Jalan Seri Putra 3/9',
        postcode: '43000',
        city: 'Kajang',
        state: 'Selangor',
        countryCode: 'MY',
      },
      taxRate: 8.0,
      dueDate: '2026-01-18',
      items: [
        {
          itemName: 'Monthly Taekwondo Tuition (Junior Class)',
          quantity: 1,
          unitPrice: 150.0,
          classificationCode: '010',
        },
        {
          itemName: 'Taekwondo Uniform (Dobok) - Size L',
          quantity: 1,
          unitPrice: 85.0,
          classificationCode: '022',
        },
      ],
      invoiceNo: '2025-12-23-1458-amirul-irfan-7a2b3c4',
      issuedDate: '2025-12-23T14:58:10Z',
      totalExcludingTax: 235.0,
      totalIncludingTax: 253.8,
      billUrl: 'https://toyyibpay.com/e87sh291ks',
    };

    const mockReceiptResponse: ReceiptDTO = {
      ...mockBillResponse,
      transactionId: callbackData.transaction_id,
      transactionTime: callbackData.transactionTime
    }

    try {
      Logger.log('payment data',JSON.stringify(callbackData, null, 2));

      const data: ToyyibPayCallback = callbackData || req.body;

      const isSuccess = data.status === '1'

      if(!isSuccess) return

      const pdfReceipt = await generateReceipt(mockReceiptResponse)

      await sendReceiptEmail(this.mailService, mockReceiptResponse, pdfReceipt)

      return res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      Logger.error('Callback processing error:', error);
      return res.status(HttpStatus.OK).send('OK'); 
    }
  }

  async getProcessedIncvoiceData(
    calculatedInvoiceData: CalculatedInvoiceDto,
  ): Promise<ProcessedInvoiceDto> {
    const returnUrl = `${process.env.NG_APP_FRONTEND_URL}`;
    const callbackUrl = `${process.env.NG_APP_API_URL}/invoice/callback`;

    Logger.log('Creating ToyyibPay bill with URLs:', {
      returnUrl,
      callbackUrl,
    });

    const toyyibPay = createToyyibPayUtil({
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
}
