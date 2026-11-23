import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, input, viewChild,
} from '@angular/core';
import type { FeatureCollection } from 'geojson';
import * as L from 'leaflet';

// ============================================================
// Mapa de una hoja de ruta: depósito + paradas numeradas + el recorrido por las calles.
// Es la misma "foto" que se ve al optimizar el plan, pero reutilizable (vista del chofer, etc.).
// ============================================================

export interface ParadaMapa {
  orden: number;
  latitud: number;
  longitud: number;
  nombre: string;
  direccion?: string;
  eta?: string | null; // "HH:mm" ya formateado
  resuelta?: boolean; // entregada / no entregada: se dibuja en gris
}

@Component({
  selector: 'app-ruta-mapa',
  template: `<div #mapa class="border-round overflow-hidden" [style.height]="alto()" style="width: 100%"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutaMapaComponent implements AfterViewInit, OnDestroy {
  readonly deposito = input<{ nombre: string; latitud: number; longitud: number } | null>(null);
  readonly paradas = input<ParadaMapa[]>([]);
  readonly ruta = input<FeatureCollection | null | undefined>(null);
  readonly color = input('#2a78d6');
  readonly alto = input('320px');

  private readonly el = viewChild.required<ElementRef<HTMLDivElement>>('mapa');
  private map?: L.Map;
  private capa?: L.LayerGroup;

  constructor() {
    // Si cambian las paradas (p. ej. el chofer marca una entrega y se recarga), se redibuja.
    effect(() => {
      this.deposito();
      this.paradas();
      this.ruta();
      this.dibujar();
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.el().nativeElement).setView([-38.9517, -68.0626], 13); // Neuquén
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.capa = L.layerGroup().addTo(this.map);
    this.dibujar();
    // El contenedor puede haberse mostrado recién (acordeón/toggle): recalcular tamaño.
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
  }

  private dibujar(): void {
    if (!this.map || !this.capa) return;
    this.capa.clearLayers();
    const bounds = L.latLngBounds([]);

    const ruta = this.ruta();
    if (ruta?.features?.length) {
      const capaRuta = L.geoJSON(ruta, { style: { color: this.color(), weight: 5, opacity: 0.8 } });
      capaRuta.addTo(this.capa);
      const lb = capaRuta.getBounds();
      if (lb.isValid()) bounds.extend(lb);
    }

    const dep = this.deposito();
    if (dep) {
      const icon = L.divIcon({
        html: `<div style="background:#16a34a;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,.5)"></div>`,
        className: '', iconSize: [24, 24], iconAnchor: [12, 12],
      });
      L.marker([dep.latitud, dep.longitud], { icon }).bindPopup(`<b>Depósito</b><br>${esc(dep.nombre)}`).addTo(this.capa);
      bounds.extend([dep.latitud, dep.longitud]);
    }

    for (const p of this.paradas()) {
      const fondo = p.resuelta ? '#9ca3af' : this.color();
      const icon = L.divIcon({
        html: `<div style="background:${fondo};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px">${p.orden}</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const detalle = [p.direccion ? esc(p.direccion) : '', p.eta ? `Llegada estimada: ${esc(p.eta)}` : ''].filter(Boolean).join('<br>');
      L.marker([p.latitud, p.longitud], { icon }).bindPopup(`<b>Parada ${p.orden}</b><br>${esc(p.nombre)}${detalle ? '<br>' + detalle : ''}`).addTo(this.capa);
      bounds.extend([p.latitud, p.longitud]);
    }

    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [30, 30] });
  }
}

/** Los nombres vienen de la base: se escapan antes de armar el HTML del popup. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
