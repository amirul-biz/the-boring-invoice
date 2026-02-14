import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface BusinessInfoForm {
  businessName: FormControl<string | null>;
  businessEmail: FormControl<string | null>;
  taxIdentificationNumber: FormControl<string | null>;
  businessRegistrationNumber: FormControl<string | null>;
  businessActivityDescription: FormControl<string | null>;
  categoryCode: FormControl<string | null>;
  userSecretKey: FormControl<string | null>;
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
    categoryCode: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    userSecretKey: new FormControl(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
}
