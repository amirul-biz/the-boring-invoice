import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IBusinessInfo } from './business-info-interface';

const MOCK_BUSINESS: IBusinessInfo = {
  id: 'mock-id-123',
  businessName: 'Energizing Wellness Taekwondo',
  businessEmail: 'wellness@example.com',
  taxIdentificationNumber: 'C1234567890',
  businessRegistrationNumber: '202401012345',
  businessActivityDescription: 'Taekwondo training and sports education',
};

@Injectable({
  providedIn: 'root',
})
export class BusinessInfoService {
  http = inject(HttpClient);
  private apiUrl = process.env['NG_APP_API_URL'];

  getMockBusiness(): Observable<IBusinessInfo> {
    return of(MOCK_BUSINESS);
  }

  create(data: IBusinessInfo): Observable<IBusinessInfo> {
    return this.http.post<IBusinessInfo>(`${this.apiUrl}/business-info`, data);
  }

  update(id: string, data: IBusinessInfo): Observable<IBusinessInfo> {
    return this.http.put<IBusinessInfo>(`${this.apiUrl}/business-info/${id}`, data);
  }
}
