import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';
import { Comercio, ComercioDatos } from './comercio.service';
import { map } from 'rxjs';

export type CondicionIva = 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'EXENTO' | 'CONSUMIDOR_FINAL';

export const CONDICIONES_IVA: { value: CondicionIva; label: string }[] = [
  { value: 'MONOTRIBUTO', label: 'Monotributo' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'EXENTO', label: 'Exento' },

];
export type UpdateCliente = Partial<Omit<CreateCliente, 'comercio'>> & { activo?: boolean };
export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cuit: string;
  condicionIva: CondicionIva;
  activo: boolean;
  comercios: Comercio[];
}

export interface CreateCliente {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  cuit: string;
  condicionIva: CondicionIva;
  comercio: ComercioDatos; // el primer punto de entrega
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
    return this.http
      .post<CreateClienteResponse>(this.url, dto)
      .pipe(map((res) => res.cliente));
  }

  update(id: number, dto: UpdateCliente) {
    return this.http.patch<Cliente>(`${this.url}/${id}`, dto);
  }

  remove(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}