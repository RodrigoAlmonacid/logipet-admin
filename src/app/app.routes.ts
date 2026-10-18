import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { PrivateLayoutComponent } from './layouts/private-layout/private-layout.component';
import { authGuard } from './guards/auth.guard';
import { permissionGuard } from './guards/permission.guard';
import { PERMISOS } from './helpers/permisos.constants';

const PEDIDOS_ACCESO = [
  PERMISOS.PEDIDO_VIEW, PERMISOS.PEDIDO_VIEW_ALL,
  PERMISOS.PEDIDO_APPROVE, PERMISOS.PEDIDO_REJECT, PERMISOS.PEDIDO_PREPARE, PERMISOS.PEDIDO_ROUTE,
];

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
        data: { permissions: [PERMISOS.EMPLEADO_VIEW] }
      },
      {
        path: 'clientes',
        loadComponent: () => import('./view/clientes/clientes.component').then(m => m.ClientesComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: [PERMISOS.CLIENTE_VIEW] }
      },
      {
        path: 'articulos',
        loadComponent: () => import('./view/articulos/articulos.component').then(m => m.ArticulosComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: [PERMISOS.ARTICULO_VIEW] }
      },
      {
        path: 'marcas',
        loadComponent: () => import('./view/marca/marcas.component').then(m => m.MarcasComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: [PERMISOS.MARCA_VIEW] }
      },
      {
        path: 'roles',
        loadComponent: () => import('./view/roles/roles.component').then(m => m.RolesComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: [PERMISOS.ROL_MANAGE] }
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./view/pedido/pedidos.component').then(m => m.PedidosComponent),
        canActivate: [permissionGuard], // protejo con roles
        data: { permissions: PEDIDOS_ACCESO }
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' }, // Ruta comodín
];