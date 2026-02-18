import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';

export interface InvoiceListQuery {
  pageIndex: number;
  pageSize: number;
  invoiceType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InvoiceListParams extends InvoiceListQuery {
  businessId: string;
}

export interface InvoiceListItem {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  recipientName: string;
  totalIncludingTax: number;
  currency: string;
  status: string;
  issuedDate: string;
  dueDate: string;
  billUrl: string | null;
}

export interface InvoiceSummary {
  pendingAmount: number;
  totalPaid: number;
  pendingCount: number;
  paidCount: number;
}

export interface PaginatedInvoiceList {
  items: InvoiceListItem[];
  totalPageCount: number;
  totalItemCount: number;
  pageNumber: number;
  pageSize: number;
  invoiceSummary: InvoiceSummary;
}

export async function getInvoiceList(
  prisma: PrismaService,
  params: InvoiceListParams,
  logger: Logger,
): Promise<PaginatedInvoiceList> {
  try {
    logger.log(`Fetching invoice list for business: ${params.businessId}, page: ${params.pageIndex}, size: ${params.pageSize}`);

    const where: any = { businessId: params.businessId };

    if (params.invoiceType) {
      where.invoiceType = params.invoiceType;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.dateFrom || params.dateTo) {
      where.issuedDate = {};
      if (params.dateFrom) {
        where.issuedDate.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        where.issuedDate.lte = new Date(params.dateTo + 'T23:59:59.999Z');
      }
    }

    const skip = (params.pageIndex - 1) * params.pageSize;

    const [invoices, totalItemCount, summaryGroups] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { issuedDate: 'desc' },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ['status'],
        where,
        _sum: { totalIncludingTax: true },
        _count: true,
      }),
    ]);

    const items: InvoiceListItem[] = invoices.map((invoice) => {
      const recipient = invoice.recipient as any;
      return {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceType: invoice.invoiceType,
        recipientName: recipient?.name || '',
        totalIncludingTax: parseFloat(invoice.totalIncludingTax.toString()),
        currency: invoice.currency,
        status: invoice.status,
        issuedDate: invoice.issuedDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        billUrl: invoice.billUrl || null,
      };
    });

    const totalPageCount = Math.ceil(totalItemCount / params.pageSize);

    const pendingGroup = summaryGroups.find((g) => g.status === 'PENDING');
    const paidGroup = summaryGroups.find((g) => g.status === 'PAID');

    const invoiceSummary: InvoiceSummary = {
      pendingAmount: pendingGroup?._sum.totalIncludingTax ? parseFloat(pendingGroup._sum.totalIncludingTax.toString()) : 0,
      totalPaid: paidGroup?._sum.totalIncludingTax ? parseFloat(paidGroup._sum.totalIncludingTax.toString()) : 0,
      pendingCount: pendingGroup?._count ?? 0,
      paidCount: paidGroup?._count ?? 0,
    };

    logger.log(`Found ${totalItemCount} invoices, returning page ${params.pageIndex} of ${totalPageCount}`);

    return {
      items,
      totalPageCount,
      totalItemCount,
      pageNumber: params.pageIndex,
      pageSize: params.pageSize,
      invoiceSummary,
    };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    logger.error(`Failed to fetch invoice list: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to fetch invoice list',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
