import { Directive, HostListener, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Auto-prepends the Malaysian country prefix '6' when the user enters a
 * number starting with '0' (e.g. 0196643484 → 60196643484).
 * Works alongside ngx-mask — applies on blur after masking is settled.
 */
@Directive({
  selector: '[appPhoneAutoFormat]',
  standalone: true,
})
export class PhoneAutoFormatDirective {
  constructor(@Self() private ngControl: NgControl) {}

  @HostListener('blur')
  onBlur(): void {
    const value: string = (this.ngControl.value ?? '').toString().trim();
    if (value.startsWith('0')) {
      this.ngControl.control?.setValue('6' + value, { emitEvent: true });
    }
  }
}
