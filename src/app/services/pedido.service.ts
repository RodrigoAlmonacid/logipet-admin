import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../../environments/environment';
import { Articulo } from './articulo.service';
import { Cliente } from './cliente.service';

export interface Estado {
  id: number;
  nombre: string;
}

export interface DetallePedido {
  articuloId: number;
  cantidad: number;
  precioVenta: number;
  descuentoPorcentaje: number;
  articulo: Articulo;
  alicuotaIvaPorcentaje: number;
}

export interface Pedido {
  id: number;
  importe: number;
  createdAt: string;
  cliente: Cliente;
  empleado: { id: number; nombre: string; apellido: string };
  articulos: DetallePedido[];
  historialEstados: EstadoPedido[];
  stockDescontado: boolean;
  lineas: LineaCalculada[];
  totales: Totales;
}

export interface LineaCalculada {
  articuloId: number;
  nombre: string;
  cantidad: number;
  precioVenta: number;
  descuentoPorcentaje: number;
  alicuotaIvaPorcentaje: number;
  importeBruto: number;
  importeDescuento: number;
  importeNeto: number;
  importeIva: number;
  importeFinal: number;
}

export interface Totales {
  neto: number;
  iva: number;
  final: number;
}

export interface ItemPedido {
  articuloId: number;
  cantidad: number;
  descuentoPorcentaje: number;
}

export interface CreatePedido {
  clienteId: number;
  items: ItemPedido[];
}

export type MotivoBaja =
  | 'ARREPENTIMIENTO'
  | 'PRODUCTO_DANADO'
  | 'CLIENTE_AUSENTE'
  | 'CLIENTE_RECHAZO';

export interface EstadoPedido {
  estadoId: number;
  estado: Estado;
  fechaCreac: string;
  fechaFin: string | null;
  motivo?: MotivoBaja | null;
  observacion?: string | null;
}

export type UpdatePedido = CreatePedido;

export type Vista =
  | 'borradores' | 'rechazados' | 'en-proceso' | 'finalizados'
  | 'administracion' | 'deposito' | 'ruteo';

export function puedeReabrir(p: Pedido): boolean {
  return estadoActual(p) === 'rechazado';
}

export function motivoRechazo(p: Pedido): string | null {
  if (estadoActual(p) !== 'rechazado') return null;
  return p.historialEstados.find((h) => h.fechaFin === null)?.observacion ?? null;
}

export function estadoActual(pedido: Pedido): string {
  return pedido.historialEstados.find((h) => h.fechaFin === null)?.estado.nombre ?? '—';
}

export function puedeEditar(p: Pedido): boolean {
  return estadoActual(p) === 'borrador';
}

export function puedeConfirmar(p: Pedido): boolean {
  return estadoActual(p) === 'borrador';
}

export function puedeAprobar(p: Pedido): boolean {
  return estadoActual(p) === 'pendiente';
}

export function puedeRechazar(p: Pedido): boolean {
  return estadoActual(p) === 'pendiente';
}

export function puedeCancelar(p: Pedido): boolean {
  return ['borrador', 'pendiente', 'pendiente_preparacion', 'en_preparacion', 'preparado', 'no_entregado', 'rechazado']
    .includes(estadoActual(p));
}

// después de aprobar hay stock descontado, y por eso el motivo es obligatorio
export function cancelaRequiereMotivo(p: Pedido): boolean {
  return p.stockDescontado;
}

export function esBorrador(p: Pedido): boolean {
  return estadoActual(p) === 'borrador';
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pedidos`;

  list(vista: Vista) {
    return this.http.get<Pedido[]>(this.url, { params: { vista } });
  }

  findOne(id: number) {
    return this.http.get<Pedido>(`${this.url}/${id}`);
  }

  create(dto: CreatePedido) {
    return this.http.post<{ pedido: Pedido }>(this.url, dto);
  }

  update(id: number, dto: UpdatePedido) {
    return this.http.patch<{ pedido: Pedido }>(`${this.url}/${id}`, dto);
  }

  confirmar(id: number) {
    return this.http.patch<Pedido>(`${this.url}/${id}/confirmar`, {});
  }

  aprobar(id: number) {
    return this.http.patch<Pedido>(`${this.url}/${id}/aprobar`, {});
  }

  rechazar(id: number, observacion: string) {
    return this.http.patch<Pedido>(`${this.url}/${id}/rechazar`, { observacion });
  }

  cancelar(id: number, body: { motivo?: MotivoBaja; observacion?: string } = {}) {
    return this.http.patch<Pedido>(`${this.url}/${id}/cancelar`, body);
  }

  exportarPresupuesto(id: number) {
    return this.http.get(`${this.url}/${id}/presupuesto`, { responseType: 'blob' });
  }

  reabrir(id: number) {
    return this.http.patch<Pedido>(`${this.url}/${id}/reabrir`, {});
  }
}