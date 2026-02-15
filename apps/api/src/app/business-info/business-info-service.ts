import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { BusinessInformation } from '@prisma/client';
import { CreateBusinessInfoBody, UpdateBusinessInfoData } from './business-info-interface';
import {
  createBusinessInfo,
  findBusinessInfoByUserId,
  findBusinessInfoById,
  updateBusinessInfo,
  hasRelatedInvoices,
  deleteBusinessInfo,
} from './business-info-repository';

@Injectable()
export class BusinessInfoService {
  private readonly logger = new Logger(BusinessInfoService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(data: CreateBusinessInfoBody): Promise<BusinessInformation> {
    const userId = process.env['TEMP_USER_ID'];
    return await createBusinessInfo(this.prisma, { ...data, userId }, this.logger);
  }

  async findAll(): Promise<BusinessInformation[]> {
    const userId = process.env['TEMP_USER_ID'];
    return await findBusinessInfoByUserId(this.prisma, userId, this.logger);
  }

  async findByUserId(userId: string): Promise<BusinessInformation[]> {
    return await findBusinessInfoByUserId(this.prisma, userId, this.logger);
  }

  async findById(id: string): Promise<BusinessInformation | null> {
    return await findBusinessInfoById(this.prisma, id, this.logger);
  }

  async update(id: string, data: UpdateBusinessInfoData): Promise<BusinessInformation> {
    return await updateBusinessInfo(this.prisma, id, data, this.logger);
  }

  async delete(id: string): Promise<BusinessInformation> {
    const hasInvoices = await hasRelatedInvoices(this.prisma, id, this.logger);

    if (hasInvoices) {
      throw new HttpException(
        'Cannot delete business info that has related invoices',
        HttpStatus.CONFLICT,
      );
    }

    return await deleteBusinessInfo(this.prisma, id, this.logger);
  }
}
