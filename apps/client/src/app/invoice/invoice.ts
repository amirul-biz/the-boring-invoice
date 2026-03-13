import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormGroup, AbstractControl, Validators } from '@angular/forms';
import { NgbAccordionModule, NgbDatepickerModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { NgxMaskDirective } from 'ngx-mask';
import { PhoneAutoFormatDirective } from '../shared/phone-auto-format.directive';
import { PriceFormatDirective } from '../shared/price-format.directive';
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
import { ICreateInvoice } from './invoice-interface';
import { InvoiceModalComponent } from './invoice-modal/invoice-modal';
import { parseInvoiceTemplate } from './invoice-template-parser';
import { errorModal, successModal } from '../shared/modal.util';
import { tap, finalize } from 'rxjs';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-invoice',
  imports: [CommonModule, ReactiveFormsModule, NgbAccordionModule, NgbDatepickerModule, NgxSpinnerModule, NgxMaskDirective, PhoneAutoFormatDirective, PriceFormatDirective],
  templateUrl: './invoice.html',
  styleUrl: './invoice.scss',
})
export class Invoice implements OnInit {
  invoiceForm: FormGroup<CreateInvoiceForm>;
  invoiceService = inject(InvoiceService);
  businessInfoService = inject(BusinessInfoService);
  spinner = inject(NgxSpinnerService);
  private route = inject(ActivatedRoute);
  private modalService = inject(NgbModal);
  invoiceTypes = INVOICE_TYPES;
  taxTypes = TAX_TYPES;
  malaysianStates = MALAYSIAN_STATES;
  classificationCodes = CLASSIFICATION_CODES;
  Validators = Validators;

  private businessId = '';
  private invoiceVersion = '1.0';

  constructor() {
    this.invoiceForm = getInvoiceForm();
  }

  ngOnInit(): void {
    this.businessId = this.route.snapshot.paramMap.get('businessId') || '';
    if (this.businessId) {
      this.getSupplierInfo(this.businessId);
    }

    this.invoiceForm.controls.invoiceType.valueChanges.subscribe((type) => {
      const ctrl = this.invoiceForm.controls.originalInvoiceRef;
      if (type === 'CREDIT_NOTE' || type === 'DEBIT_NOTE') {
        ctrl.setValidators([Validators.required]);
      } else {
        ctrl.clearValidators();
        ctrl.reset(null);
      }
      ctrl.updateValueAndValidity();
    });

    this.items.controls.forEach(item => this.setupTaxTypeWatcher(item));
  }

  private setupTaxTypeWatcher(itemGroup: AbstractControl): void {
    const group = itemGroup as FormGroup;
    const taxTypeCtrl = group.get('taxType');
    const taxRateCtrl = group.get('taxRate');
    if (!taxTypeCtrl || !taxRateCtrl) return;

    const applyTaxState = (type: string | null) => {
      if (type === 'NOT_APPLICABLE') {
        taxRateCtrl.setValue(0, { emitEvent: false });
        taxRateCtrl.disable({ emitEvent: false });
      } else {
        taxRateCtrl.enable({ emitEvent: false });
      }
    };

    applyTaxState(taxTypeCtrl.value);
    taxTypeCtrl.valueChanges.subscribe(applyTaxState);
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
          idType: data.idType,
          sstRegistrationNumber: data.sstRegistrationNumber,
          contactNumber: data.businessContactNumber,
          addressLine1: data.address?.addressLine1,
          city: data.address?.city,
          postcode: data.address?.postcode,
          state: data.address?.state,
          country: data.address?.country ?? 'MYS',
        });
        this.invoiceVersion = data.invoiceVersion ?? '1.0';
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
    this.setupTaxTypeWatcher(this.items.at(this.items.length - 1));
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

  isRecipientInvalid(index: number): boolean {
    const ctrl = this.recipients.at(index);
    return ctrl.invalid && ctrl.touched;
  }

  isFieldInvalid(control: any): boolean {
    return control?.invalid && (control?.dirty || control?.touched);
  }

  async onSubmit(): Promise<void> {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      await errorModal('Invalid Form', 'Please fill in all required fields before generating.');
      return;
    }

    const invoicesData = getInvoicesData(this.invoiceForm, this.invoiceVersion);
    const modalRef = this.modalService.open(InvoiceModalComponent, {
      size: 'xl',
      scrollable: true,
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    modalRef.componentInstance.invoices = invoicesData;

    modalRef.result.then(
      (result) => { if (result === 'confirm') this.generateInvoice(invoicesData); },
      () => {},
    );
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
      this.items.controls.forEach(item => this.setupTaxTypeWatcher(item));
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  onDownloadTemplate(): void {
    this.invoiceService.downloadTemplate().subscribe((blob) => {
      saveAs(blob, 'invoice-template.xlsx');
    });
  }

  generateInvoice(invoicesData: ICreateInvoice[]): void {
    this.spinner.show();

    this.invoiceService.generateInvoicePdf(invoicesData, this.businessId).pipe(
      tap(async () => {
        const count = invoicesData.length;
        await successModal(
          `Processing ${count} ${count === 1 ? 'Invoice' : 'Invoices'}`,
          count === 1 ? 'Your invoice is being processed.' : `Your ${count} invoices are being processed.`,
        );
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe({
      next: () => {
        const recipients = this.invoiceForm.controls.recipients;
        recipients.controls.forEach(control => control.reset());
        recipients.clear();
        recipients.push(recipientForm());
      },
      error: async () => {
        await errorModal('Generation Failed', 'Something went wrong. Please try again.');
      },
    });
  }
}
