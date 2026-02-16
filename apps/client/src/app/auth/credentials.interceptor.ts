import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = process.env['NG_APP_API_URL'];
  const router = inject(Router);

  const request = apiUrl && req.url.startsWith(apiUrl)
    ? req.clone({ withCredentials: true })
    : req;

  return next(request).pipe(
    catchError((error) => {
      if (error.status === 401) {
        fetch(`${apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' })
          .finally(() => {
            router.navigate(['/']);
          });
      }

      if (error.status === 404) {
        router.navigate(['/business-entity']);
      }

      return throwError(() => error);
    })
  );
};
