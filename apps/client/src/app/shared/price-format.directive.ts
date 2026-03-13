import { Directive, HostListener, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * On blur, formats the value to exactly 2 decimal places.
 * e.g. 150 → 150.00, 1500.5 → 1500.50
 * Works alongside ngx-mask separator.2.
 */
@Directive({
  selector: '[appPriceFormat]',
  standalone: true,
})
export class PriceFormatDirective {
  constructor(@Self() private ngControl: NgControl) {}

  @HostListener('blur')
  onBlur(): void {
    const raw = String(this.ngControl.value ?? '').replace(/,/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      this.ngControl.control?.setValue(num.toFixed(2), { emitEvent: true });
    }
  }
}
