import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessInfoService } from './business-info-service';
import { CreateBusinessInfoBody, UpdateBusinessInfoData } from './business-info-interface';
import { UserById } from '../decorator/user.decorator';

@ApiTags('BusinessInfo')
@Controller('business-info')
export class BusinessInfoController {
  constructor(private readonly businessInfoService: BusinessInfoService) {}

  @Post()
  @ApiOperation({ summary: 'Create business information' })
  async create(@UserById() userId: string, @Body() data: CreateBusinessInfoBody) {
    return this.businessInfoService.create(userId, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all business information for current user' })
  async findAll(@UserById() userId: string) {
    return this.businessInfoService.findByUserId(userId);
  }

  @Get(':id/public')
  @ApiOperation({ summary: 'Get business information by ID without sensitive data' })
  async findPublicById(@Param('id') id: string) {
    return this.businessInfoService.findPublicById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business information by ID' })
  async findById(@Param('id') id: string) {
    return this.businessInfoService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update business information' })
  async update(@Param('id') id: string, @Body() data: UpdateBusinessInfoData) {
    return this.businessInfoService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete business information' })
  async delete(@Param('id') id: string) {
    return this.businessInfoService.delete(id);
  }
}
