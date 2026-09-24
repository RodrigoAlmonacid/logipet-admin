import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { AuthService } from '../../services/auth.service';
import { SidebarNavComponent } from './../../shared/components/sidebar/sidebar-nav.component';

@Component({
  selector: 'app-private-layout',
  imports: [RouterOutlet, ButtonModule, DrawerModule, SidebarNavComponent],
  templateUrl: './private-layout.component.html',
})
export class PrivateLayoutComponent {
  private readonly auth = inject(AuthService);

  // Property simple (no signal) a propósito: el binding [(visible)] del
  // p-drawer necesita un valor que se pueda reasignar directo, y así nos
  // ahorramos cualquier duda sobre si el two-way binding de PrimeNG soporta
  // signals en esta versión.
  protected mobileMenuOpen = false;
  protected readonly currentYear = new Date().getFullYear();

  protected onLogout(): void {
    this.auth.logout();
  }
}
