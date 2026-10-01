import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
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
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  user: EmpleadoAutenticado;
}

const TOKEN_KEY = 'logipet_token';
const USER_KEY = 'logipet_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _isAuthenticated = signal<boolean>(this.isSessionActive());
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  private readonly _currentUser = signal<EmpleadoAutenticado | null>(this.readStoredUser());
  readonly currentUser = this._currentUser.asReadonly();
  readonly fullName = computed(() => {
    const u = this._currentUser();
    return u ? `${u.nombre} ${u.apellido}` : '';
  });

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        this._currentUser.set(response.user);
        this._isAuthenticated.set(true);
      }),
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._isAuthenticated.set(false);
    this._currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isSessionActive(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const { exp } = jwtDecode<{ exp: number }>(token);
      return exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  hasAnyRole(required: string[]): boolean {
    const mine = this._currentUser()?.roles ?? [];
    return required.some((r) => mine.includes(r));
  }

  private readStoredUser(): EmpleadoAutenticado | null {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  forgotPassword(email: string): Observable<{ message: string }> {
  return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
}

resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
  return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`, {
    token,
    newPassword,
  });
}
}