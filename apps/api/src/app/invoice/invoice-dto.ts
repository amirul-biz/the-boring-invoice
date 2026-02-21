import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceType } from '@prisma/client';

// 1. RECIPIENT (BUYER) DTO
export class RecipientDTO {
  @ApiProperty({ example: 'Amirul Irfan Bin Khairul Azreem' })
  @IsNotEmpty() @IsString()
  name: string;

  @ApiProperty({ example: 'amirul.irfan.1022000@gmail.com' })
  @IsEmail() @IsOptional()
  email: string;

  @ApiProperty({ example: '60196643494', description: 'E.164 format: +60...' })
  @IsNotEmpty() @IsString()
  phone: string;

  @ApiProperty({ example: 'E100000000010' })
  @IsNotEmpty() @IsString()
  tin: string;

  @ApiProperty({ example: 'BRN', description: 'LHDN ID Type: BRN, NRIC, PASSPORT, ARMY' })
  @IsNotEmpty() @IsString()
  idType: string;

  @ApiProperty({ example: '900101015555', description: 'NRIC or BRN' })
  @IsNotEmpty() @IsString()
  registrationNumber: string;

  @ApiProperty({ example: 'No 50 Jalan Seri Putra 3/9' })
  @IsNotEmpty() @IsString()
  addressLine1: string;

  @ApiProperty({ example: '43000' })
  @IsNotEmpty() @IsString()
  postcode: string;

  @ApiProperty({ example: 'Kajang' })
  @IsNotEmpty() @IsString()
  city: string;

  @ApiProperty({ example: 'Selangor' })
  @IsNotEmpty() @IsString()
  state: string;

  @ApiProperty({ example: 'MY' })
  @IsNotEmpty() @IsString()
  countryCode: string; // Mandatory ISO code
}

// 2. SUPPLIER (YOUR SME) DTO
export class SupplierDTO {
  @ApiProperty({ example: 'Energizing Wellness Taekwondo' })
  @IsNotEmpty() @IsString()
  name: string;

  @ApiProperty({ example: 'supplier@example.com' })
  @IsEmail() @IsOptional()
  email: string;

  @ApiProperty({ example: 'C1234567890' })
  @IsNotEmpty() @IsString()
  tin: string; // Your business TIN

  @ApiProperty({ example: '202401012345' })
  @IsNotEmpty() @IsString()
  registrationNumber: string; // Your SSM Number

  @ApiProperty({ example: '85419', description: 'Sports and recreation education' })
  @IsNotEmpty() @IsString()
  msicCode: string; // Mandatory 5-digit code

  @ApiProperty({ example: 'Taekwondo training and sports goods' })
  @IsNotEmpty() @IsString()
  businessActivityDescription: string;

  @ApiProperty({ example: 'BRN', description: 'LHDN ID Type: BRN, NRIC, PASSPORT, ARMY' })
  @IsNotEmpty() @IsString()
  idType: string;

  @ApiProperty({ example: 'W10-1234-12345678', required: false })
  @IsOptional() @IsString()
  sstRegistrationNumber?: string;

  @ApiProperty({ example: 'No 1, Jalan Mawar' })
  @IsNotEmpty() @IsString()
  addressLine1: string;

  @ApiProperty({ example: 'Kuala Lumpur' })
  @IsNotEmpty() @IsString()
  city: string;

  @ApiProperty({ example: '50000' })
  @IsNotEmpty() @IsString()
  postcode: string;

  @ApiProperty({ example: '14' })
  @IsNotEmpty() @IsString()
  state: string;

  @ApiProperty({ example: 'MYS' })
  @IsNotEmpty() @IsString()
  country: string;
}

// 3. ITEM DTO
export class InvoiceItemDTO {
  @ApiProperty({ example: 'Monthly Taekwondo Tuition (Junior Class)' })
  @IsNotEmpty() @IsString()
  itemName: string;

  @ApiProperty({ example: 1 })
  @IsInt() @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 150.00 })
  @IsNumber() @IsNotEmpty()
  unitPrice: number;

  @ApiProperty({ example: '010', description: 'LHDN Classification Code' })
  @IsNotEmpty() @IsString()
  classificationCode: string; // e.g., 010 for services

  @ApiProperty({ example: 'NOT_APPLICABLE', description: 'LHDN Tax Type' })
  @IsNotEmpty() @IsString()
  taxType: string;

  @ApiProperty({ example: 0, description: 'Discount percentage (0–100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  taxRate: number;
}

// 4. MAIN INPUT DTO
export class CreateInvoiceInputDTO {
  @ApiProperty({ enum: InvoiceType })
  @IsEnum(InvoiceType)
  invoiceType: InvoiceType;

  @ApiProperty({ example: 'MYR' })
  @IsString()
  currency: string; // Mandatory ISO code

  @ApiProperty({type: SupplierDTO})
  @ValidateNested()
  @Type(() => SupplierDTO)
  supplier: SupplierDTO;

  @ApiProperty({type: RecipientDTO})
  @ValidateNested()
  @Type(() => RecipientDTO)
  recipient: RecipientDTO;

  @ApiProperty({ example: '2026-01-18' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({type: InvoiceItemDTO})
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDTO)
  items: InvoiceItemDTO[];

  @ApiProperty({ example: '1.0', description: 'LHDN MyInvois specification version' })
  @IsString()
  @IsNotEmpty()
  invoiceVersion: string;
}

// 5. OUTPUT DTO (Includes LHDN Validation Data)
export class CalculatedInvoiceDto extends CreateInvoiceInputDTO {
  @ApiProperty({ example: 'year-date-month-time-stamp-email-7digituuid' })
  invoiceNo: string;

  @ApiProperty({ example: '2025-12-19T08:52:10Z' })
  issuedDate: string;

  @ApiProperty({ example: 445.00, description: 'Net amount after discounts, before tax' })
  totalNetAmount: number;

  @ApiProperty({ example: 8.00, description: 'Total discount amount across all items' })
  totalDiscountAmount: number;

  @ApiProperty({ example: 8.00, description: 'Total tax amount' })
  totalTaxAmount: number;

  @ApiProperty({ example: 453.00, description: 'Final payable amount (net + tax)' })
  totalPayableAmount: number;
}

export class ProcessedInvoiceDto extends CalculatedInvoiceDto {
  @ApiProperty({ example: 'abc123xyz' })
  billCode?: string;

  @ApiProperty({example: `${process.env.PAYMENT_API_BASE_URL}/api url`})
  billUrl?: string

  @ApiProperty({ enum: ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' })
  @IsEnum(['DRAFT', 'PENDING', 'PAID', 'CANCELLED'])
  @IsOptional()
  status?: string;
}

export class ReceiptDTO extends ProcessedInvoiceDto {
  @IsString()
  transactionId: string
  @IsString()
  transactionTime: string
}

// 7. INVOICE LIST QUERY DTO
export class InvoiceListQueryDTO {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageIndex: number;

  @ApiProperty({ example: 10, enum: [10, 50, 100] })
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 50, 100])
  pageSize: number;

  @ApiProperty({ required: false, enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @ApiProperty({ required: false, enum: ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, example: '2025-01-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiProperty({ required: false, example: '2025-12-31' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

