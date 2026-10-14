import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './layouts/private-layout/private-layout.component';
import { authGuard } from './guards/auth.guard';
import { permissionGuard } from './guards/permission.guard';

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
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: ['empleado:view'] }
      },
      {
        path: 'clientes',
        loadComponent: () => import('./view/clientes/clientes.component').then(m => m.ClientesComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: ['cliente:view'] }
      },
      {
        path: 'articulos',
        loadComponent: () => import('./view/articulos/articulos.component').then(m => m.ArticulosComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: ['articulo:view'] }
      },
      {
        path: 'marcas',
        loadComponent: () => import('./view/marca/marcas.component').then(m => m.MarcasComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: ['marca:view'] }
      },
      {
        path: 'roles',
        loadComponent: () => import('./view/roles/roles.component').then(m => m.RolesComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: ['rol:manage'] }
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./view/pedido/pedidos.component').then(m => m.PedidosComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: ['pedido:view'] }
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' }, // Ruta comodín
];