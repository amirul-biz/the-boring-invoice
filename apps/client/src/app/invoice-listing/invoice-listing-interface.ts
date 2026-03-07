export interface IInvoiceListItem {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  recipientName: string;
  totalPayableAmount: number;
  recipientPhone: string;
  currency: string;
  status: string;
  issuedDate: string;
  dueDate: string;
  billUrl: string | null;
  isChecked: boolean
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

export interface IInvoiceDetailItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxType: string;
  taxRate: number;
  classificationCode: string;
}

export interface IInvoiceDetailSupplier {
  name: string;
  email?: string;
  tin: string;
  registrationNumber: string;
  msicCode: string;
  businessActivityDescription: string;
  idType: string;
  sstRegistrationNumber?: string;
  contactNumber: string;
  addressLine1: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
}

export interface IInvoiceDetailRecipient {
  name: string;
  email?: string;
  phone: string;
  tin: string;
  idType: string;
  registrationNumber: string;
  addressLine1: string;
  postcode: string;
  city: string;
  state: string;
  countryCode: string;
}

export interface IInvoiceDetail {
  invoiceNo: string;
  invoiceType: string;
  originalInvoiceRef?: string;
  currency: string;
  status: string;
  issuedDate: string;
  dueDate: string;
  billUrl?: string;
  supplier: IInvoiceDetailSupplier;
  recipient: IInvoiceDetailRecipient;
  items: IInvoiceDetailItem[];
  totalNetAmount: number;
  totalTaxAmount: number;
  totalDiscountAmount: number;
  totalPayableAmount: number;
}
