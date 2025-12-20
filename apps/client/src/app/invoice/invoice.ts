import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import {
  getInvoiceForm,
  CreateInvoiceForm,
  addInvoiceItemForm,
  removeInvoiceItemForm,
  getInvoiceData,
} from './invoice-form/invoice-form.config';
import { InvoiceService } from './invoice-service';
import { MALAYSIAN_STATES, CLASSIFICATION_CODES, INVOICE_TYPES } from './invoice-constants';

@Component({
  selector: 'app-invoice',
  imports: [CommonModule, ReactiveFormsModule, NgbDatepickerModule],
  templateUrl: './invoice.html',
  styleUrl: './invoice.scss',
})
export class Invoice {
  invoiceForm: FormGroup<CreateInvoiceForm>;
  invoiceService = inject(InvoiceService);
  invoiceTypes = INVOICE_TYPES;
  malaysianStates = MALAYSIAN_STATES;
  classificationCodes = CLASSIFICATION_CODES;
  Validators = Validators;

  constructor() {
    this.invoiceForm = getInvoiceForm();
  }

  get items() {
    return this.invoiceForm.controls.items;
  }

  get supplier() {
    return this.invoiceForm.controls.supplier;
  }

  get recipient() {
    return this.invoiceForm.controls.recipient;
  }

  addItem() {
    addInvoiceItemForm(this.invoiceForm);
  }

  removeItem(index: number) {
    removeInvoiceItemForm(this.invoiceForm, index);
  }

  canRemoveItem(): boolean {
    return this.items.length > 1;
  }

  isFieldInvalid(control: any): boolean {
    return control?.invalid && (control?.dirty || control?.touched);
  }

  onSubmit() {
    if (this.invoiceForm.valid) {
      console.log('Form submitted:', this.invoiceForm.value);
      this.generateInvoice()
    } else {
      this.invoiceForm.markAllAsTouched();
    }
  }


  generateInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    const invoiceData = getInvoiceData(this.invoiceForm);

    this.invoiceService.generateInvoicePdf(invoiceData).subscribe({
      next: (blob: Blob) => {
        const fileName = `invoice-${new Date().getTime()}.pdf`;
        this.downloadFile(blob, fileName);
      },
      error: (error) => {
        console.error('Error generating invoice:', error);
      }
    });
  }

  downloadFile(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
