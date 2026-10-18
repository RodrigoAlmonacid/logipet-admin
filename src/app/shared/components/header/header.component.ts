import { Component, inject, output, Output } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-header',
  imports: [ButtonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {

  readonly menuToggle = output<void>();
  protected readonly auth = inject(AuthService);
  
}
