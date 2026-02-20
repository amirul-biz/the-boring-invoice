// 1. RECIPIENT (BUYER) INTERFACE
export interface IRecipient {
  name: string;
  email?: string; // Optional as per @IsOptional()
  phone: string;
  tin: string;
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
}

// 3. ITEM INTERFACE
export interface ICreateInvoiceItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  classificationCode: string;
}

// 4. MAIN INPUT INTERFACE (The one you requested)
export interface ICreateInvoice {
  invoiceType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  currency: string;
  supplier: ISupplier;
  recipient: IRecipient;
  taxRate: number;
  dueDate: string;
  items: ICreateInvoiceItem[];
}