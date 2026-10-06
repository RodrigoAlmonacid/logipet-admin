import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './layouts/private-layout/private-layout.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () =>
          import('./view/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./view/passForgot/forgot-password.component').then((m) => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./view/passReset/reset-password.component').then((m) => m.ResetPasswordComponent),
      },
    ],
  },

  {
    path: '',
    component: PrivateLayoutComponent,
    canActivate: [authGuard], //protejo login
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./view/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'empleados',
        loadComponent: () => import('./view/empleados/empleados.component').then(m => m.EmpleadosComponent),
        canActivate: [roleGuard], // protejo con roles
        data: { roles: ['adminUser', 'superAdmin'] }
      },
      {
        path: 'clientes',
        loadComponent: () => import('./view/clientes/clientes.component').then(m => m.ClientesComponent),
        canActivate: [roleGuard], // protejo con roles
        data: { roles: ['adminUser', 'superAdmin'] }
      },
      {
        path: 'articulos',
        loadComponent: () => import('./view/articulos/articulos.component').then(m => m.ArticulosComponent),
        canActivate: [roleGuard], // protejo con roles
        data: { roles: ['adminUser', 'superAdmin'] }
      },
      {
        path: 'marcas',
        loadComponent: () => import('./view/marcas/marcas.component').then(m => m.MarcasComponent),
        canActivate: [roleGuard], // protejo con roles
        data: { roles: ['adminUser', 'superAdmin'] }
      },
    ],
  },

  { path: '**', redirectTo: 'login' }, // Ruta comodín
];