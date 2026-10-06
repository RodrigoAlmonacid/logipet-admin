import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Marca {
  id: number;
  nombre: string;
}

export interface CreateMarca { nombre: string; }
export type UpdateMarca = Partial<CreateMarca>;

@Injectable({ providedIn: 'root' })
export class MarcaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/marcas`;

  list() { return this.http.get<Marca[]>(this.url); }
  create(dto: CreateMarca) { return this.http.post<{ message: string; marca: Marca }>(this.url, dto); }
  update(id: number, dto: UpdateMarca) { return this.http.patch<Marca>(`${this.url}/${id}`, dto); }
  remove(id: number) { return this.http.delete<{ message: string }>(`${this.url}/${id}`); }
}