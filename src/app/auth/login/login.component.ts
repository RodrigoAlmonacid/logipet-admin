import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], // FormsModule para ngModel
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  pass = '';
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.email || !this.pass) return;

    this.authService.login({ email: this.email, pass: this.pass }).subscribe({
      next: (response) => {
        localStorage.setItem('access_token', response.access_token);
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Error de autenticación', error);
        this.errorMessage = 'Credenciales inválidas o usuario inactivo';
      }
    });
  }
}