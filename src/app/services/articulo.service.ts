import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Marca {
  id: number;
  nombre: string;
}

export interface Articulo {
  id: number;
  codigo: string;
  precio: number;
  presentacion: string;
  descripcion: string;
  nombre: string;
  stock: number;
  marca: Marca | null;
}

export interface CreateArticulo {
  codigo: string;
  precio: number;
  presentacion: string;
  descripcion: string;
  nombre: string;
  stock: number;
  marcaId?: number | null;
}

export type UpdateArticulo = Partial<CreateArticulo>;

export interface CreateArticuloResponse {
  message: string;
  articulo: Articulo;
}

@Injectable({ providedIn: 'root' })
export class ArticuloService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/articulos`;

  list() {
    return this.http.get<Articulo[]>(this.url);
  }

  create(dto: CreateArticulo) {
    return this.http.post<CreateArticuloResponse>(this.url, dto);
  }

  update(id: number, dto: UpdateArticulo) {
    return this.http.patch<Articulo>(`${this.url}/${id}`, dto);
  }

  remove(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}