import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { BusinessInformation } from '@prisma/client';
import { BusinessInfoPublicData, CreateBusinessInfoBody, PaymentIntegrationCredential, UpdateBusinessInfoData } from './business-info-interface';
import {
  createBusinessInfo,
  findBusinessInfoByUserId,
  findBusinessInfoById,
  findBusinessInfoPublicById,
  getPaymentIntegrationCredential,
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

  async findById(id: string): Promise<BusinessInformation> {
    return await findBusinessInfoById(this.prisma, id, this.logger);
  }

  async findPublicById(id: string): Promise<BusinessInfoPublicData> {
    return await findBusinessInfoPublicById(this.prisma, id, this.logger);
  }

  async getPaymentIntegrationCredential(id: string): Promise<PaymentIntegrationCredential> {
    try {
      this.logger.log(`Getting payment integration credential for business: ${id}`);
      const credential = await getPaymentIntegrationCredential(this.prisma, id, this.logger);

      if (!credential) {
        throw new HttpException(
          'Business info not found for payment integration',
          HttpStatus.NOT_FOUND,
        );
      }

      return credential;
    } catch (error) {
      this.logger.error(`Failed to get payment integration credential: ${error.message}`, error.stack);
      throw error;
    }
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
