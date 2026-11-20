import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';
import { MotivoBaja } from './pedido.service';

// Acciones del chofer / ayudante sobre los pedidos de su hoja de ruta.
@Injectable({ providedIn: 'root' })
export class RepartoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pedidos`;

  entregar(pedidoId: number) {
    return this.http.patch<unknown>(`${this.url}/${pedidoId}/entregar`, {});
  }

  noEntregado(pedidoId: number, motivo: MotivoBaja, observacion?: string) {
    return this.http.patch<unknown>(`${this.url}/${pedidoId}/no-entregado`, { motivo, observacion });
  }
}
