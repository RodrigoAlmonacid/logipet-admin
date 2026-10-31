import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface LineaDeposito {
  articuloId: number;
  nombre: string;
  presentacion: string;
  codigo: string;
  cantidad: number;
  cantidadOriginal: number | null;
  justificacionAjuste: string | null;
  verificado: boolean;
}

export interface PedidoDeposito {
  id: number;
  pesoGramos: number;
  pesoIncompleto: boolean;
  comercio: { nombre: string; direccion: string };
  operario: { id: number; nombre: string; apellido: string } | null;
  lineas: LineaDeposito[];
  historialEstados: { fechaCreac: string; fechaFin: string | null; estado: { nombre: string } }[];
}

export interface VerificarLinea {
  codigo: string;
  cantidad: number;
  justificacion?: string;
}

@Injectable({ providedIn: 'root' })
export class DepositoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pedidos`; // ajustá si tu controller tiene otro prefijo

  actual() {
    return this.http.get<PedidoDeposito | null>(`${this.url}/deposito/actual`);
  }
  cola() {
    return this.http.get<PedidoDeposito[]>(this.url, { params: { vista: 'deposito' } }); // mismo parámetro que usa tu pantalla de pedidos
  }
  tomar(id: number) {
    return this.http.post<PedidoDeposito>(`${this.url}/${id}/tomar`, {});
  }
  soltar(id: number) {
    return this.http.post<PedidoDeposito>(`${this.url}/${id}/soltar`, {});
  }
  verificar(id: number, articuloId: number, body: VerificarLinea) {
    return this.http.patch<PedidoDeposito>(`${this.url}/${id}/lineas/${articuloId}`, body);
  }
  preparado(id: number) {
    return this.http.post<PedidoDeposito>(`${this.url}/${id}/preparado`, {});
  }
}