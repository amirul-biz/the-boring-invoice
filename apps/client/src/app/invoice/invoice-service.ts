import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ICreateInvoice } from './invoice-interface';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  http = inject(HttpClient);

  generateInvoicePdf(data: ICreateInvoice[], businessId: string): Observable<any> {
    return this.http.post(`${process.env['NG_APP_API_URL']}/invoice/generate/${businessId}`, data);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${process.env['NG_APP_API_URL']}/invoice/template`, {
      responseType: 'blob',
    });
  }
}
