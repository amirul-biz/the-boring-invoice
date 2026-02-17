import { IInvoiceListItem, IGetPaginatedInvoiceList, IInvoiceSummary } from './invoice-listing-interface';

export const MOCK_INVOICES: IInvoiceListItem[] = [
  {
    id: 'inv-001',
    invoiceNo: '2026-0216-INV-0001',
    invoiceType: 'Invoice',
    recipientName: 'Ahmad Bin Ali',
    totalIncludingTax: 162.00,
    currency: 'MYR',
    status: 'PAID',
    issuedDate: '2026-02-01T08:00:00Z',
    dueDate: '2026-02-15T08:00:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-001',
  },
  {
    id: 'inv-002',
    invoiceNo: '2026-0216-INV-0002',
    invoiceType: 'Invoice',
    recipientName: 'Siti Nurhaliza Binti Mohd',
    totalIncludingTax: 324.00,
    currency: 'MYR',
    status: 'PENDING',
    issuedDate: '2026-02-03T10:30:00Z',
    dueDate: '2026-02-17T10:30:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-002',
  },
  {
    id: 'inv-003',
    invoiceNo: '2026-0216-INV-0003',
    invoiceType: 'Credit Note',
    recipientName: 'Tan Wei Ming',
    totalIncludingTax: 86.40,
    currency: 'MYR',
    status: 'PAID',
    issuedDate: '2026-02-05T14:00:00Z',
    dueDate: '2026-02-19T14:00:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-003',
  },
  {
    id: 'inv-004',
    invoiceNo: '2026-0216-INV-0004',
    invoiceType: 'Invoice',
    recipientName: 'Rajesh Kumar A/L Subramaniam',
    totalIncludingTax: 540.00,
    currency: 'MYR',
    status: 'PENDING',
    issuedDate: '2026-02-07T09:15:00Z',
    dueDate: '2026-02-21T09:15:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-004',
  },
  {
    id: 'inv-005',
    invoiceNo: '2026-0216-INV-0005',
    invoiceType: 'Debit Note',
    recipientName: 'Lim Chee Keong',
    totalIncludingTax: 210.60,
    currency: 'MYR',
    status: 'CANCELLED',
    issuedDate: '2026-02-08T11:00:00Z',
    dueDate: '2026-02-22T11:00:00Z',
    billUrl: null,
  },
  {
    id: 'inv-006',
    invoiceNo: '2026-0216-INV-0006',
    invoiceType: 'Invoice',
    recipientName: 'Nurul Aina Binti Hassan',
    totalIncludingTax: 432.00,
    currency: 'MYR',
    status: 'PAID',
    issuedDate: '2026-02-10T08:45:00Z',
    dueDate: '2026-02-24T08:45:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-006',
  },
  {
    id: 'inv-007',
    invoiceNo: '2026-0216-INV-0007',
    invoiceType: 'Invoice',
    recipientName: 'Muhammad Faiz Bin Ismail',
    totalIncludingTax: 270.00,
    currency: 'MYR',
    status: 'PENDING',
    issuedDate: '2026-02-12T13:20:00Z',
    dueDate: '2026-02-26T13:20:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-007',
  },
  {
    id: 'inv-008',
    invoiceNo: '2026-0216-INV-0008',
    invoiceType: 'Invoice',
    recipientName: 'Wong Mei Ling',
    totalIncludingTax: 648.00,
    currency: 'MYR',
    status: 'PAID',
    issuedDate: '2026-02-14T16:00:00Z',
    dueDate: '2026-02-28T16:00:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-008',
  },
  {
    id: 'inv-009',
    invoiceNo: '2026-0216-INV-0009',
    invoiceType: 'Credit Note',
    recipientName: 'Amirul Irfan Bin Khairul',
    totalIncludingTax: 150.00,
    currency: 'MYR',
    status: 'PENDING',
    issuedDate: '2026-02-15T10:00:00Z',
    dueDate: '2026-03-01T10:00:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-009',
  },
  {
    id: 'inv-010',
    invoiceNo: '2026-0216-INV-0010',
    invoiceType: 'Invoice',
    recipientName: 'Priya A/P Rajan',
    totalIncludingTax: 189.00,
    currency: 'MYR',
    status: 'PAID',
    issuedDate: '2026-02-16T07:30:00Z',
    dueDate: '2026-03-02T07:30:00Z',
    billUrl: 'https://toyyibpay.com/sample-bill-010',
  },
];

export function getMockPaginatedInvoiceList(
  page: number,
  pageSize: number,
): IGetPaginatedInvoiceList {
  const start = (page - 1) * pageSize;
  const items = MOCK_INVOICES.slice(start, start + pageSize);

  return {
    items,
    totalPageCount: Math.ceil(MOCK_INVOICES.length / pageSize),
    totalItemCount: MOCK_INVOICES.length,
    pageNumber: page,
    pageSize,
  };
}

export function getMockInvoiceSummary(): IInvoiceSummary {
  const pendingInvoices = MOCK_INVOICES.filter(i => i.status === 'PENDING');
  const paidInvoices = MOCK_INVOICES.filter(i => i.status === 'PAID');

  return {
    pendingAmount: pendingInvoices.reduce((sum, i) => sum + i.totalIncludingTax, 0),
    totalPaid: paidInvoices.reduce((sum, i) => sum + i.totalIncludingTax, 0),
    pendingCount: pendingInvoices.length,
    paidCount: paidInvoices.length,
  };
}
