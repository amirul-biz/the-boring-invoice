import { Injectable } from '@nestjs/common';

import { CreateInvoiceInputDTO, ProcessedInvoiceDto } from './invoice-dto';
import {
  CreateInvoiceMessage,
  DeactivateMessage,
  FailedInvoiceMessage,
  MarkInvoicePaidMessage,
  NotifyInvoiceViaEmailMessage,
  RetryDeactivateMessage,
  RetryInvoiceMessage,
  RetryMarkPaidMessage,
  RetryPaymentCallbackMessage,
  ToyyibPayCallbackData,
} from './invoice-messages';
import { InvoiceListQuery, PaginatedInvoiceList } from './invoice-repository/invoice-repository-list';
import { InvoiceCreateService } from './invoice-create-service';
import { InvoicePaymentCallbackService } from './invoice-payment-callback-service';
import { InvoiceDeactivateService } from './invoice-deactivate-service';
import { InvoiceMarkPaidService } from './invoice-mark-paid-service';
import { InvoiceNotifyService } from './invoice-notify-service';
import { InvoiceQueryService } from './invoice-query-service';

// Re-export all message interfaces for backwards compatibility with invoice-controller
export {
  CreateInvoiceMessage,
  RetryInvoiceMessage,
  ToyyibPayCallbackData,
  RetryPaymentCallbackMessage,
  FailedInvoiceMessage,
  NotifyInvoiceViaEmailMessage,
  DeactivateMessage,
  RetryDeactivateMessage,
  MarkInvoicePaidMessage,
  RetryMarkPaidMessage,
} from './invoice-messages';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly createService: InvoiceCreateService,
    private readonly paymentCallbackService: InvoicePaymentCallbackService,
    private readonly deactivateService: InvoiceDeactivateService,
    private readonly markPaidService: InvoiceMarkPaidService,
    private readonly notifyService: InvoiceNotifyService,
    private readonly queryService: InvoiceQueryService,
  ) {}

  // ─── Invoice creation ─────────────────────────────────────────────────────────

  queueInvoiceGeneration(invoiceDataList: CreateInvoiceInputDTO[], encodedBusinessId: string, userId: string) {
    return this.createService.queueInvoiceGeneration(invoiceDataList, encodedBusinessId, userId);
  }

  processInvoiceBatch(businessId: string, calculatedInvoiceList: CreateInvoiceMessage['calculatedInvoiceList']) {
    return this.createService.processInvoiceBatch(businessId, calculatedInvoiceList);
  }

  processInvoiceRetry(msg: RetryInvoiceMessage) {
    return this.createService.processInvoiceRetry(msg);
  }

  processFailedInvoice(msg: FailedInvoiceMessage) {
    return this.createService.processFailedInvoice(msg);
  }

  // ─── Payment callback ─────────────────────────────────────────────────────────

  queuePaymentCallback(callbackData: ToyyibPayCallbackData) {
    return this.paymentCallbackService.queuePaymentCallback(callbackData);
  }

  processPaymentCallbackFromQueue(callbackData: ToyyibPayCallbackData) {
    return this.paymentCallbackService.processPaymentCallbackFromQueue(callbackData);
  }

  processPaymentCallbackRetry(msg: RetryPaymentCallbackMessage) {
    return this.paymentCallbackService.processPaymentCallbackRetry(msg);
  }

  // ─── Deactivate ───────────────────────────────────────────────────────────────

  queueDeactivateBatch(encodedBusinessId: string, invoiceNumbers: string[], userId: string) {
    return this.deactivateService.queueDeactivateBatch(encodedBusinessId, invoiceNumbers, userId);
  }

  processDeactivateSingle(data: DeactivateMessage) {
    return this.deactivateService.processDeactivateSingle(data);
  }

  processDeactivateRetry(msg: RetryDeactivateMessage) {
    return this.deactivateService.processDeactivateRetry(msg);
  }

  processDeactivateFailed(msg: RetryDeactivateMessage & { error: string; failedAt: string }) {
    return this.deactivateService.processDeactivateFailed(msg);
  }

  // ─── Mark as paid ─────────────────────────────────────────────────────────────

  queueMarkInvoicePaidBatch(encodedBusinessId: string, invoiceNumbers: string[], userId: string) {
    return this.markPaidService.queueMarkInvoicePaidBatch(encodedBusinessId, invoiceNumbers, userId);
  }

  processMarkInvoicePaidBatch(data: MarkInvoicePaidMessage) {
    return this.markPaidService.processMarkInvoicePaidBatch(data);
  }

  processMarkPaidRetry(msg: RetryMarkPaidMessage) {
    return this.markPaidService.processMarkPaidRetry(msg);
  }

  processMarkPaidFailed(msg: RetryMarkPaidMessage & { error: string; failedAt: string }) {
    return this.markPaidService.processMarkPaidFailed(msg);
  }

  // ─── Email notifications ──────────────────────────────────────────────────────

  queueNotifyInvoiceViaEmailBatch(encodedBusinessId: string, invoiceNumbers: string[], userId: string) {
    return this.notifyService.queueNotifyInvoiceViaEmailBatch(encodedBusinessId, invoiceNumbers, userId);
  }

  processNotifyInvoiceViaEmailBatch(data: NotifyInvoiceViaEmailMessage) {
    return this.notifyService.processNotifyInvoiceViaEmailBatch(data);
  }

  // ─── Queries ──────────────────────────────────────────────────────────────────

  getBillStatus(billCode: string) {
    return this.queryService.getBillStatus(billCode);
  }

  getPaymentRedirectUrl(invoiceNo: string) {
    return this.queryService.getPaymentRedirectUrl(invoiceNo);
  }

  getInvoiceList(encodedBusinessId: string, userId: string, query: InvoiceListQuery): Promise<PaginatedInvoiceList> {
    return this.queryService.getInvoiceList(encodedBusinessId, userId, query);
  }

  getInvoiceDetail(encodedBusinessId: string, invoiceNo: string, userId: string): Promise<ProcessedInvoiceDto> {
    return this.queryService.getInvoiceDetail(encodedBusinessId, invoiceNo, userId);
  }

  downloadInvoicePdf(encodedBusinessId: string, invoiceNo: string, userId: string): Promise<Buffer> {
    return this.queryService.downloadInvoicePdf(encodedBusinessId, invoiceNo, userId);
  }

  downloadReceiptPdf(encodedBusinessId: string, invoiceNo: string, userId: string): Promise<Buffer> {
    return this.queryService.downloadReceiptPdf(encodedBusinessId, invoiceNo, userId);
  }
}
