import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';
import { Deposito } from './deposito-catalogo.service';
import type { FeatureCollection } from 'geojson';

// ============================================================
// PlanRutaService (Angular) — HttpClient wrapper para /plan-rutas.
//
//   list()                      GET  /plan-rutas
//   get(id)                     GET  /plan-rutas/:id
//   create(dto)                 POST /plan-rutas
//   updateEstado(id, estado)    PATCH /plan-rutas/:id/estado
//   optimize(id)                POST /plan-rutas/:id/optimize
//   fechasDisponibles()         GET  /plan-rutas/fechas-disponibles   ["2026-11-23", ...]
//   cola()                      GET  /plan-rutas/cola                 lo que entraría a la próxima ruta
//   repartidores(planId)        GET  /plan-rutas/:id/repartidores     choferes/ayudantes
//   despachar(planId, dto)      POST /plan-rutas/:id/despachar
//   misEnvios()                 GET  /plan-rutas/mis-envios           hoja de ruta del chofer/ayudante
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

export interface EmpleadoMini {
  id: number;
  nombre: string;
  apellido: string;
}

export interface EnvioRuta {
  id: number;
  fechaEntrega: string;
  camionId: number;
  camion?: CamionRuta;
  empleados?: EmpleadoMini[];
  rutaOptima?: FeatureCollection;
  distanciaMetros: number | null;
  duracionSegundos: number | null;
  optimizadoAt: string | null;
  pedidos: PedidoRuta[];
}

export type EstadoPlan = 'PENDIENTE' | 'EN_PROCESO' | 'OPTIMIZADO' | 'DESPACHADO' | 'FINALIZADO' | 'FALLIDO';

export interface PlanRuta {
  id: number;
  fecha: string;
  depositoId: number;
  horaLimite: string;
  estado: EstadoPlan;
  createdAt: string;
  updatedAt: string;
  deposito: Deposito;
  camiones: CamionRuta[];
  envios: EnvioRuta[];
}

export interface CreatePlanRutaDto {
  fecha: string;       // ISO 8601
  depositoId?: number; // opcional: el backend usa el único depósito activo
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

export interface ColaRuteo {
  pedidos: number;
  comercios: number;
  pesoTotalGramos: number;
  reprogramados: number;
  items: {
    id: number;
    pesoGramos: number;
    reprogramado: boolean;
    comercio: { id: number; nombre: string; direccion: string };
  }[];
}

export interface Repartidor {
  id: number;
  nombre: string;
  apellido: string;
  roles: string[];
  ocupado: boolean;
}

export interface DespacharDto {
  asignaciones: { envioId: number; empleadoIds: number[] }[];
}

export interface PedidoMiRuta {
  id: number;
  ordenRuta: number | null;
  llegadaEstimada: string | null;
  pesoGramos: number;
  comercio: ComercioRuta & { telefono: string | null };
  cliente: { nombre: string; apellido: string; telefono: string | null } | null;
  articulos: { cantidad: number; articulo: { nombre: string; presentacion: string | null } }[];
  historialEstados: { estado: { nombre: string; descripcion: string | null } }[];
}

export interface EnvioMiRuta {
  id: number;
  fechaEntrega: string;
  distanciaMetros: number | null;
  duracionSegundos: number | null;
  camion: { id: number; interno: number; marca: string; modelo: string | null };
  empleados: EmpleadoMini[];
  planRuta: { id: number; fecha: string; deposito: { nombre: string; latitud: number; longitud: number } };
  pedidos: PedidoMiRuta[];
}

@Injectable({ providedIn: 'root' })
export class PlanRutaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/plan-rutas`;

  list() { return this.http.get<PlanRuta[]>(this.url); }
  get(id: number) { return this.http.get<PlanRuta>(`${this.url}/${id}`); }
  create(dto: CreatePlanRutaDto) { return this.http.post<PlanRuta>(this.url, dto); }
  updateEstado(id: number, estado: string) {
    return this.http.patch<PlanRuta>(`${this.url}/${id}/estado`, { estado });
  }

  /** Tarda típicamente 5-15 s (OSRM + OR-Tools + persistencia): mostrar spinner. */
  optimize(id: number, timeLimitMs = 10_000) {
    return this.http.post<OptimizeResult>(`${this.url}/${id}/optimize`, { timeLimitMs });
  }

  eliminar(id: number) { return this.http.delete<{ message: string }>(`${this.url}/${id}`); }
  fechasDisponibles() { return this.http.get<string[]>(`${this.url}/fechas-disponibles`); }
  cola() { return this.http.get<ColaRuteo>(`${this.url}/cola`); }
  repartidores(planId: number) { return this.http.get<Repartidor[]>(`${this.url}/${planId}/repartidores`); }
  despachar(planId: number, dto: DespacharDto) { return this.http.post<PlanRuta>(`${this.url}/${planId}/despachar`, dto); }
  misEnvios() { return this.http.get<EnvioMiRuta[]>(`${this.url}/mis-envios`); }
}
