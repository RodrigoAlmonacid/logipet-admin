import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';
import { Permiso } from './permiso.service';

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: Permiso[];
}

export interface CreateRol {
  nombre: string;
  descripcion?: string;
  permisoIds?: number[];
}

export type UpdateRol = Partial<CreateRol>;

export interface CreateRolResponse {
  message: string;
  rol: Rol;
}

@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/roles`;

  list() {
    return this.http.get<Rol[]>(this.url);
  }

  create(dto: CreateRol) {
    return this.http.post<CreateRolResponse>(this.url, dto);
  }

  update(id: number, dto: UpdateRol) {
    return this.http.patch<Rol>(`${this.url}/${id}`, dto);
  }

  remove(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}