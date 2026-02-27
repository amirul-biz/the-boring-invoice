import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { IInvoiceListItem } from '../invoice-listing-interface';
import { INVOICE_TYPE_LABEL } from '../../invoice/invoice-constants';

@Component({
  selector: 'app-invoice-listing-table',
  imports: [CommonModule, NgbPaginationModule],
  templateUrl: './invoice-listing-table.html',
  styleUrl: './invoice-listing-table.scss',
})
export class InvoiceListingTableComponent {
  invoiceTypeLabel = INVOICE_TYPE_LABEL;

  @Input({ required: true }) invoices: IInvoiceListItem[] = [];
  @Input() page = 1;
  @Input() pageSize = 5;
  @Input() totalItems = 0;
  @Output() pageChange = new EventEmitter<number>();
  @Output() action = new EventEmitter<{ type: string; invoice: IInvoiceListItem }>();

  getRowNumber(index: number): number {
    return (this.page - 1) * this.pageSize + index + 1;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PAID': return 'ilt-badge--paid';
      case 'PENDING': return 'ilt-badge--pending';
      case 'CANCELLED': return 'ilt-badge--cancelled';
      default: return 'ilt-badge--default';
    }
  }

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onAction(type: string, invoice: IInvoiceListItem): void {
    this.action.emit({ type, invoice });
  }
}
