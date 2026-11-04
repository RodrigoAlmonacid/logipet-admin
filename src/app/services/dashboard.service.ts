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

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dashboard`;

  resumen() {
    return this.http.get<ResumenDashboard>(this.url);
  }
}