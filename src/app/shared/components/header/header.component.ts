import { Component, inject, Input } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-header',
  imports: [ButtonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {

  @Input() mobileMenuOpen: boolean = false;
  protected readonly auth = inject(AuthService);

  protected onLogout(): void {
    this.auth.logout();
  }

}
