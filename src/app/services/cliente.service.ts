import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';

export type CondicionIva = 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'EXENTO' | 'CONSUMIDOR_FINAL';

export const CONDICIONES_IVA: { value: CondicionIva; label: string }[] = [
  { value: 'MONOTRIBUTO', label: 'Monotributo' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'EXENTO', label: 'Exento' },

];
export type UpdateCliente = Partial<CreateCliente> & {
  activo?: boolean;
};
export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  comercio: string;
  cuit: string;
  condicionIva: CondicionIva;
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
  cuit: string;
  condicionIva: CondicionIva;
  telefono: string;
  horaAbreMat: string;
  horaCierreMat: string;
  horaAbreVesp: string;
  horaCierreVesp: string;
  direccion: string;
  latitud: number;
  longitud: number;
}

export interface CreateClienteResponse {
  message: string;
  cliente: Cliente;
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