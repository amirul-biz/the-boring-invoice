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
        path: 'invoice/:businessId',
        loadComponent: () => import('./invoice/invoice').then(m => m.Invoice)
    },
    {
        path: 'invoice-listing/:businessId',
        loadComponent: () => import('./invoice-listing/invoice-listing').then(m => m.InvoiceListing)
    },
    {
        path: 'business-info/create',
        loadComponent: () => import('./business-info/business-info').then(m => m.BusinessInfo)
    },
    {
        path: 'business-info/edit/:id',
        loadComponent: () => import('./business-info/business-info').then(m => m.BusinessInfo)
    }
];
