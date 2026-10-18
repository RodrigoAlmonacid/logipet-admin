import { Component, computed, EventEmitter, inject, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PERMISOS } from '../../../helpers/permisos.constants';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  permiso?: string[]; // si no tiene, es visible para cualquier logueado (ej. Dashboard)
}

const PEDIDOS_ACCESO = [
  PERMISOS.PEDIDO_VIEW, PERMISOS.PEDIDO_VIEW_ALL,
  PERMISOS.PEDIDO_APPROVE, PERMISOS.PEDIDO_REJECT, PERMISOS.PEDIDO_PREPARE, PERMISOS.PEDIDO_ROUTE,
];

@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink],
  templateUrl: './sidebar-nav.component.html',
})
export class SidebarNavComponent {
  @Output() navigate = new EventEmitter<void>();

  protected readonly auth = inject(AuthService);

  protected readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'pi pi-home', route: '/dashboard' },
    { label: 'Empleados', icon: 'pi pi-users', route: '/empleados', permiso: [PERMISOS.EMPLEADO_VIEW] },
    { label: 'Clientes', icon: 'pi pi-briefcase', route: '/clientes', permiso: [PERMISOS.CLIENTE_VIEW] },
    { label: 'Artículos', icon: 'pi pi-box', route: '/articulos', permiso: [PERMISOS.ARTICULO_VIEW] },
    { label: 'Marcas', icon: 'pi pi-tags', route: '/marcas', permiso: [PERMISOS.MARCA_VIEW] },
    { label: 'Roles', icon: 'pi pi-shield', route: '/roles', permiso: [PERMISOS.ROL_MANAGE] },
    { label: 'Pedidos', icon: 'pi pi-shopping-bag', route: '/pedidos', permiso: PEDIDOS_ACCESO },
  ];

  protected readonly menuVisible = computed(() =>
    this.menuItems.filter((item) => !item.permiso || this.auth.canAny(item.permiso)),
  );

  protected onLinkClick(): void {
    this.navigate.emit();
  }
}
