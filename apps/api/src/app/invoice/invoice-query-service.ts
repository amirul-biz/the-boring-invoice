import { Injectable, Logger, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';

import { PrismaService } from '@prismaService';
import { BusinessInfoService } from '../business-info/business-info-service';
import { CryptoService } from '../crypto/crypto.service';

import { InvoiceItemDTO, ProcessedInvoiceDto, SupplierDTO, RecipientDTO } from './invoice-dto';
import { decryptRecipient, decryptSupplier } from './invoice-utility/invoice-utility-crypto';
import { getInvoiceByNumber } from './invoice-repository/invoice-repository-get';
import { getInvoiceList, InvoiceListQuery, PaginatedInvoiceList } from './invoice-repository/invoice-repository-list';

@Injectable()
export class InvoiceQueryService {
  private readonly logger = new Logger(InvoiceQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessInfoService: BusinessInfoService,
    private readonly cryptoService: CryptoService,
  ) {}

  async getPaymentRedirectUrl(invoiceNo: string): Promise<string> {
    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);
    if (!invoice.billUrl) throw new HttpException('Payment link not available', HttpStatus.NOT_FOUND);
    return invoice.billUrl;
  }

  async getInvoiceList(encodedBusinessId: string, userId: string, query: InvoiceListQuery): Promise<PaginatedInvoiceList> {
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);
    const businessId = this.cryptoService.decodeId(encodedBusinessId);
    const result = await getInvoiceList(this.prisma, { ...query, businessId }, this.logger);
    result.items = result.items.map(item => ({
      ...item,
      recipientPhone: item.recipientPhone ? this.cryptoService.decrypt(item.recipientPhone) : '',
    }));
    return result;
  }

  async getInvoiceDetail(encodedBusinessId: string, invoiceNo: string, userId: string): Promise<ProcessedInvoiceDto> {
    await this.businessInfoService.verifyOwnership(encodedBusinessId, userId);
    const rawBusinessId = this.cryptoService.decodeId(encodedBusinessId);

    const invoice = await getInvoiceByNumber(this.prisma, invoiceNo, this.logger);

    if (invoice.businessId !== rawBusinessId) {
      throw new ForbiddenException('Invoice does not belong to this business');
    }

    return {
      invoiceNo: invoice.invoiceNo,
      invoiceType: invoice.invoiceType,
      originalInvoiceRef: invoice.originalInvoiceRef ?? undefined,
      currency: invoice.currency,
      status: invoice.status,
      issuedDate: invoice.issuedDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      supplier: decryptSupplier(invoice.supplier as unknown as SupplierDTO, this.cryptoService),
      recipient: decryptRecipient(invoice.recipient as unknown as RecipientDTO, this.cryptoService),
      items: invoice.items as any as InvoiceItemDTO[],
      totalNetAmount: parseFloat(invoice.totalNetAmount.toString()),
      totalTaxAmount: parseFloat(invoice.totalTaxAmount.toString()),
      totalDiscountAmount: parseFloat(invoice.totalDiscountAmount.toString()),
      totalPayableAmount: parseFloat(invoice.totalPayableAmount.toString()),
      billUrl: invoice.billUrl ?? undefined,
      invoiceVersion: invoice.invoiceVersion,
    };
  }
}
