import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { IInvoiceDetail } from '../invoice-listing-interface';
import { INVOICE_TYPE_LABEL } from '../../invoice/invoice-constants';

@Component({
  selector: 'app-invoice-detail-modal',
  imports: [CommonModule],
  templateUrl: './invoice-detail-modal.html',
  styleUrl: './invoice-detail-modal.scss',
})
export class InvoiceDetailModalComponent {
  @Input() detail!: IInvoiceDetail;

  invoiceTypeLabel = INVOICE_TYPE_LABEL;

  constructor(public activeModal: NgbActiveModal) {}

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'idm-badge--paid';
      case 'PENDING': return 'idm-badge--pending';
      case 'CANCELLED': return 'idm-badge--cancelled';
      default: return 'idm-badge--default';
    }
  }

  getItemSubtotal(item: IInvoiceDetail['items'][0]): number {
    const gross = item.quantity * item.unitPrice;
    const discount = gross * (item.discountRate / 100);
    const net = gross - discount;
    const tax = net * (item.taxRate / 100);
    return net + tax;
  }
}
