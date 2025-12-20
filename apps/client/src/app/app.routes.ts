import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./invoice/invoice').then(m => m.Invoice)
    }
];
