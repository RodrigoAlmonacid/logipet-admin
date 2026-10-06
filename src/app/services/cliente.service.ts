import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  comercio: string;
  activo: boolean;
  telefono: string;
  horaAbreMat: string;
  horaCierreMat: string;
  horaAbreVesp: string;
  horaCierreVesp: string;
  direccion: string;
  latitud: number;
  longitud: number;
}

export interface CreateCliente {
  nombre: string;
  apellido: string;
  email: string;
  comercio: string;
  telefono: string;
  horaAbreMat: string;
  horaCierreMat: string;
  horaAbreVesp: string;
  horaCierreVesp: string;
  direccion: string;
  latitud: number;
  longitud: number;
}

export type UpdateCliente = Partial<CreateCliente> & {
  activo?: boolean;
};

export interface CreateClienteResponse {
  message: string;
  cliente: Cliente;
  tempPassword: string;
}

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/clientes`;

  list() {
    return this.http.get<Cliente[]>(this.url);
  }

  create(dto: CreateCliente) {
    return this.http.post<CreateClienteResponse>(this.url, dto);
  }

  update(id: number, dto: UpdateCliente) {
    return this.http.patch<Cliente>(`${this.url}/${id}`, dto);
  }

  remove(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}