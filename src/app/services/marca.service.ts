import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Marca {
  id: number;
  nombre: string;
}

export interface CreateMarca {
  nombre: string;
}

export type UpdateMarca = Partial<CreateMarca> & {
};

export interface CreateMarcaResponse {
  message: string;
  marca: Marca;
}

@Injectable({ providedIn: 'root' })
export class MarcaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/marcas`;

  list() {
    return this.http.get<Marca[]>(this.url);
  }

  create(dto: CreateMarca) {
    return this.http.post<CreateMarcaResponse>(this.url, dto);
  }

  update(id: number, dto: UpdateMarca) {
    return this.http.patch<CreateMarcaResponse>(`${this.url}/${id}`, dto);
  }

  remove(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}