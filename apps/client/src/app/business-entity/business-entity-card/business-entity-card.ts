import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IBusinessInfo } from '../../business-info/business-info-interface';

@Component({
  selector: 'app-business-entity-card',
  templateUrl: './business-entity-card.html',
})
export class BusinessEntityCardComponent {
  @Input({ required: true }) business!: IBusinessInfo;
  @Output() edit = new EventEmitter<IBusinessInfo>();
  @Output() createInvoice = new EventEmitter<IBusinessInfo>();
}
