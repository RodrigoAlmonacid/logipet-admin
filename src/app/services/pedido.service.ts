import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './../environments/environment';
import { Articulo } from './articulo.service';
import { Cliente } from './cliente.service';

export interface Estado {
  id: number;
  nombre: string;
}

export interface EstadoPedido {
  estadoId: number;
  estado: Estado;
  fechaCreac: string;
  fechaFin: string | null;
}

export interface DetallePedido {
  articuloId: number;
  cantidad: number;
  precioVenta: number;
  articulo: Articulo;
}

export interface Pedido {
  id: number;
  importe: number;
  createdAt: string;
  cliente: Cliente;
  empleado: { id: number; nombre: string; apellido: string };
  articulos: DetallePedido[];
  historialEstados: EstadoPedido[];
}

export interface ItemPedido {
  articuloId: number;
  cantidad: number;
}

export interface CreatePedido {
  clienteId: number;
  items: ItemPedido[];
}

export type UpdatePedido = CreatePedido;

export interface PedidoConAvisos {
  pedido: Pedido;
  avisos: string[];
}

// El backend no tiene columna "estado": es la fila del historial sin fechaFin.
// Lo resuelvo una sola vez acá para no repetir el .find(...) en cada componente.
export function estadoActual(pedido: Pedido): string {
  return pedido.historialEstados.find((h) => h.fechaFin === null)?.estado.nombre ?? '—';
}

export function puedeEditar(pedido: Pedido): boolean {
  return ['borrador', 'pendiente'].includes(estadoActual(pedido));
}

export function puedeConfirmar(pedido: Pedido): boolean {
  return estadoActual(pedido) === 'borrador';
}

export function puedeCancelar(pedido: Pedido): boolean {
  return ['borrador', 'pendiente'].includes(estadoActual(pedido));
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pedidos`;

  list() {
    return this.http.get<Pedido[]>(this.url);
  }

  findOne(id: number) {
    return this.http.get<Pedido>(`${this.url}/${id}`);
  }

  create(dto: CreatePedido) {
    return this.http.post<PedidoConAvisos>(this.url, dto);
  }

  update(id: number, dto: UpdatePedido) {
    return this.http.patch<PedidoConAvisos>(`${this.url}/${id}`, dto);
  }

  confirmar(id: number) {
    return this.http.patch<Pedido>(`${this.url}/${id}/confirmar`, {});
  }

  cancelar(id: number) {
    return this.http.patch<Pedido>(`${this.url}/${id}/cancelar`, {});
  }
}