import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { tap, finalize, Subject, takeUntil } from 'rxjs';
import { confirmModal, successModal, errorModal } from '../shared/modal.util';
import { InvoiceListingService } from './invoice-listing-service';
import { IInvoiceListItem, IInvoiceSummary } from './invoice-listing-interface';
import { InvoiceListingTableComponent } from './invoice-listing-table/invoice-listing-table';
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
        this.invoices = data.items;
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

  onAction(event: { type: string; invoice: IInvoiceListItem }): void {
    switch (event.type) {
      case 'notify-email':
        this.onNotifyInvoiceByEmail(event.invoice);
        break;
      case 'notify-whatsapp':
        alert(`Notify via WhatsApp: ${event.invoice.invoiceNo}`);
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
