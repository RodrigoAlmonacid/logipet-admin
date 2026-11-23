import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';

export interface ResumenVentas {
  mejorVenta: { id: number; importe: number; comercio: string };
  topFacturacion: { nombre: string; total: number };
  topVariedad: { nombre: string; distintos: number };
  mejoresComercios: { comercio: string; total: number }[];
  marcas: { nombre: string; unidades: number }[];
}

export interface AlertaStock {
  id: number;
  nombre: string;
  presentacion: string;
  stock: number;
  ventasPromedioSemanal: number;
  stockIdeal: number;
}

export interface ResumenDashboard {
  ventas: ResumenVentas | null;
  alertasStock: AlertaStock[];
}

export type MetricaVentas = 'importe' | 'pedidos' | 'unidades';
export type DesgloseVentas = 'total' | 'marca' | 'especie' | 'vendedor';

export interface VentasSemanales {
  metrica: MetricaVentas;
  desglose: DesgloseVentas;
  alcance: 'todos' | 'propios';
  /** Lo que el rol del usuario puede elegir: el front solo ofrece estas opciones. */
  opciones: { metricas: MetricaVentas[]; desgloses: DesgloseVentas[] };
  semanas: string[]; // lunes de cada semana, "YYYY-MM-DD"
  series: { nombre: string; valores: number[] }[];
  totalPeriodo: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dashboard`;

  ventasSemanales(params: { semanas?: number; metrica?: MetricaVentas; desglose?: DesgloseVentas } = {}) {
    const q = new URLSearchParams();
    if (params.semanas) q.set('semanas', String(params.semanas));
    if (params.metrica) q.set('metrica', params.metrica);
    if (params.desglose) q.set('desglose', params.desglose);
    const qs = q.toString();
    return this.http.get<VentasSemanales>(`${this.url}/ventas-semanales${qs ? '?' + qs : ''}`);
  }

  resumen() {
    return this.http.get<ResumenDashboard>(this.url);
  }
}
