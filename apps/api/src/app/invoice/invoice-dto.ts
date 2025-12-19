import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsString, ValidateNested } from "class-validator";

export class CreateInvoiceItemsInputDTO {
    @ApiProperty({
        example: '4 day class fee',
        required: true
    })
    @IsNotEmpty()
    @IsString()
    itemName: string

    @ApiProperty({
        example: 1,
        required: true
    })
    @IsNotEmpty()
    @IsInt()
    quantity: number

    @ApiProperty({
        example: 20.40,
        required: true
    })
    @IsNotEmpty()
    @IsNumber()
    unitPrice: number
}

export class CreateInvoiceInputDTO {
    @ApiProperty({
        example: 'Recepient name',
        required: true
    })
    @IsNotEmpty()
    name: string

    @ApiProperty({
        type: [CreateInvoiceItemsInputDTO],
        description: 'List of invoice items'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemsInputDTO) 
    items: CreateInvoiceItemsInputDTO[]
}