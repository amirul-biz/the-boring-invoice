import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { PaymentCallbackService } from './payment-callback-service';

type PageState = 'loading' | 'success' | 'failed';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  imports: [CommonModule, NgxSpinnerModule],
  templateUrl: './payment-callback.html',
  styleUrl: './payment-callback.scss',
})
export class PaymentCallback implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly spinner = inject(NgxSpinnerService);
  private readonly paymentCallbackService = inject(PaymentCallbackService);

  state: PageState = 'loading';
  orderId = '';
  transactionId = '';

  ngOnInit(): void {
    this.spinner.show();

    const params = this.route.snapshot.queryParams;
    this.orderId = params['order_id'] || '';
    this.transactionId = params['transaction_id'] || '';
    const billCode: string = params['billcode'] || '';
    const statusId: string = params['status_id'] || '';

    if (billCode) {
      this.paymentCallbackService.getBillStatus(billCode).subscribe({
        next: (paid) => {
          this.state = paid ? 'success' : 'failed';
          this.spinner.hide();
        },
        error: () => {
          this.state = 'failed';
          this.spinner.hide();
        },
      });
    } else {
      // Fallback: trust status_id from URL if no billcode
      this.state = statusId === '1' ? 'success' : 'failed';
      this.spinner.hide();
    }
  }
}
