import { FormControl, FormGroup, FormArray, Validators } from '@angular/forms';
import {
  ICreateInvoice,
  ICreateInvoiceItem,
  IRecipient,
  ISupplier,
} from '../invoice-interface';

export interface RecipientForm {
  name: FormControl<string | null>;
  email: FormControl<string | null>;
  phone: FormControl<string | null>;
  tin: FormControl<string | null>;
  registrationNumber: FormControl<string | null>;
  addressLine1: FormControl<string | null>;
  postcode: FormControl<string | null>;
  city: FormControl<string | null>;
  state: FormControl<string | null>;
  countryCode: FormControl<string | null>;
}

export interface SupplierForm {
  name: FormControl<string | null>;
  email: FormControl<string | null>;
  tin: FormControl<string | null>;
  registrationNumber: FormControl<string | null>;
  msicCode: FormControl<string | null>;
  businessActivityDescription: FormControl<string | null>;
}

export interface InvoiceItemForm {
  itemName: FormControl<string | null>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  classificationCode: FormControl<string | null>;
}

export interface CreateInvoiceForm {
  invoiceType: FormControl<string | null>;
  currency: FormControl<string | null>;
  taxRate: FormControl<number>;
  dueDate: FormControl<string | null>;
  supplier: FormGroup<SupplierForm>;
  recipient: FormGroup<RecipientForm>;
  items: FormArray<FormGroup<InvoiceItemForm>>;
}

export function invoiceItemForm(): FormGroup<InvoiceItemForm> {
  return new FormGroup<InvoiceItemForm>({
    itemName: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quantity: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    unitPrice: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    classificationCode: new FormControl('010', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
}

export function getInvoiceForm(): FormGroup<CreateInvoiceForm> {
  return new FormGroup<CreateInvoiceForm>({
    invoiceType: new FormControl('Invoice', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    currency: new FormControl('MYR', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    taxRate: new FormControl(8.0, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    dueDate: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),

    // Nested Supplier Group
    supplier: new FormGroup<SupplierForm>({
      name: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: new FormControl<string | null>(null, [Validators.email, Validators.required]),
      tin: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      registrationNumber: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      msicCode: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{5}$/)],
      }),
      businessActivityDescription: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    }),

    // Nested Recipient Group
    recipient: new FormGroup<RecipientForm>({
      name: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: new FormControl<string | null>(null, [Validators.email]),
      phone: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      tin: new FormControl(null, {
        nonNullable: true,
      }),
      registrationNumber: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required]
      }),
      addressLine1: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      postcode: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      city: new FormControl(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      state: new FormControl('10', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      countryCode: new FormControl('MY', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    }),

    items: new FormArray([invoiceItemForm()]),
  });
}

export function addInvoiceItemForm(invoiceForm: FormGroup<CreateInvoiceForm>) {
  const items = invoiceForm.controls.items as FormArray;
  items.push(invoiceItemForm());
}

export function removeInvoiceItemForm(
  invoiceForm: FormGroup<CreateInvoiceForm>,
  invoiceItemFormIndex: number,
) {
  const items = invoiceForm.controls.items as FormArray;
  const isSingleRecord = items.length === 1;
  if (isSingleRecord) return;
  items.removeAt(invoiceItemFormIndex);
}

export function getInvoiceData(
  invoiceForm: FormGroup<CreateInvoiceForm>,
): ICreateInvoice {
  const formValue = invoiceForm.getRawValue();

  // Convert NgbDateStruct to ISO date string (YYYY-MM-DD)
  const dueDateValue = formValue.dueDate as any;
  const dueDate =
    typeof dueDateValue === 'string'
      ? dueDateValue
      : `${dueDateValue.year}-${String(dueDateValue.month).padStart(2, '0')}-${String(dueDateValue.day).padStart(2, '0')}`;

  return {
    invoiceType: formValue.invoiceType as
      | 'Invoice'
      | 'Credit Note'
      | 'Debit Note',
    currency: formValue.currency ?? 'MYR',
    taxRate: formValue.taxRate,
    dueDate: dueDate,
    supplier: {
      name: formValue.supplier.name,
      email: formValue.supplier.email ?? undefined,
      tin: formValue.supplier.tin,
      registrationNumber: formValue.supplier.registrationNumber,
      msicCode: formValue.supplier.msicCode,
      businessActivityDescription:
        formValue.supplier.businessActivityDescription,
    } as ISupplier,
    recipient: {
      name: formValue.recipient.name,
      email: formValue.recipient.email ?? undefined,
      phone: formValue.recipient.phone,
      tin: formValue.recipient.tin,
      registrationNumber: formValue.recipient.registrationNumber,
      addressLine1: formValue.recipient.addressLine1,
      postcode: formValue.recipient.postcode,
      city: formValue.recipient.city,
      state: formValue.recipient.state,
      countryCode: formValue.recipient.countryCode,
    } as IRecipient,
    items: formValue.items.map(
      (item) =>
        ({
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          classificationCode: item.classificationCode,
        }) as ICreateInvoiceItem,
    ),
  };
}
