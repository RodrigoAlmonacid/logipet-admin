import { Component, computed, EventEmitter, inject, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  permiso?: string; // si no tiene, es visible para cualquier logueado (ej. Dashboard)
}

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
  { label: 'Empleados', icon: 'pi pi-users', route: '/empleados', permiso: 'empleado:view' },
  { label: 'Clientes', icon: 'pi pi-briefcase', route: '/clientes', permiso: 'cliente:view' },
  { label: 'Artículos', icon: 'pi pi-box', route: '/articulos', permiso: 'articulo:view' },
  { label: 'Marcas', icon: 'pi pi-tags', route: '/marcas', permiso: 'marca:view' },
  { label: 'Roles', icon: 'pi pi-shield', route: '/roles', permiso: 'rol:manage' },
  { label: 'Pedidos', icon: 'pi pi-shopping-bag', route: '/pedidos', permiso: 'pedido:view' },
];

protected readonly menuVisible = computed(() =>
  this.menuItems.filter((item) => !item.permiso || this.auth.can(item.permiso)),
);

protected onLinkClick(): void {
    this.navigate.emit();
  }
}
