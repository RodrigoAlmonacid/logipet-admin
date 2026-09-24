import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

// El campo `roles` ya está acá pensado para el futuro: hoy roleGuard
// siempre deja pasar, así que no filtramos nada. Cuando ese guard lea
// los roles reales del usuario (por ej. desde un signal en AuthService),
// alcanza con agregar un computed() acá que filtre `NAV_ITEMS` por
// `roles.includes(rolUsuario)` antes de asignarlo a `items`.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', route: '/dashboard' },
  { label: 'Empleados', icon: 'pi pi-users', route: '/empleados', roles: ['adminUser', 'superAdmin'] },
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
