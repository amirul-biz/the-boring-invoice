import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { tap, finalize } from 'rxjs';
import { BusinessInfoFormComponent } from './business-info-form/business-info-form';
import { BusinessInfoForm, getBusinessInfoForm } from './business-info-form/business-info-form.config';
import { BusinessInfoService } from './business-info-service';

@Component({
  selector: 'app-business-info',
  imports: [BusinessInfoFormComponent, NgxSpinnerModule],
  templateUrl: './business-info.html',
})
export class BusinessInfo implements OnInit {
  private route = inject(ActivatedRoute);
  private businessInfoService = inject(BusinessInfoService);
  private spinner = inject(NgxSpinnerService);

  form: FormGroup<BusinessInfoForm> = getBusinessInfoForm();
  mode = 'create';
  private editId = '';

  ngOnInit(): void {
    this.mode = this.route.snapshot.paramMap.get('mode') || 'create';

    if (this.mode === 'edit') {
      this.loadMockData();
    }
  }

  private loadMockData(): void {
    this.spinner.show();

    this.businessInfoService.getMockBusiness().pipe(
      tap((data) => {
        this.editId = data.id || '';
        this.form.patchValue({
          businessName: data.businessName,
          businessEmail: data.businessEmail,
          taxIdentificationNumber: data.taxIdentificationNumber,
          businessRegistrationNumber: data.businessRegistrationNumber,
          businessActivityDescription: data.businessActivityDescription,
        });
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.spinner.show();
    const formValue = this.form.getRawValue();

    const data = {
      businessName: formValue.businessName!,
      businessEmail: formValue.businessEmail!,
      taxIdentificationNumber: formValue.taxIdentificationNumber!,
      businessRegistrationNumber: formValue.businessRegistrationNumber!,
      businessActivityDescription: formValue.businessActivityDescription!,
    };

    const request$ = this.mode === 'edit'
      ? this.businessInfoService.update(this.editId, data)
      : this.businessInfoService.create(data);

    request$.pipe(
      tap(() => {
        const action = this.mode === 'edit' ? 'updated' : 'created';
        alert(`Business info ${action} successfully`);
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }
}
