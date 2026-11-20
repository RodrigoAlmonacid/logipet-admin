import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';

export interface Camion {
  id: number;
  interno: number;
  marca: string;
  modelo: string | null;
  capacidad: number;
  capacidadVolumen: number | null;
  disponible: boolean;
}
export type CamionPayload = Omit<Camion, 'id'>;

@Injectable({ providedIn: 'root' })
export class CamionesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/camiones`;

  listar() { return this.http.get<Camion[]>(this.url); }
  crear(body: CamionPayload) { return this.http.post<Camion>(this.url, body); }
  actualizar(id: number, body: Partial<CamionPayload>) { return this.http.patch<Camion>(`${this.url}/${id}`, body); }
  eliminar(id: number) { return this.http.delete<void>(`${this.url}/${id}`); }
}