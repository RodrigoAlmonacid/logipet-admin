import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Articulo {
  id: number;
  codigo: string;
  nombre: string;
  presentacion: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  marcaId: number | null;
  marca: { id: number; nombre: string } | null;
}

export interface CreateArticulo {
  codigo: string;
  nombre: string;
  presentacion: string;
  descripcion?: string | null;
  precio: number;
  stock: number;
  marcaId?: number | null;
}

export type UpdateArticulo = Partial<CreateArticulo>;

@Injectable({ providedIn: 'root' })
export class ArticuloService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/articulos`;

  list() { return this.http.get<Articulo[]>(this.url); }
  create(dto: CreateArticulo) { return this.http.post<{ message: string; articulo: Articulo }>(this.url, dto); }
  update(id: number, dto: UpdateArticulo) { return this.http.patch<Articulo>(`${this.url}/${id}`, dto); }
  remove(id: number) { return this.http.delete<{ message: string }>(`${this.url}/${id}`); }
}