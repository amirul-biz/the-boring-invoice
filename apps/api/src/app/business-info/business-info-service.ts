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
      businessEmail: this.cryptoService.encrypt(data.businessEmail),
      taxIdentificationNumber: this.cryptoService.encrypt(data.taxIdentificationNumber),
      businessRegistrationNumber: this.cryptoService.encrypt(data.businessRegistrationNumber),
      msicCode: this.cryptoService.encrypt(data.msicCode),
      sstRegistrationNumber: data.sstRegistrationNumber ? this.cryptoService.encrypt(data.sstRegistrationNumber) : undefined,
      userSecretKey: this.cryptoService.encrypt(data.userSecretKey.trim()),
    };
    const result = await createBusinessInfo(this.prisma, payload, this.logger);
    return { ...result, id: this.cryptoService.encodeId(result.id), userSecretKey: '***' };
  }

  async findByUserId(userId: string): Promise<BusinessInformation[]> {
    const results = await findBusinessInfoByUserId(this.prisma, userId, this.logger);
    return results.map((b) => ({
      ...b,
      id: this.cryptoService.encodeId(b.id),
      businessEmail: this.cryptoService.decrypt(b.businessEmail),
      taxIdentificationNumber: this.cryptoService.decrypt(b.taxIdentificationNumber),
      businessRegistrationNumber: this.cryptoService.decrypt(b.businessRegistrationNumber),
      msicCode: this.cryptoService.decrypt(b.msicCode),
      sstRegistrationNumber: b.sstRegistrationNumber ? this.cryptoService.decrypt(b.sstRegistrationNumber) : b.sstRegistrationNumber,
      userSecretKey: '***',
    }));
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
    return {
      ...result,
      id: this.cryptoService.encodeId(result.id),
      businessEmail: this.cryptoService.decrypt(result.businessEmail),
      taxIdentificationNumber: this.cryptoService.decrypt(result.taxIdentificationNumber),
      businessRegistrationNumber: this.cryptoService.decrypt(result.businessRegistrationNumber),
      msicCode: this.cryptoService.decrypt(result.msicCode),
      sstRegistrationNumber: result.sstRegistrationNumber ? this.cryptoService.decrypt(result.sstRegistrationNumber) : result.sstRegistrationNumber,
      userSecretKey: this.cryptoService.decrypt(result.userSecretKey),
    };
  }

  async findPublicById(encodedId: string): Promise<BusinessInfoPublicData> {
    const rawId = this.cryptoService.decodeId(encodedId);
    const result = await findBusinessInfoPublicById(this.prisma, rawId, this.logger);
    return {
      ...result,
      id: this.cryptoService.encodeId(result.id),
      businessEmail: this.cryptoService.decrypt(result.businessEmail),
      taxIdentificationNumber: this.cryptoService.decrypt(result.taxIdentificationNumber),
      businessRegistrationNumber: this.cryptoService.decrypt(result.businessRegistrationNumber),
      msicCode: this.cryptoService.decrypt(result.msicCode),
      sstRegistrationNumber: result.sstRegistrationNumber ? this.cryptoService.decrypt(result.sstRegistrationNumber) : result.sstRegistrationNumber,
    };
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
    if (data.businessEmail) payload.businessEmail = this.cryptoService.encrypt(data.businessEmail);
    if (data.taxIdentificationNumber) payload.taxIdentificationNumber = this.cryptoService.encrypt(data.taxIdentificationNumber);
    if (data.businessRegistrationNumber) payload.businessRegistrationNumber = this.cryptoService.encrypt(data.businessRegistrationNumber);
    if (data.msicCode) payload.msicCode = this.cryptoService.encrypt(data.msicCode);
    if (data.sstRegistrationNumber) payload.sstRegistrationNumber = this.cryptoService.encrypt(data.sstRegistrationNumber);
    if (data.userSecretKey) payload.userSecretKey = this.cryptoService.encrypt(data.userSecretKey.trim());
    const result = await updateBusinessInfo(this.prisma, rawId, payload, this.logger);
    return {
      ...result,
      id: this.cryptoService.encodeId(result.id),
      businessEmail: this.cryptoService.decrypt(result.businessEmail),
      taxIdentificationNumber: this.cryptoService.decrypt(result.taxIdentificationNumber),
      businessRegistrationNumber: this.cryptoService.decrypt(result.businessRegistrationNumber),
      msicCode: this.cryptoService.decrypt(result.msicCode),
      sstRegistrationNumber: result.sstRegistrationNumber ? this.cryptoService.decrypt(result.sstRegistrationNumber) : result.sstRegistrationNumber,
      userSecretKey: '***',
    };
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
