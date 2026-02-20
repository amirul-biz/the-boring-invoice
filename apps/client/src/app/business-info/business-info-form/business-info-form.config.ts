import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface BusinessInfoForm {
  businessName: FormControl<string | null>;
  businessEmail: FormControl<string | null>;
  taxIdentificationNumber: FormControl<string | null>;
  businessRegistrationNumber: FormControl<string | null>;
  businessActivityDescription: FormControl<string | null>;
  msicCode: FormControl<string | null>;
  categoryCode: FormControl<string | null>;
  userSecretKey: FormControl<string | null>;
  idType: FormControl<string | null>;
  sstRegistrationNumber: FormControl<string | null>;
  addressLine1: FormControl<string | null>;
  city: FormControl<string | null>;
  postcode: FormControl<string | null>;
  state: FormControl<string | null>;
}

export function getBusinessInfoForm(): FormGroup<BusinessInfoForm> {
  return new FormGroup<BusinessInfoForm>({
    businessName: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    businessEmail: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    taxIdentificationNumber: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    businessRegistrationNumber: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    businessActivityDescription: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    msicCode: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{5}$/)],
    }),
    categoryCode: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    userSecretKey: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    idType: new FormControl('BRN', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    sstRegistrationNumber: new FormControl<string | null>(null),
    addressLine1: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    city: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    postcode: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    state: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
}
