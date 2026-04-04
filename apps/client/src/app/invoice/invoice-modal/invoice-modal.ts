import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { ICreateInvoice } from '../invoice-interface';
import { CLASSIFICATION_CODES, TAX_TYPES, INVOICE_TYPES, MALAYSIAN_STATES } from '../invoice-constants';
import { confirmModal } from '../../shared/modal.util';

@Component({
  selector: 'app-invoice-modal',
  imports: [CommonModule, NgbAccordionModule],
  templateUrl: './invoice-modal.html',
  styleUrl: './invoice-modal.scss',
})
export class InvoiceModalComponent {
  @Input() invoices: ICreateInvoice[] = [];

  constructor(public activeModal: NgbActiveModal) {}

  // Shared across all invoices (use first invoice as reference)
  get shared(): ICreateInvoice | undefined {
    return this.invoices[0];
  }

  get currency(): string {
    return this.invoices[0]?.currency ?? '';
  }

  getInvoiceTypeLabel(value: string): string {
    return INVOICE_TYPES.find(t => t.value === value)?.label ?? value;
  }

  getTaxTypeLabel(value: string): string {
    return TAX_TYPES.find(t => t.value === value)?.label ?? value;
  }

  getClassificationLabel(code: string): string {
    return CLASSIFICATION_CODES.find(c => c.code === code)?.description ?? code;
  }

  getStateLabel(code: string): string {
    return MALAYSIAN_STATES.find(s => s.code === code)?.name ?? code;
  }

  getItemAmount(unitPrice: number, quantity: number, discountRate: number): number {
    return unitPrice * quantity * (1 - (discountRate ?? 0) / 100);
  }

  getGrossSubtotal(): number {
    if (!this.shared) return 0;
    return this.shared.items.reduce((sum, item) =>
      sum + (item.unitPrice * item.quantity), 0);
  }

  getDiscountTotal(): number {
    return this.getGrossSubtotal() - this.getSubtotal();
  }

  getSubtotal(): number {
    if (!this.shared) return 0;
    return this.shared.items.reduce((sum, item) =>
      sum + this.getItemAmount(item.unitPrice, item.quantity, item.discountRate), 0);
  }

  getTaxTotal(): number {
    if (!this.shared) return 0;
    return this.shared.items.reduce((sum, item) => {
      const amount = this.getItemAmount(item.unitPrice, item.quantity, item.discountRate);
      return sum + (amount * (item.taxRate / 100));
    }, 0);
  }

  getGrandTotal(): number {
    return this.getSubtotal() + this.getTaxTotal();
  }

  getTotalAmount(): number {
    return this.getGrandTotal() * this.invoices.length;
  }

  async confirm(): Promise<void> {
    const count = this.invoices.length;
    const confirmed = await confirmModal(
      'Generate Invoice?',
      count === 1 ? 'Confirm generating 1 invoice.' : `Confirm generating ${count} invoices.`,
    );
    if (confirmed) this.activeModal.close('confirm');
  }

  async dismiss(): Promise<void> {
    const confirmed = await confirmModal('Cancel Invoice?', 'Your invoice preview will be discarded.');
    if (confirmed) this.activeModal.dismiss();
  }
}
