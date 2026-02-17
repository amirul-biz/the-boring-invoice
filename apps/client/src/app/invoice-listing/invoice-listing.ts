import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { tap, finalize } from 'rxjs';
import { InvoiceListingService } from './invoice-listing-service';
import { IInvoiceListItem, IInvoiceSummary } from './invoice-listing-interface';
import { InvoiceListingTableComponent } from './invoice-listing-table/invoice-listing-table';

@Component({
  selector: 'app-invoice-listing',
  imports: [CommonModule, NgxSpinnerModule, InvoiceListingTableComponent],
  templateUrl: './invoice-listing.html',
})
export class InvoiceListing implements OnInit {
  private invoiceListingService = inject(InvoiceListingService);
  private spinner = inject(NgxSpinnerService);
  private route = inject(ActivatedRoute);

  invoices: IInvoiceListItem[] = [];
  summary: IInvoiceSummary = { pendingAmount: 0, totalPaid: 0, pendingCount: 0, paidCount: 0 };
  page = 1;
  pageSize = 5;
  totalItems = 0;
  private businessId = '';

  ngOnInit(): void {
    this.businessId = this.route.snapshot.paramMap.get('businessId') || '';
    this.getInvoiceSummary();
    this.getInvoiceList();
  }

  private getInvoiceSummary(): void {
    this.invoiceListingService.getInvoiceSummary(this.businessId).pipe(
      tap((data) => {
        this.summary = data;
      }),
    ).subscribe();
  }

  getInvoiceList(): void {
    this.spinner.show();

    this.invoiceListingService.getInvoiceList(this.businessId, this.page, this.pageSize).pipe(
      tap((data) => {
        this.invoices = data.items;
        this.totalItems = data.totalItemCount;
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.getInvoiceList();
  }

  onAction(event: { type: string; invoice: IInvoiceListItem }): void {
    switch (event.type) {
      case 'notify':
        alert(`Notify again: ${event.invoice.invoiceNo}`);
        break;
      case 'deactivate':
        alert(`Deactivate: ${event.invoice.invoiceNo}`);
        break;
      case 'download':
        alert(`Download: ${event.invoice.invoiceNo}`);
        break;
    }
  }
}
