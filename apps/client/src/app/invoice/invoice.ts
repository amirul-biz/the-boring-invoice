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
} from './invoice-form/invoice-form.config';
import { InvoiceService } from './invoice-service';
import { BusinessInfoService } from '../business-info/business-info-service';
import { MALAYSIAN_STATES, CLASSIFICATION_CODES, INVOICE_TYPES } from './invoice-constants';
import { tap, finalize } from 'rxjs';

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
  malaysianStates = MALAYSIAN_STATES;
  classificationCodes = CLASSIFICATION_CODES;
  Validators = Validators;

  constructor() {
    this.invoiceForm = getInvoiceForm();
  }

  ngOnInit(): void {
    const businessId = this.route.snapshot.paramMap.get('businessId');
    if (businessId) {
      this.loadSupplierInfo(businessId);
    }
  }

  private loadSupplierInfo(businessId: string): void {
    this.spinner.show();

    this.businessInfoService.getPublicById(businessId).pipe(
      tap((data) => {
        this.invoiceForm.controls.supplier.patchValue({
          name: data.businessName,
          email: data.businessEmail,
          tin: data.taxIdentificationNumber,
          registrationNumber: data.businessRegistrationNumber,
          msicCode: data.categoryCode,
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


  generateInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    this.spinner.show();

    const invoicesData = getInvoicesData(this.invoiceForm);
    this.invoiceService.generateInvoicePdf(invoicesData).pipe(
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
