import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ICreateInvoice } from './invoice-interface';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  http = inject(HttpClient);

  generateInvoicePdf(data: ICreateInvoice): Observable<Blob> {
    return this.http.post(`https://the-boring-invoice-api.vercel.app/invoice/generate`, data, {
      responseType: 'blob',
    });
  }
}
