import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface Permiso {
  id: number;
  codigo: string;
  descripcion: string | null;
}

@Injectable({ providedIn: 'root' })
export class PermisoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/permisos`;

  list() {
    return this.http.get<Permiso[]>(this.url);
  }
}