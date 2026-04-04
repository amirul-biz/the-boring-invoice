import { CalculatedInvoiceDto } from './invoice-dto';

export interface CreateInvoiceMessage {
  businessId: string;
  calculatedInvoiceList: CalculatedInvoiceDto[];
}

export interface RetryInvoiceMessage {
  businessId: string;
  calculatedInvoice: CalculatedInvoiceDto;
  attemptNo: number;
}

export interface ToyyibPayCallbackData {
  refno: string;
  status: string;
  reason: string;
  billcode: string;
  order_id: string;
  amount: string;
  status_id: string;
  msg: string;
  transaction_id: string;
  fpx_transaction_id: string;
  hash: string;
  transaction_time: string;
}

export interface RetryPaymentCallbackMessage {
  callbackData: ToyyibPayCallbackData;
  attemptNo: number;
}

export interface FailedInvoiceMessage {
  businessId: string;
  calculatedInvoice: CalculatedInvoiceDto;
  error: string;
  failedAt: string;
}

export interface NotifyInvoiceViaEmailMessage {
  rawBusinessId: string;
  invoiceNumbers: string[];
  userId: string;
}

export interface DeactivateMessage {
  rawBusinessId: string;
  invoiceNumbers: string[];
  userId: string;
}

export interface RetryDeactivateMessage {
  rawBusinessId: string;
  invoiceNo: string;
  userId: string;
  attemptNo: number;
}

export interface MarkInvoicePaidMessage {
  rawBusinessId: string;
  invoiceNumbers: string[];
  userId: string;
}

export interface RetryMarkPaidMessage {
  rawBusinessId: string;
  invoiceNo: string;
  userId: string;
  attemptNo: number;
}
