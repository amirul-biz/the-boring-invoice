import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./login/login').then(m => m.Login)
    },
    {
        path: 'business-entity',
        loadComponent: () => import('./business-entity/business-entity').then(m => m.BusinessEntity)
    },
    {
        path: 'invoice',
        loadComponent: () => import('./invoice/invoice').then(m => m.Invoice)
    },
    {
        path: 'business-info/:mode',
        loadComponent: () => import('./business-info/business-info').then(m => m.BusinessInfo)
    }
];
