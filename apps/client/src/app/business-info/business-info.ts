import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { tap, finalize } from 'rxjs';
import { BusinessInfoFormComponent } from './business-info-form/business-info-form';
import { BusinessInfoForm, getBusinessInfoForm } from './business-info-form/business-info-form.config';
import { BusinessInfoService } from './business-info-service';
import { confirmModal, successModal, errorModal } from '../shared/modal.util';

@Component({
  selector: 'app-business-info',
  imports: [BusinessInfoFormComponent, NgxSpinnerModule],
  templateUrl: './business-info.html',
  styleUrl: './business-info.scss',
})
export class BusinessInfo implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private businessInfoService = inject(BusinessInfoService);
  private spinner = inject(NgxSpinnerService);

  form: FormGroup<BusinessInfoForm> = getBusinessInfoForm();
  mode = 'create';
  private editId = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.mode = 'edit';
      this.editId = id;
      this.loadBusinessInfo(id);
    }
  }

  private loadBusinessInfo(id: string): void {
    this.spinner.show();

    this.businessInfoService.getById(id).pipe(
      tap((data) => {
        this.form.patchValue({
          businessName: data.businessName,
          businessEmail: data.businessEmail,
          taxIdentificationNumber: data.taxIdentificationNumber,
          businessRegistrationNumber: data.businessRegistrationNumber,
          businessActivityDescription: data.businessActivityDescription,
          msicCode: data.msicCode,
          categoryCode: data.categoryCode,
          userSecretKey: data.userSecretKey,
          idType: data.idType,
          sstRegistrationNumber: data.sstRegistrationNumber,
          businessContactNumber: data.businessContactNumber,
          addressLine1: data.address?.addressLine1,
          city: data.address?.city,
          postcode: data.address?.postcode,
          state: data.address?.state,
          invoiceVersion: data.invoiceVersion,
        });
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await errorModal(
        'Invalid Form',
        'Please fill in all required fields before submitting.',
      );
      return;
    }

    const isEdit = this.mode === 'edit';
    const confirmed = await confirmModal(
      isEdit ? 'Update Business?' : 'Create Business?',
      `Are you sure you want to ${isEdit ? 'update' : 'create'} this business?`,
    );
    if (!confirmed) return;

    this.spinner.show();
    const formValue = this.form.getRawValue();

    const data = {
      businessName: formValue.businessName!,
      businessEmail: formValue.businessEmail!,
      taxIdentificationNumber: formValue.taxIdentificationNumber!,
      businessRegistrationNumber: formValue.businessRegistrationNumber!,
      businessActivityDescription: formValue.businessActivityDescription!,
      msicCode: formValue.msicCode!,
      categoryCode: formValue.categoryCode!,
      userSecretKey: formValue.userSecretKey!,
      idType: formValue.idType!,
      sstRegistrationNumber: formValue.sstRegistrationNumber ?? undefined,
      businessContactNumber: formValue.businessContactNumber!,
      invoiceVersion: formValue.invoiceVersion!,
      address: {
        addressLine1: formValue.addressLine1!,
        city: formValue.city!,
        postcode: formValue.postcode!,
        state: formValue.state!,
        country: 'MYS',
      },
    };

    const request$ = isEdit
      ? this.businessInfoService.update(this.editId, data)
      : this.businessInfoService.create(data);

    request$.pipe(
      tap(async () => {
        await successModal(
          'Saved!',
          `Business info ${isEdit ? 'updated' : 'created'} successfully.`,
        );
      }),
      finalize(() => this.spinner.hide()),
    ).subscribe();
  }

  async onCancel(): Promise<void> {
    const confirmed = await confirmModal(
      'Discard Changes?',
      'Your unsaved changes will be lost. Are you sure you want to cancel?',
    );
    if (!confirmed) return;

    await errorModal(
      'Changes Discarded',
      'Your changes have been discarded.',
    );
    this.router.navigate(['/business-entity']);
  }
}
