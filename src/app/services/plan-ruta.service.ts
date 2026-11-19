import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';
import { Deposito } from './deposito-catalogo.service';

// ============================================================
// PlanRutaService (Angular) — HttpClient wrapper para /plan-rutas.
//
// Métodos:
//   - list()                         → GET /plan-rutas
//   - get(id)                        → GET /plan-rutas/:id (con envios + rutaOptima)
//   - create(dto)                    → POST /plan-rutas
//   - updateEstado(id, estado)       → PATCH /plan-rutas/:id/estado
//   - optimize(id, timeLimitMs?)    → POST /plan-rutas/:id/optimize
// ============================================================

export interface ComercioRuta {
  id: number;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
}

export interface PedidoRuta {
  id: number;
  ordenRuta: number | null;
  llegadaEstimada: string | null;
  pesoGramos: number;
  comercio: ComercioRuta;
}

export interface CamionRuta {
  id: number;
  interno: number;
  marca: string;
  modelo: string | null;
  capacidad: number;
}

export interface EnvioRuta {
  id: number;
  fechaEntrega: string;
  camionId: number;
  camion?: CamionRuta;
  rutaOptima?: GeoJSON.FeatureCollection; // lo que pinta Leaflet
  distanciaMetros: number | null;
  duracionSegundos: number | null;
  optimizadoAt: string | null;
  pedidos: PedidoRuta[];
}

export interface PlanRuta {
  id: number;
  fecha: string;
  depositoId: number;
  horaLimite: string;
  estado: 'PENDIENTE' | 'OPTIMIZADO' | 'EN_PROCESO' | 'FINALIZADO' | 'FALLIDO';
  createdAt: string;
  updatedAt: string;
  deposito: Deposito;
  envios: EnvioRuta[];
  camiones: { id: number; interno: number; marca: string }[];
}

export interface CreatePlanRutaDto {
  fecha: string;       // ISO 8601
  depositoId: number;
  horaLimite: string;  // ISO 8601
  camionIds: number[];
}

export interface OptimizeResult {
  planRutaId: number;
  enviosCreados: number;
  pedidosAsignados: number;
  pedidosNoAsignables: Array<{ pedidoId: number; comercioId: number; motivo: string }>;
  distanciaTotalMetros: number;
  duracionTotalSegundos: number;
  objectiveValue: number;
  solverStatus: string;
}

@Injectable({ providedIn: 'root' })
export class PlanRutaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/plan-rutas`;

  list() {
    return this.http.get<PlanRuta[]>(this.url);
  }

  get(id: number) {
    return this.http.get<PlanRuta>(`${this.url}/${id}`);
  }

  create(dto: CreatePlanRutaDto) {
    return this.http.post<PlanRuta>(this.url, dto);
  }

  updateEstado(id: number, estado: string) {
    return this.http.patch<PlanRuta>(`${this.url}/${id}/estado`, { estado });
  }

  /**
   * Ejecuta la optimización del PlanRuta.
   * Tarda típicamente 5-15 segundos (OSRM + OR-Tools + persistencia).
   * El caller debe mostrar un spinner mientras espera.
   */
  optimize(id: number, timeLimitMs = 10_000) {
    return this.http.post<OptimizeResult>(
      `${this.url}/${id}/optimize`,
      { timeLimitMs },
    );
  }
}
