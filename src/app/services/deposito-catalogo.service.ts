import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';

// ============================================================
// DepositoCatalogoService — wrapper para /depositos.
//
// NO confundir con el DepositoService existente en
// src/app/services/deposito.service.ts — ese es para el flujo
// de preparación de pedidos en el depósito (scan, verificar, etc.)
// Este es un wrapper delgado para listar depósitos del catálogo
// que alimenta el dropdown del formulario de crear PlanRuta.
// ============================================================

export interface Deposito {
  id: number;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  horaApertura: string;
  horaCierre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DepositoCatalogoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/depositos`;

  /** Devuelve sólo depósitos activos — para el dropdown de PlanRuta. */
  findActivos() {
    return this.http.get<Deposito[]>(`${this.url}/activos`);
  }
}
