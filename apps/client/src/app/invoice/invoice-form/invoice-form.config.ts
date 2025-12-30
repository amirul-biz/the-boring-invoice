import { FormControl, FormGroup, FormArray, Validators } from '@angular/forms';
import {
  ICreateInvoice,
  ICreateInvoiceItem,
  IRecipient,
  ISupplier,
} from '../invoice-interface';


interface IDefaultBusinessInfo {
  name: string;
  email: string;
  tinNo: string;
  registrationNo: string;
  msicCode: string;
  businessActivityDescription: string;
}

export const defaultBusinessInfo: IDefaultBusinessInfo = JSON.parse(
  process.env['NG_APP_DEFAULT_BUSINESS_INFO'] || '{}'
)

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
  recipients: FormArray<FormGroup<RecipientForm>>;
  items: FormArray<FormGroup<InvoiceItemForm>>;
}

export function recipientForm(): FormGroup<RecipientForm> {
  return new FormGroup<RecipientForm>({
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
  });
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
      name: new FormControl({ value: defaultBusinessInfo.name || null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: new FormControl<string | null>({ value: defaultBusinessInfo.email || null, disabled: true }, [Validators.email, Validators.required]),
      tin: new FormControl({ value: defaultBusinessInfo.tinNo || null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      registrationNumber: new FormControl({ value: defaultBusinessInfo.registrationNo || null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      msicCode: new FormControl({ value: defaultBusinessInfo.msicCode || null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{5}$/)],
      }),
      businessActivityDescription: new FormControl({ value: defaultBusinessInfo.businessActivityDescription || null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    }),

    // Nested Recipients Array
    recipients: new FormArray([recipientForm()]),

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

export function addRecipientForm(invoiceForm: FormGroup<CreateInvoiceForm>) {
  const recipients = invoiceForm.controls.recipients as FormArray;
  recipients.push(recipientForm());
}

export function removeRecipientForm(
  invoiceForm: FormGroup<CreateInvoiceForm>,
  recipientFormIndex: number,
) {
  const recipients = invoiceForm.controls.recipients as FormArray;
  const isSingleRecord = recipients.length === 1;
  if (isSingleRecord) return;
  recipients.removeAt(recipientFormIndex);
}

export function getInvoicesData(
  invoiceForm: FormGroup<CreateInvoiceForm>,
): ICreateInvoice[] {
  const formValue = invoiceForm.getRawValue();

  // Convert NgbDateStruct to ISO date string (YYYY-MM-DD)
  const dueDateValue = formValue.dueDate as any;
  const dueDate =
    typeof dueDateValue === 'string'
      ? dueDateValue
      : `${dueDateValue.year}-${String(dueDateValue.month).padStart(2, '0')}-${String(dueDateValue.day).padStart(2, '0')}`;

  // Transform shared data once
  const items = formValue.items.map(
    (item) =>
      ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        classificationCode: item.classificationCode,
      }) as ICreateInvoiceItem,
  );

  const supplier = {
    name: formValue.supplier.name,
    email: formValue.supplier.email ?? undefined,
    tin: formValue.supplier.tin,
    registrationNumber: formValue.supplier.registrationNumber,
    msicCode: formValue.supplier.msicCode,
    businessActivityDescription:
      formValue.supplier.businessActivityDescription,
  } as ISupplier;

  // Base invoice data (shared across all recipients)
  const baseInvoiceData = {
    invoiceType: formValue.invoiceType as
      | 'Invoice'
      | 'Credit Note'
      | 'Debit Note',
    currency: formValue.currency ?? 'MYR',
    taxRate: formValue.taxRate,
    dueDate: dueDate,
    supplier: supplier,
    items: items,
  };

  // Create one invoice per recipient
  return formValue.recipients.map((recipientValue) => ({
    ...baseInvoiceData,
    recipient: {
      name: recipientValue.name,
      email: recipientValue.email ?? undefined,
      phone: recipientValue.phone,
      tin: recipientValue.tin,
      registrationNumber: recipientValue.registrationNumber,
      addressLine1: recipientValue.addressLine1,
      postcode: recipientValue.postcode,
      city: recipientValue.city,
      state: recipientValue.state,
      countryCode: recipientValue.countryCode,
    } as IRecipient,
  }));
}
