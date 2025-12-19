import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateInvoiceInputDTO, CreateInvoiceOutputDTO } from './invoice-dto';
import { generateInvoice } from './invoice-utility/invoice-generator.utility';

@ApiTags('invoice')
@Controller('invoice')
export class InvoiceController {
  @Get()
  getInvoices() {
    return 'Invoices';
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
    // Business name - you can get this from config, database, or request body
    const invoiceOutputData = this.getInvoiceOutputData(invoiceData);

    // Generate PDF buffer
    const pdfBuffer = await generateInvoice(invoiceOutputData);

    // Set content disposition header for download
    res.set({
      'Content-Disposition': `attachment; filename="invoice-${invoiceOutputData.invoiceNo}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    // Return as StreamableFile
    return new StreamableFile(pdfBuffer);
  }

  getInvoiceOutputData(input: CreateInvoiceInputDTO): CreateInvoiceOutputDTO {
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
    const output = new CreateInvoiceOutputDTO();
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
