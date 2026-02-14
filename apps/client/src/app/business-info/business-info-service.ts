import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IBusinessInfo } from './business-info-interface';

const MOCK_BUSINESSES: IBusinessInfo[] = [
  {
    id: 'mock-id-001',
    businessName: 'Energizing Wellness Taekwondo',
    businessEmail: 'wellness@example.com',
    taxIdentificationNumber: 'C1234567890',
    businessRegistrationNumber: '202401012345',
    businessActivityDescription: 'Taekwondo training and sports education',
    categoryCode: 'bux2a1r3',
    userSecretKey: 'sk-live-abc123def456',
  },
  {
    id: 'mock-id-002',
    businessName: 'Pixel Perfect Design Studio',
    businessEmail: 'hello@pixelperfect.my',
    taxIdentificationNumber: 'C9876543210',
    businessRegistrationNumber: '202302056789',
    businessActivityDescription: 'Graphic design, branding and digital marketing services',
    categoryCode: 'cat7k9m2',
    userSecretKey: 'sk-live-ghi789jkl012',
  },
  {
    id: 'mock-id-003',
    businessName: 'Warung Makan Sedap',
    businessEmail: 'order@warungsedap.com',
    taxIdentificationNumber: 'C5556667770',
    businessRegistrationNumber: '202105034567',
    businessActivityDescription: 'Food and beverage restaurant services',
    categoryCode: 'food5x8p',
    userSecretKey: 'sk-live-mno345pqr678',
  },
];

@Injectable({
  providedIn: 'root',
})
export class BusinessInfoService {
  http = inject(HttpClient);
  private apiUrl = process.env['NG_APP_API_URL'];

  getMockBusiness(): Observable<IBusinessInfo> {
    return of(MOCK_BUSINESSES[0]);
  }

  getMockBusinessList(): Observable<IBusinessInfo[]> {
    return of(MOCK_BUSINESSES);
  }

  create(data: IBusinessInfo): Observable<IBusinessInfo> {
    return this.http.post<IBusinessInfo>(`${this.apiUrl}/business-info`, data);
  }

  update(id: string, data: IBusinessInfo): Observable<IBusinessInfo> {
    return this.http.put<IBusinessInfo>(`${this.apiUrl}/business-info/${id}`, data);
  }
}
