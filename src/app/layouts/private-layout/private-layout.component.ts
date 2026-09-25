import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { AuthService } from '../../services/auth.service';
import { SidebarNavComponent } from './../../shared/components/sidebar/sidebar-nav.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-private-layout',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ButtonModule, DrawerModule, SidebarNavComponent],
  templateUrl: './private-layout.component.html',
})
export class PrivateLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected mobileMenuOpen = false;

  protected onLogout(): void {
    this.auth.logout();
  }
}
