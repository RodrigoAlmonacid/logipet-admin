import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from './../environments/environment';

export interface LoginRequest {
  email: string;
  pass: string;
}

export interface EmpleadoAutenticado {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  roles: { id: number; nombre: string }[];
}

// AJUSTAR: esta es la forma de respuesta que ASUMO que va a tener tu
// endpoint POST /auth/login. Si tu controller devuelve otra cosa (por ej.
// { token: '...' } en vez de { access_token: '...' }), cambiá esta
// interfaz y la línea del tap() de más abajo.
export interface LoginResponse {
  access_token: string;
  empleado: EmpleadoAutenticado;
}

const TOKEN_KEY = 'logipet_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _isAuthenticated = signal<boolean>(this.hasToken());
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  login(credentials: LoginRequest): Observable<LoginResponse> {
    // AJUSTAR: la ruta '/auth/login' depende de cómo hayas armado tu
    // AuthController en Nest.
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.access_token);
        this._isAuthenticated.set(true);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }
}
