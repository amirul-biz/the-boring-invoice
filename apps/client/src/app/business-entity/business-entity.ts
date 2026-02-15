import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { tap, finalize } from 'rxjs';
import { BusinessInfoService } from '../business-info/business-info-service';
import { IBusinessInfo } from '../business-info/business-info-interface';
import { BusinessEntityCardComponent } from './business-entity-card/business-entity-card';

@Component({
  selector: 'app-business-entity',
  imports: [BusinessEntityCardComponent, NgxSpinnerModule],
  templateUrl: './business-entity.html',
})
export class BusinessEntity implements OnInit {
  private businessInfoService = inject(BusinessInfoService);
  private spinner = inject(NgxSpinnerService);
  private router = inject(Router);

  businesses: IBusinessInfo[] = [];

  ngOnInit(): void {
    this.loadBusinesses();
  }

  private loadBusinesses(): void {
    this.spinner.show();

    this.businessInfoService.getAll().pipe(
      tap((data) => {
        this.businesses = data;
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  onCreateNew(): void {
    this.router.navigate(['/business-info', 'create']);
  }

  onEdit(business: IBusinessInfo): void {
    this.router.navigate(['/business-info', 'edit', business.id]);
  }

  onCreateInvoice(business: IBusinessInfo): void {
    this.router.navigate(['/invoice']);
  }
}
