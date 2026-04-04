import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PaymentCallbackService {
  private readonly apiUrl = process.env['NG_APP_API_URL'];

  getBillStatus(billCode: string): Observable<boolean> {
    return from(
      fetch(`${this.apiUrl}/invoice/bill-status/${billCode}`, { cache: 'no-store' })
        .then((res) => res.json() as Promise<boolean>)
    );
  }
}
