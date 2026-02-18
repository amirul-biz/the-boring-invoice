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
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class BusinessInfoService {
  private readonly logger = new Logger(BusinessInfoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(userId: string, data: CreateBusinessInfoBody): Promise<BusinessInformation> {
    const payload = {
      ...data,
      userId,
      userSecretKey: this.cryptoService.encrypt(data.userSecretKey),
    };
    const result = await createBusinessInfo(this.prisma, payload, this.logger);
    return { ...result, id: this.cryptoService.encodeId(result.id), userSecretKey: '***' };
  }

  async findByUserId(userId: string): Promise<BusinessInformation[]> {
    const results = await findBusinessInfoByUserId(this.prisma, userId, this.logger);
    return results.map((b) => ({ ...b, id: this.cryptoService.encodeId(b.id), userSecretKey: '***' }));
  }

  async verifyOwnership(encodedId: string, userId: string): Promise<void> {
    const rawId = this.cryptoService.decodeId(encodedId);
    const business = await findBusinessInfoById(this.prisma, rawId, this.logger);
    if (business.userId !== userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  async findById(encodedId: string, userId: string): Promise<BusinessInformation> {
    const rawId = this.cryptoService.decodeId(encodedId);
    const result = await findBusinessInfoById(this.prisma, rawId, this.logger);
    if (result.userId !== userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return { ...result, id: this.cryptoService.encodeId(result.id), userSecretKey: '***' };
  }

  async findPublicById(encodedId: string): Promise<BusinessInfoPublicData> {
    const rawId = this.cryptoService.decodeId(encodedId);
    const result = await findBusinessInfoPublicById(this.prisma, rawId, this.logger);
    return { ...result, id: this.cryptoService.encodeId(result.id) };
  }

  /**
   * Internal use only — accepts raw UUID from RabbitMQ queue consumer.
   * Do NOT call this with an encoded ID.
   */
  async getPaymentIntegrationCredential(rawId: string): Promise<PaymentIntegrationCredential> {
    try {
      this.logger.log(`Getting payment integration credential for business: ${rawId}`);
      const credential = await getPaymentIntegrationCredential(this.prisma, rawId, this.logger);

      if (!credential) {
        throw new HttpException(
          'Business info not found for payment integration',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        ...credential,
        userSecretKey: this.cryptoService.decrypt(credential.userSecretKey),
      };
    } catch (error) {
      this.logger.error(`Failed to get payment integration credential: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(encodedId: string, userId: string, data: UpdateBusinessInfoData): Promise<BusinessInformation> {
    await this.verifyOwnership(encodedId, userId);
    const rawId = this.cryptoService.decodeId(encodedId);
    const payload: UpdateBusinessInfoData = { ...data };
    if (data.userSecretKey) {
      payload.userSecretKey = this.cryptoService.encrypt(data.userSecretKey);
    }
    const result = await updateBusinessInfo(this.prisma, rawId, payload, this.logger);
    return { ...result, id: this.cryptoService.encodeId(result.id), userSecretKey: '***' };
  }

  async delete(encodedId: string, userId: string): Promise<BusinessInformation> {
    await this.verifyOwnership(encodedId, userId);
    const rawId = this.cryptoService.decodeId(encodedId);
    const hasInvoices = await hasRelatedInvoices(this.prisma, rawId, this.logger);

    if (hasInvoices) {
      throw new HttpException(
        'Cannot delete business info that has related invoices',
        HttpStatus.CONFLICT,
      );
    }

    return await deleteBusinessInfo(this.prisma, rawId, this.logger);
  }
}
