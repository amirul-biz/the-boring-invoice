import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./login/login').then(m => m.Login)
    },
    {
        path: 'invoice',
        loadComponent: () => import('./invoice/invoice').then(m => m.Invoice)
    }
];
