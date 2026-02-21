// 1. RECIPIENT (BUYER) INTERFACE
export interface IRecipient {
  name: string;
  email?: string; // Optional as per @IsOptional()
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

// 2. SUPPLIER (YOUR SME) INTERFACE
export interface ISupplier {
  name: string;
  email?: string;
  tin: string;
  registrationNumber: string;
  msicCode: string;
  businessActivityDescription: string;
  idType: string;
  sstRegistrationNumber?: string;
  addressLine1: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
}

// 3. ITEM INTERFACE
export interface ICreateInvoiceItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  classificationCode: string;
  taxType: string;
  taxRate: number;
}

// 4. MAIN INPUT INTERFACE (The one you requested)
export interface ICreateInvoice {
  invoiceType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  originalInvoiceRef?: string;
  currency: string;
  supplier: ISupplier;
  recipient: IRecipient;
  dueDate: string;
  items: ICreateInvoiceItem[];
  invoiceVersion: string;
}