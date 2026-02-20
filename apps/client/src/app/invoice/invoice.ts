import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import {
  getInvoiceForm,
  CreateInvoiceForm,
  addInvoiceItemForm,
  removeInvoiceItemForm,
  addRecipientForm,
  removeRecipientForm,
  recipientForm,
  getInvoicesData,
  patchExcelDataToInvoiceForm,
} from './invoice-form/invoice-form.config';
import { InvoiceService } from './invoice-service';
import { BusinessInfoService } from '../business-info/business-info-service';
import { MALAYSIAN_STATES, CLASSIFICATION_CODES, INVOICE_TYPES, TAX_TYPES } from './invoice-constants';
import { parseInvoiceTemplate } from './invoice-template-parser';
import { tap, finalize } from 'rxjs';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-invoice',
  imports: [CommonModule, ReactiveFormsModule, NgbDatepickerModule, NgxSpinnerModule],
  templateUrl: './invoice.html',
  styleUrl: './invoice.scss',
})
export class Invoice implements OnInit {
  invoiceForm: FormGroup<CreateInvoiceForm>;
  invoiceService = inject(InvoiceService);
  businessInfoService = inject(BusinessInfoService);
  spinner = inject(NgxSpinnerService);
  private route = inject(ActivatedRoute);
  invoiceTypes = INVOICE_TYPES;
  taxTypes = TAX_TYPES;
  malaysianStates = MALAYSIAN_STATES;
  classificationCodes = CLASSIFICATION_CODES;
  Validators = Validators;

  private businessId = '';

  constructor() {
    this.invoiceForm = getInvoiceForm();
  }

  ngOnInit(): void {
    this.businessId = this.route.snapshot.paramMap.get('businessId') || '';
    if (this.businessId) {
      this.getSupplierInfo(this.businessId);
    }
  }

  private getSupplierInfo(businessId: string): void {
    this.spinner.show();

    this.businessInfoService.getPublicById(businessId).pipe(
      tap((data) => {
        this.invoiceForm.controls.supplier.patchValue({
          name: data.businessName,
          email: data.businessEmail,
          tin: data.taxIdentificationNumber,
          registrationNumber: data.businessRegistrationNumber,
          msicCode: data.msicCode,
          businessActivityDescription: data.businessActivityDescription,
        });
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  get items() {
    return this.invoiceForm.controls.items;
  }

  get supplier() {
    return this.invoiceForm.controls.supplier;
  }

  get recipients() {
    return this.invoiceForm.controls.recipients;
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

  addRecipient() {
    addRecipientForm(this.invoiceForm);
  }

  removeRecipient(index: number) {
    removeRecipientForm(this.invoiceForm, index);
  }

  canRemoveRecipient(): boolean {
    return this.recipients.length > 1;
  }

  isFieldInvalid(control: any): boolean {
    return control?.invalid && (control?.dirty || control?.touched);
  }

  onSubmit() {
    if (this.invoiceForm.valid) {
      console.log('Form submitted:', this.invoiceForm.getRawValue());
      this.generateInvoice()
    } else {
      alert('Please fill up all required fields')
      this.invoiceForm.markAllAsTouched();
    }
  }


  onUploadTemplate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const data = parseInvoiceTemplate(buffer);
      console.log(data)
      patchExcelDataToInvoiceForm(this.invoiceForm, data.recipients, data.items);
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  onDownloadTemplate(): void {
    this.invoiceService.downloadTemplate().subscribe((blob) => {
      saveAs(blob, 'invoice-template.xlsx');
    });
  }

  generateInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    this.spinner.show();

    const invoicesData = getInvoicesData(this.invoiceForm);
    this.invoiceService.generateInvoicePdf(invoicesData, this.businessId).pipe(
      tap(() => {
        const count = invoicesData.length;
        const message = count === 1
          ? 'Invoice created successfully'
          : `${count} invoices created successfully`;
        alert(message);
      }),
      finalize(() => {
        this.spinner.hide();
      })
    ).subscribe({
      next: () => {
        const recipients = this.invoiceForm.controls.recipients;
        recipients.controls.forEach(control => control.reset());
        recipients.clear();
        recipients.push(recipientForm());
      }
    });
  }
}
