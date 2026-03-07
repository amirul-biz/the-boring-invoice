import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { tap, finalize, Subject, takeUntil, first } from 'rxjs';
import { confirmModal, successModal, errorModal } from '../shared/modal.util';
import { InvoiceListingService } from './invoice-listing-service';
import { IInvoiceListItem, IInvoiceSummary } from './invoice-listing-interface';
import { InvoiceListingTableComponent } from './invoice-listing-table/invoice-listing-table';
import { InvoiceDetailModalComponent } from './invoice-detail-modal/invoice-detail-modal';
import { getInvoiceListingFilterForm, InvoiceListingFilterForm } from './invoice-listing-form.config';
import { PAGE_SIZES, INVOICE_TYPES, INVOICE_STATUSES } from '../invoice/invoice-constants';

@Component({
  selector: 'app-invoice-listing',
  imports: [CommonModule, NgxSpinnerModule, ReactiveFormsModule, InvoiceListingTableComponent],
  templateUrl: './invoice-listing.html',
  styleUrl: './invoice-listing.scss',
})
export class InvoiceListing implements OnInit, OnDestroy {
  private invoiceListingService = inject(InvoiceListingService);
  private spinner = inject(NgxSpinnerService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private modalService = inject(NgbModal);
  private destroy$ = new Subject<void>();

  invoices: IInvoiceListItem[] = [];
  summary: IInvoiceSummary = { pendingAmount: 0, totalPaid: 0, pendingCount: 0, paidCount: 0 };
  page = 1;
  totalItems = 0;
  private businessId = '';

  filterForm: FormGroup<InvoiceListingFilterForm> = getInvoiceListingFilterForm();
  pageSizes = PAGE_SIZES;
  invoiceTypes = INVOICE_TYPES;
  invoiceStatuses = INVOICE_STATUSES;

  ngOnInit(): void {
    this.businessId = this.route.snapshot.paramMap.get('businessId') || '';
    this.getInvoiceList();

    this.filterForm.controls.pageSize.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        this.getInvoiceList();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getInvoiceList(): void {
    this.spinner.show();

    const formValue = this.filterForm.getRawValue();

    this.invoiceListingService.getInvoiceList(this.businessId, {
      pageIndex: this.page,
      pageSize: formValue.pageSize,
      invoiceType: formValue.invoiceType,
      status: formValue.status,
      dateFrom: formValue.dateFrom,
      dateTo: formValue.dateTo,
    }).pipe(
      tap((data) => {
        this.invoices = data.items.map(item => ({ ...item, isChecked: false }));
        this.totalItems = data.totalItemCount;
        this.summary = data.invoiceSummary;
        this.cdr.markForCheck();
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  onSearch(): void {
    this.page = 1;
    this.getInvoiceList();
  }

  onReset(): void {
    this.filterForm.reset({ pageSize: 10, dateFrom: null, dateTo: null, invoiceType: null, status: null });
    this.page = 1;
    this.getInvoiceList();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.getInvoiceList();
  }

  async onNotifyInvoiceByEmail(invoice: IInvoiceListItem): Promise<void> {
    const confirmed = await confirmModal(
      'Send Notification?',
      `Re-send the invoice email for ${invoice.invoiceNo} to the recipient?`,
    );
    if (!confirmed) return;

    this.spinner.show();
    this.invoiceListingService
      .notifyInvoiceByEmail(this.businessId, [invoice.invoiceNo])
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: async () => {
          await successModal('Queued', `Notification email for ${invoice.invoiceNo} has been queued.`);
        },
        error: async (err) => {
          const message = err?.error?.message || 'Failed to queue notification email.';
          await errorModal('Error', message);
        },
      });
  }

  async onDeactivateInvoice(invoice: IInvoiceListItem): Promise<void> {
    const confirmed = await confirmModal(
      'Deactivate Invoice?',
      `Invoice ${invoice.invoiceNo} will be cancelled and its payment link deactivated. This cannot be undone.`,
    );
    if (!confirmed) return;

    this.spinner.show();
    this.invoiceListingService
      .deactivateInvoice(this.businessId, invoice.invoiceNo)
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: async () => {
          await successModal('Deactivated', `Invoice ${invoice.invoiceNo} has been deactivated.`);
          this.getInvoiceList();
        },
        error: async (err) => {
          const message = err?.error?.message || 'Failed to deactivate invoice.';
          await errorModal('Error', message);
        },
      });
  }

  get checkedCount(): number {
    return this.invoices.filter(i => i.isChecked).length;
  }

  getCheckedInvoice(): string[] {
    return this.invoices.filter(i => i.isChecked).map(i => i.invoiceNo);
  }

  async onBatchNotifyByEmail(): Promise<void> {
    const invoiceNumbers = this.getCheckedInvoice();
    if (invoiceNumbers.length === 0) return;

    const confirmed = await confirmModal(
      `Notify ${invoiceNumbers.length} Invoice(s) via Email?`,
      `Send email notification for: ${invoiceNumbers.join(', ')}`,
    );
    if (!confirmed) return;

    this.spinner.show();
    this.invoiceListingService
      .notifyInvoiceByEmail(this.businessId, invoiceNumbers)
      .pipe(finalize(() => this.spinner.hide()))
      .subscribe({
        next: async () => {
          await successModal('Queued', `Email notification queued for ${invoiceNumbers.length} invoice(s).`);
        },
        error: async (err) => {
          const message = err?.error?.message || 'Failed to queue notification emails.';
          await errorModal('Error', message);
        },
      });
  }

  checkUncheckAll(): void {
    const allChecked = this.invoices
      .filter(i => i.status === 'PENDING')
      .every(i => i.isChecked);

    this.invoices = this.invoices.map(i => ({
      ...i,
      isChecked: i.status === 'PENDING' ? !allChecked : false,
    }));
    this.cdr.markForCheck();
  }

  checkUncheckSingle(invoice: IInvoiceListItem): void {
    this.invoices = this.invoices.map(i =>
      i.id === invoice.id ? { ...i, isChecked: !i.isChecked } : i,
    );
    this.cdr.markForCheck();
  }

  onNotifyInvoiceByWhatsApp(invoice: IInvoiceListItem): void {
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const lines = [
      `Hello ${invoice.recipientName}!`,
      ``,
      `You have an outstanding invoice from us.`,
      ``,
      `Invoice No: ${invoice.invoiceNo}`,
      `Amount Due: ${invoice.currency} ${invoice.totalPayableAmount.toFixed(2)}`,
      `Due Date: ${dueDate}`,
    ];

    if (invoice.billUrl) {
      lines.push(``, `Pay here: ${invoice.billUrl}`);
    }

    lines.push(
      ``,
      `To view the full invoice details, please check your email and search for *${invoice.invoiceNo}*.`,
    );

    const message = lines.join('\n');
    const url = `https://wa.me/${invoice.recipientPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  onAction(event: { type: string; invoice: IInvoiceListItem }): void {
    switch (event.type) {
      case 'view-detail': {
        this.spinner.show();
        this.invoiceListingService
          .getInvoiceDetail(this.businessId, event.invoice.invoiceNo)
          .pipe(
            first(),
            finalize(() => this.spinner.hide()),
          )
          .subscribe({
            next: (detail) => {
              const ref = this.modalService.open(InvoiceDetailModalComponent, {
                size: 'lg',
                centered: true,
                scrollable: true,
              });
              ref.componentInstance.detail = detail;
            },
            error: async () => {
              await errorModal('Error', 'Failed to load invoice details.');
            },
          });
        break;
      }
      case 'notify-email':
        this.onNotifyInvoiceByEmail(event.invoice);
        break;
      case 'check-single':
        this.checkUncheckSingle(event.invoice);
        break;
      case 'notify-whatsapp':
        this.onNotifyInvoiceByWhatsApp(event.invoice);
        break;
      case 'deactivate':
        this.onDeactivateInvoice(event.invoice);
        break;
      case 'download':
        alert(`Download: ${event.invoice.invoiceNo}`);
        break;
    }
  }
}
