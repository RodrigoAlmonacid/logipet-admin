import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';

export type Urgencia = 'critico' | 'urgente' | 'ok' | 'sin_ventas';

export interface ItemReposicion {
  id: number;
  codigo: string;
  nombre: string;
  presentacion: string;
  marca: string | null;
  stock: number;
  abc: 'A' | 'B' | 'C';
  urgencia: Urgencia;
  demandaSemanal: number;
  coberturaSemanas: number | null;
  stockSeguridad: number;
  puntoReposicion: number;
  cantidadSugerida: number;
  mesesConDatos: number;
}

export interface ResumenReposicion {
  generadoEn: string;
  parametros: { leadSemanas: number; cicloSemanas: number; nivelServicio: number };
  estacionalidadConfiable: boolean;
  estacionalidad: Record<string, number[]>;
  items: ItemReposicion[];
}

export interface PrioridadIa {
  id: number;
  nombre: string;
  prioridad: 'alta' | 'media' | 'baja';
  motivo: string;
  sugerencia: string;
}

export interface AnalisisReposicion {
  origen: 'ia' | 'estadistico';
  generadoEn: string;
  resumen: string;
  prioridades: PrioridadIa[];
}

@Injectable({ providedIn: 'root' })
export class ReabastecimientoService {
  private readonly http = inject(HttpClient);
  resumen() {
    return this.http.get<ResumenReposicion>(`${environment.apiUrl}/reabastecimiento`);
  }

  analisis() {
    return this.http.post<AnalisisReposicion>(`${environment.apiUrl}/reabastecimiento/analisis`, {});
  }
}
