import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';

export interface AlicuotaIva {
  id: number;
  porcentaje: number;
  descripcion: string;
}


@Injectable({ providedIn: 'root' })
export class AlicuotaIvaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/alicuota-iva`;

  list() {
    return this.http.get<AlicuotaIva[]>(this.url);
  }
}
