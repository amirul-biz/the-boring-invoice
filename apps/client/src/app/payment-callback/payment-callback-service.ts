import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PaymentCallbackService {
  private readonly apiUrl = process.env['NG_APP_API_URL'];

  constructor(private readonly http: HttpClient) {}

  getBillStatus(billCode: string): Observable<{ paid: boolean }> {
    return this.http.get<{ paid: boolean }>(`${this.apiUrl}/invoice/bill-status/${billCode}`);
  }
}
