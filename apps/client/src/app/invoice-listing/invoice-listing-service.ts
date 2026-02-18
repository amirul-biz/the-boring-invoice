import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IGetPaginatedInvoiceList } from './invoice-listing-interface';

export interface InvoiceListFilter {
  pageIndex: number;
  pageSize: number;
  invoiceType?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class InvoiceListingService {
  private http = inject(HttpClient);
  private apiUrl = process.env['NG_APP_API_URL'];

  getInvoiceList(businessId: string, filter: InvoiceListFilter): Observable<IGetPaginatedInvoiceList> {
    let params = new HttpParams()
      .set('pageIndex', filter.pageIndex.toString())
      .set('pageSize', filter.pageSize.toString());

    if (filter.invoiceType) {
      params = params.set('invoiceType', filter.invoiceType);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    if (filter.dateFrom) {
      params = params.set('dateFrom', filter.dateFrom);
    }
    if (filter.dateTo) {
      params = params.set('dateTo', filter.dateTo);
    }

    return this.http.get<IGetPaginatedInvoiceList>(
      `${this.apiUrl}/invoice/list/${businessId}`,
      { params },
    );
  }
}
