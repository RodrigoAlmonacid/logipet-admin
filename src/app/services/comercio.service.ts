import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';

export interface Comercio {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string;
  latitud: number;
  longitud: number;
  horaAbreMat: string;
  horaCierreMat: string;
  horaAbreVesp: string;
  horaCierreVesp: string;
  activo: boolean;
  clienteId: number;
}

export type ComercioDatos = Omit<Comercio, 'id' | 'activo' | 'clienteId' | 'telefono'> & { telefono?: string };
export type CreateComercio = ComercioDatos & { clienteId: number };
export type UpdateComercio = Partial<ComercioDatos> & { activo?: boolean };

@Injectable({ providedIn: 'root' })
export class ComercioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/comercios`;

  list(clienteId?: number) {
    return this.http.get<Comercio[]>(this.url, { params: clienteId ? { clienteId } : {} });
  }
  create(dto: CreateComercio) {
    return this.http.post<Comercio>(this.url, dto);
  }
  update(id: number, dto: UpdateComercio) {
    return this.http.patch<Comercio>(`${this.url}/${id}`, dto);
  }
  remove(id: number) {
    return this.http.delete<Comercio>(`${this.url}/${id}`);
  }
}