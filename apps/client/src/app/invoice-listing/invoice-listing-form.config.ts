import { FormControl, FormGroup } from '@angular/forms';

export interface InvoiceListingFilterForm {
  pageSize: FormControl<number>;
  dateFrom: FormControl<string | null>;
  dateTo: FormControl<string | null>;
  invoiceType: FormControl<string | null>;
  status: FormControl<string | null>;
}

export function getInvoiceListingFilterForm(): FormGroup<InvoiceListingFilterForm> {
  return new FormGroup<InvoiceListingFilterForm>({
    pageSize: new FormControl(10, { nonNullable: true }),
    dateFrom: new FormControl(null),
    dateTo: new FormControl(null),
    invoiceType: new FormControl(null),
    status: new FormControl(null),
  });
}
