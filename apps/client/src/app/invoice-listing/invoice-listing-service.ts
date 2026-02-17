import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IGetPaginatedInvoiceList, IInvoiceSummary } from './invoice-listing-interface';
import { getMockPaginatedInvoiceList, getMockInvoiceSummary } from './invoice-listing-mock';

@Injectable({
  providedIn: 'root',
})
export class InvoiceListingService {
  getInvoiceList(businessId: string, page: number, pageSize: number): Observable<IGetPaginatedInvoiceList> {
    return of(getMockPaginatedInvoiceList(page, pageSize));
  }

  getInvoiceSummary(businessId: string): Observable<IInvoiceSummary> {
    return of(getMockInvoiceSummary());
  }
}
