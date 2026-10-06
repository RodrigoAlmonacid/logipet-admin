import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}
// esté será el menú dinámico que dependerá de los roles
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', route: '/dashboard' },
  { label: 'Empleados', icon: 'pi pi-users', route: '/empleados', roles: ['adminUser', 'superAdmin'] },
  { label: 'Clientes', icon: 'pi pi-users', route: '/clientes', roles: ['adminUser', 'superAdmin'] },
  { label: 'Artículos', icon: 'pi pi-box', route: '/articulos', roles: ['adminUser', 'superAdmin'] },
  { label: 'Marcas', icon: 'pi pi-tags', route: '/marcas', roles: ['adminUser', 'superAdmin'] },
];

@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar-nav.component.html',
})
export class SidebarNavComponent {
  @Output() navigate = new EventEmitter<void>();

  protected readonly items = NAV_ITEMS;

  protected onLinkClick(): void {
    this.navigate.emit();
  }
}
