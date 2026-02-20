import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { BusinessInfoForm } from './business-info-form.config';

@Component({
  selector: 'app-business-info-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './business-info-form.html',
})
export class BusinessInfoFormComponent {
  @Input({ required: true }) form!: FormGroup<BusinessInfoForm>;
  @Input({ required: true }) mode!: string;
  @Output() save = new EventEmitter<void>();

  showSecretKey = false;

  toggleSecretKey() {
    this.showSecretKey = !this.showSecretKey;
  }

  isFieldInvalid(control: any): boolean {
    return control?.invalid && (control?.dirty || control?.touched);
  }

  onSubmit() {
    if (this.form.valid) {
      this.save.emit();
    } else {
      this.form.markAllAsTouched();
    }
  }
}
