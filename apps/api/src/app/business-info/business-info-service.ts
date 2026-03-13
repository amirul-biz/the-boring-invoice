import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { BusinessInformation } from '@prisma/client';
import { BusinessInfoPublicData, CreateBusinessInfoData, PaymentIntegrationCredential } from './business-info-interface';
import { CreateBusinessInfoDTO, UpdateBusinessInfoDTO } from './business-info-dto';
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

  async create(userId: string, data: CreateBusinessInfoDTO): Promise<BusinessInformation> {
    const payload: CreateBusinessInfoData = {
      ...data,
      userId,
      ...this.buildEncryptedPayload(data),
    };
    const result = await createBusinessInfo(this.prisma, payload, this.logger);
    return this.decryptBusinessInfo(result);
  }

  async findByUserId(userId: string): Promise<BusinessInformation[]> {
    const results = await findBusinessInfoByUserId(this.prisma, userId, this.logger);
    return results.map(b => this.decryptBusinessInfo(b));
  }

  async findById(encodedId: string, userId: string): Promise<BusinessInformation> {
    const rawId = this.cryptoService.decodeId(encodedId);
    const result = await findBusinessInfoById(this.prisma, rawId, this.logger);
    if (result.userId !== userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.decryptBusinessInfo(result, { showSecret: true });
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
      businessContactNumber: result.businessContactNumber ? this.cryptoService.decrypt(result.businessContactNumber) : result.businessContactNumber,
    };
  }

  async verifyOwnership(encodedId: string, userId: string): Promise<void> {
    const rawId = this.cryptoService.decodeId(encodedId);
    const business = await findBusinessInfoById(this.prisma, rawId, this.logger);
    if (business.userId !== userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
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
        throw new HttpException('Business info not found for payment integration', HttpStatus.NOT_FOUND);
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

  async update(encodedId: string, userId: string, data: UpdateBusinessInfoDTO): Promise<BusinessInformation> {
    await this.verifyOwnership(encodedId, userId);
    const rawId = this.cryptoService.decodeId(encodedId);
    const payload: UpdateBusinessInfoDTO = { ...data, ...this.buildEncryptedPayload(data) };
    const result = await updateBusinessInfo(this.prisma, rawId, payload, this.logger);
    return this.decryptBusinessInfo(result);
  }

  async delete(encodedId: string, userId: string): Promise<BusinessInformation> {
    await this.verifyOwnership(encodedId, userId);
    const rawId = this.cryptoService.decodeId(encodedId);

    const hasInvoices = await hasRelatedInvoices(this.prisma, rawId, this.logger);
    if (hasInvoices) {
      throw new HttpException('Cannot delete business info that has related invoices', HttpStatus.CONFLICT);
    }

    return await deleteBusinessInfo(this.prisma, rawId, this.logger);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Decrypt all encrypted fields and encode the ID for HTTP responses.
   * Pass `showSecret: true` only for the authenticated owner edit view.
   * @private
   */
  private decryptBusinessInfo(b: BusinessInformation, options: { showSecret?: boolean } = {}): BusinessInformation {
    return {
      ...b,
      id: this.cryptoService.encodeId(b.id),
      businessEmail: this.cryptoService.decrypt(b.businessEmail),
      taxIdentificationNumber: this.cryptoService.decrypt(b.taxIdentificationNumber),
      businessRegistrationNumber: this.cryptoService.decrypt(b.businessRegistrationNumber),
      msicCode: this.cryptoService.decrypt(b.msicCode),
      sstRegistrationNumber: b.sstRegistrationNumber ? this.cryptoService.decrypt(b.sstRegistrationNumber) : b.sstRegistrationNumber,
      businessContactNumber: b.businessContactNumber ? this.cryptoService.decrypt(b.businessContactNumber) : b.businessContactNumber,
      userSecretKey: options.showSecret ? this.cryptoService.decrypt(b.userSecretKey) : '***',
    };
  }

  /**
   * Encrypt only the fields that are present in the payload.
   * Works for both create (all fields required) and update (partial fields).
   * @private
   */
  private buildEncryptedPayload(data: Partial<Omit<CreateBusinessInfoDTO, 'address'>>): Partial<Omit<CreateBusinessInfoDTO, 'address'>> {
    const encrypted: Partial<Omit<CreateBusinessInfoDTO, 'address'>> = {};
    if (data.businessEmail !== undefined) encrypted.businessEmail = this.cryptoService.encrypt(data.businessEmail);
    if (data.taxIdentificationNumber !== undefined) encrypted.taxIdentificationNumber = this.cryptoService.encrypt(data.taxIdentificationNumber);
    if (data.businessRegistrationNumber !== undefined) encrypted.businessRegistrationNumber = this.cryptoService.encrypt(data.businessRegistrationNumber);
    if (data.msicCode !== undefined) encrypted.msicCode = this.cryptoService.encrypt(data.msicCode);
    if (data.sstRegistrationNumber !== undefined) encrypted.sstRegistrationNumber = this.cryptoService.encrypt(data.sstRegistrationNumber);
    if (data.businessContactNumber !== undefined) encrypted.businessContactNumber = this.cryptoService.encrypt(data.businessContactNumber);
    if (data.userSecretKey !== undefined) encrypted.userSecretKey = this.cryptoService.encrypt(data.userSecretKey.trim());
    return encrypted;
  }
}
