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
  idType: FormControl<string | null>;
  sstRegistrationNumber: FormControl<string | null>;
  addressLine1: FormControl<string | null>;
  city: FormControl<string | null>;
  postcode: FormControl<string | null>;
  state: FormControl<string | null>;
  country: FormControl<string | null>;
}

export interface InvoiceItemForm {
  itemName: FormControl<string | null>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  classificationCode: FormControl<string | null>;
  taxType: FormControl<string | null>;
  taxRate: FormControl<number>;
}

export interface CreateInvoiceForm {
  invoiceType: FormControl<string | null>;
  currency: FormControl<string | null>;
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
    taxType: new FormControl('NOT_APPLICABLE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    taxRate: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });
}

export function getInvoiceForm(): FormGroup<CreateInvoiceForm> {
  return new FormGroup<CreateInvoiceForm>({
    invoiceType: new FormControl('INVOICE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    currency: new FormControl('MYR', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    dueDate: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),

    // Nested Supplier Group
    supplier: new FormGroup<SupplierForm>({
      name: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: new FormControl<string | null>({ value: null, disabled: true }, [Validators.email, Validators.required]),
      tin: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      registrationNumber: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      msicCode: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{5}$/)],
      }),
      businessActivityDescription: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      idType: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      sstRegistrationNumber: new FormControl<string | null>({ value: null, disabled: true }),
      addressLine1: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      city: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      postcode: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      state: new FormControl({ value: null, disabled: true }, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      country: new FormControl({ value: null, disabled: true }, {
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

export function patchExcelDataToInvoiceForm(
  invoiceForm: FormGroup<CreateInvoiceForm>,
  recipients: IRecipient[],
  items: ICreateInvoiceItem[],
): void {
  // Patch recipients
  const recipientsArray = invoiceForm.controls.recipients;
  recipientsArray.clear();
  for (const r of recipients) {
    const fg = recipientForm();
    fg.patchValue({
      name: r.name,
      email: r.email ?? null,
      phone: r.phone,
      tin: r.tin,
      registrationNumber: r.registrationNumber,
      addressLine1: r.addressLine1,
      postcode: r.postcode,
      city: r.city,
      state: r.state,
      countryCode: r.countryCode,
    });
    recipientsArray.push(fg);
  }
  if (recipientsArray.length === 0) {
    recipientsArray.push(recipientForm());
  }

  // Patch items
  const itemsArray = invoiceForm.controls.items;
  itemsArray.clear();
  for (const item of items) {
    const fg = invoiceItemForm();
    fg.patchValue({
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      classificationCode: item.classificationCode,
    });
    itemsArray.push(fg);
  }
  if (itemsArray.length === 0) {
    itemsArray.push(invoiceItemForm());
  }
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
        taxType: item.taxType,
        taxRate: item.taxRate,
      }) as ICreateInvoiceItem,
  );

  const supplier = {
    name: formValue.supplier.name,
    email: formValue.supplier.email ?? undefined,
    tin: formValue.supplier.tin,
    registrationNumber: formValue.supplier.registrationNumber,
    msicCode: formValue.supplier.msicCode,
    businessActivityDescription: formValue.supplier.businessActivityDescription,
    idType: formValue.supplier.idType,
    sstRegistrationNumber: formValue.supplier.sstRegistrationNumber ?? undefined,
    addressLine1: formValue.supplier.addressLine1,
    city: formValue.supplier.city,
    postcode: formValue.supplier.postcode,
    state: formValue.supplier.state,
    country: formValue.supplier.country,
  } as ISupplier;

  // Base invoice data (shared across all recipients)
  const baseInvoiceData = {
    invoiceType: formValue.invoiceType as
      | 'INVOICE'
      | 'CREDIT_NOTE'
      | 'DEBIT_NOTE',
    currency: formValue.currency ?? 'MYR',
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
