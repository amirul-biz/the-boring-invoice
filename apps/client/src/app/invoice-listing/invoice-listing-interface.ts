export interface IInvoiceListItem {
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

export interface IGetPaginatedInvoiceList {
  items: IInvoiceListItem[];
  totalPageCount: number;
  totalItemCount: number;
  pageNumber: number;
  pageSize: number;
  invoiceSummary: IInvoiceSummary;
}

export interface IInvoiceSummary {
  pendingAmount: number;
  totalPaid: number;
  pendingCount: number;
  paidCount: number;
}
