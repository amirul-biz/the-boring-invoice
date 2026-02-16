import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { BusinessInformation } from '@prisma/client';
import { BusinessInfoPublicData, CreateBusinessInfoData, PaymentIntegrationCredential, UpdateBusinessInfoData } from './business-info-interface';

export async function createBusinessInfo(
  prisma: PrismaService,
  data: CreateBusinessInfoData,
  logger: Logger,
): Promise<BusinessInformation> {
  try {
    logger.log(`Creating business info for user: ${data.userId}`);
    const business = await prisma.businessInformation.create({ data });
    logger.log(`Business info created with ID: ${business.id}`);
    return business;
  } catch (error) {
    logger.error(`Failed to create business info: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to create business info',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function findBusinessInfoByUserId(
  prisma: PrismaService,
  userId: string,
  logger: Logger,
): Promise<BusinessInformation[]> {
  try {
    logger.log(`Looking up business info for user: ${userId}`);
    return await prisma.businessInformation.findMany({ where: { userId } });
  } catch (error) {
    logger.error(`Failed to find business info by userId: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to look up business info',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function findBusinessInfoById(
  prisma: PrismaService,
  id: string,
  logger: Logger,
): Promise<BusinessInformation> {
  try {
    logger.log(`Looking up business info by ID: ${id}`);
    const business = await prisma.businessInformation.findUnique({ where: { id } });

    if (!business) {
      throw new HttpException('Business info not found', HttpStatus.NOT_FOUND);
    }

    return business;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    logger.error(`Failed to find business info by ID: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to look up business info',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function findBusinessInfoPublicById(
  prisma: PrismaService,
  id: string,
  logger: Logger,
): Promise<BusinessInfoPublicData> {
  try {
    logger.log(`Looking up public business info by ID: ${id}`);
    const business = await prisma.businessInformation.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        businessEmail: true,
        taxIdentificationNumber: true,
        businessRegistrationNumber: true,
        businessActivityDescription: true,
        msicCode: true,
        categoryCode: true,
      },
    });

    if (!business) {
      throw new HttpException('Business info not found', HttpStatus.NOT_FOUND);
    }

    return business;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    logger.error(`Failed to find public business info by ID: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to look up business info',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getPaymentIntegrationCredential(
  prisma: PrismaService,
  id: string,
  logger: Logger,
): Promise<PaymentIntegrationCredential | null> {
  try {
    logger.log(`Looking up payment integration credential for business: ${id}`);
    return await prisma.businessInformation.findUnique({
      where: { id },
      select: {
        categoryCode: true,
        userSecretKey: true,
      },
    });
  } catch (error) {
    logger.error(`Failed to find payment integration credential: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to look up payment integration credential',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function updateBusinessInfo(
  prisma: PrismaService,
  id: string,
  data: UpdateBusinessInfoData,
  logger: Logger,
): Promise<BusinessInformation> {
  try {
    logger.log(`Updating business info: ${id}`);
    const business = await prisma.businessInformation.update({
      where: { id },
      data,
    });
    logger.log(`Business info updated: ${id}`);
    return business;
  } catch (error) {
    logger.error(`Failed to update business info: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to update business info',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function hasRelatedInvoices(
  prisma: PrismaService,
  businessId: string,
  logger: Logger,
): Promise<boolean> {
  try {
    logger.log(`Checking related invoices for business: ${businessId}`);
    const count = await prisma.invoice.count({ where: { businessId } });
    return count > 0;
  } catch (error) {
    logger.error(`Failed to check related invoices: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to check related invoices',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function deleteBusinessInfo(
  prisma: PrismaService,
  id: string,
  logger: Logger,
): Promise<BusinessInformation> {
  try {
    logger.log(`Deleting business info: ${id}`);
    const business = await prisma.businessInformation.delete({ where: { id } });
    logger.log(`Business info deleted: ${id}`);
    return business;
  } catch (error) {
    logger.error(`Failed to delete business info: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to delete business info',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
