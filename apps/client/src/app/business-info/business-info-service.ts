import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IBusinessInfo, IBusinessInfoPublic } from './business-info-interface';

@Injectable({
  providedIn: 'root',
})
export class BusinessInfoService {
  http = inject(HttpClient);
  private apiUrl = process.env['NG_APP_API_URL'];

  getAll(): Observable<IBusinessInfo[]> {
    return this.http.get<IBusinessInfo[]>(`${this.apiUrl}/business-info`);
  }

  getById(id: string): Observable<IBusinessInfo> {
    return this.http.get<IBusinessInfo>(`${this.apiUrl}/business-info/${id}`);
  }

  getPublicById(id: string): Observable<IBusinessInfoPublic> {
    return this.http.get<IBusinessInfoPublic>(`${this.apiUrl}/business-info/${id}/public`);
  }

  create(data: IBusinessInfo): Observable<IBusinessInfo> {
    return this.http.post<IBusinessInfo>(`${this.apiUrl}/business-info`, data);
  }

  update(id: string, data: IBusinessInfo): Observable<IBusinessInfo> {
    return this.http.put<IBusinessInfo>(`${this.apiUrl}/business-info/${id}`, data);
  }
}
