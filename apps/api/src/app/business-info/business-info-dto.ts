import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// 1. ADDRESS DTO
export class BusinessAddressDTO {
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

// 2. CREATE DTO
export class CreateBusinessInfoDTO {
  @ApiProperty({ example: 'Energizing Wellness Taekwondo' })
  @IsNotEmpty() @IsString()
  businessName: string;

  @ApiProperty({ example: 'business@example.com' })
  @IsEmail()
  businessEmail: string;

  @ApiProperty({ example: 'C1234567890' })
  @IsNotEmpty() @IsString()
  taxIdentificationNumber: string;

  @ApiProperty({ example: '202401012345' })
  @IsNotEmpty() @IsString()
  businessRegistrationNumber: string;

  @ApiProperty({ example: 'Taekwondo training and sports goods' })
  @IsNotEmpty() @IsString()
  businessActivityDescription: string;

  @ApiProperty({ example: '85419' })
  @IsNotEmpty() @IsString()
  msicCode: string;

  @ApiProperty({ example: '12345', description: 'ToyyibPay payment category code' })
  @IsNotEmpty() @IsString()
  categoryCode: string;

  @ApiProperty({ example: 'your-toyyibpay-secret-key' })
  @IsNotEmpty() @IsString()
  userSecretKey: string;

  @ApiProperty({ example: 'BRN', description: 'BRN, NRIC, PASSPORT, ARMY' })
  @IsNotEmpty() @IsString()
  idType: string;

  @ApiProperty({ example: 'W10-1234-12345678', required: false })
  @IsOptional() @IsString()
  sstRegistrationNumber?: string;

  @ApiProperty({ example: '60123456789' })
  @IsNotEmpty() @IsString()
  businessContactNumber: string;

  @ApiProperty({ type: BusinessAddressDTO })
  @ValidateNested()
  @Type(() => BusinessAddressDTO)
  address: BusinessAddressDTO;

  @ApiProperty({ example: '1.0' })
  @IsNotEmpty() @IsString()
  invoiceVersion: string;
}

// 3. UPDATE DTO
export class UpdateBusinessInfoDTO {
  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  businessName?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsEmail()
  businessEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  taxIdentificationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  businessRegistrationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  businessActivityDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  msicCode?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  categoryCode?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  userSecretKey?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  idType?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  sstRegistrationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  businessContactNumber?: string;

  @ApiProperty({ type: BusinessAddressDTO, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessAddressDTO)
  address?: Partial<BusinessAddressDTO>;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  invoiceVersion?: string;
}
