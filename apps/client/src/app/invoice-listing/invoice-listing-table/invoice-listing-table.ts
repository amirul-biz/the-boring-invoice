import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { IInvoiceListItem } from '../invoice-listing-interface';

@Component({
  selector: 'app-invoice-listing-table',
  imports: [CommonModule, NgbPaginationModule],
  templateUrl: './invoice-listing-table.html',
})
export class InvoiceListingTableComponent {
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
      case 'PAID': return 'bg-success';
      case 'PENDING': return 'bg-warning text-dark';
      case 'CANCELLED': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onAction(type: string, invoice: IInvoiceListItem): void {
    this.action.emit({ type, invoice });
  }
}
