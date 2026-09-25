import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Rol {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

export interface Empleado {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  legajo: string;
  activo: boolean;
  roles: { id: number; nombre: string }[];
}

export interface CreateEmpleado {
  nombre: string;
  apellido: string;
  email: string;
  legajo: string;
}

export type UpdateEmpleado = Partial<CreateEmpleado> & {
  activo?: boolean;
  roleIds?: number[];
};

export interface CreateEmpleadoResponse {
  message: string;
  empleado: Empleado;
  tempPassword: string;
}

@Injectable({ providedIn: 'root' })
export class EmpleadoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/empleados`;

  list() {
    return this.http.get<Empleado[]>(this.url);
  }

  roles() {
    return this.http.get<Rol[]>(`${environment.apiUrl}/roles`);
  }
  create(dto: CreateEmpleado) {
    return this.http.post<CreateEmpleadoResponse>(this.url, dto);
  }

  update(id: number, dto: UpdateEmpleado) {
    return this.http.patch<Empleado>(`${this.url}/${id}`, dto);
  }

  remove(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}