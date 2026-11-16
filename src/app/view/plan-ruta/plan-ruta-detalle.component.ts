import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import * as L from 'leaflet';
import { AuthService } from '../../services/auth.service';
import { PlanRuta, PlanRutaService } from '../../services/plan-ruta.service';
import { permissionsFor } from '../../helpers/permission-for';
import { PERMISOS } from '../../helpers/permisos.constants';

// ============================================================
// PlanRutaDetalleComponent — vista de detalle con mapa Leaflet.
//
// Muestra:
//   - Header con datos del plan (fecha, depósito, estado, hora límite)
//   - Botón "Optimizar" / "Re-optimizar" según estado
//   - Mapa Leaflet con:
//       * Tile layer OSM (Neuquén metro)
//       * Polyline por cada Envio con su rutaOptima GeoJSON
//       * Marcadores para depósito + cada parada
//       * Auto-fit bounds para ver todas las rutas
//   - Lista de envíos con detalles (camión, distancia, duración, pedidos)
//   - Resumen estadístico (distancia total, duración total, etc.)
// ============================================================

// Colores para distinguir vehículos en el mapa
const VEHICLE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];

@Component({
  selector: 'app-plan-ruta-detalle',
  imports: [ButtonModule, CardModule, TagModule, ToastModule],
  providers: [MessageService],
  templateUrl: './plan-ruta-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanRutaDetalleComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly planRutaService = inject(PlanRutaService);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);

  protected readonly permiso = permissionsFor('planruta');

  // permissionsFor no tiene canOptimize — lo calculamos directo.
  protected readonly canOptimize = computed(() => this.auth.can(PERMISOS.PLANRUTA_OPTIMIZE));

  protected readonly plan = signal<PlanRuta | null>(null);
  protected readonly loading = signal(false);
  protected readonly optimizing = signal(false);

  @ViewChild('map') mapDiv!: ElementRef<HTMLDivElement>;
  private map?: L.Map;
  private routeLayers: L.Layer[] = [];
  private markersLayer?: L.LayerGroup;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.loadPlan(id);
  }

  ngAfterViewInit(): void {
    // Inicializar el mapa aunque no haya rutas todavía — muestra Neuquén
    this.initMap();
  }

  private loadPlan(id: number): void {
    this.loading.set(true);
    this.planRutaService.get(id).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
        // Renderizar rutas si el plan está optimizado
        if (plan.envios.length > 0 && plan.envios.some(e => e.rutaOptima)) {
          // Esperar a que el DOM se actualice con el div del mapa
          setTimeout(() => this.renderRoutes(), 100);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err);
      },
    });
  }

  // ------------------------------------------------------------
  // Leaflet initialization
  // ------------------------------------------------------------

  private initMap(): void {
    if (this.map) return;
    if (!this.mapDiv?.nativeElement) return;

    // Centro en Neuquén por defecto
    this.map = L.map(this.mapDiv.nativeElement).setView([-38.9517, -68.0626], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  private renderRoutes(): void {
    if (!this.map) {
      this.initMap();
      if (!this.map) return;
    }

    // Limpiar capas anteriores
    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];
    this.markersLayer?.clearLayers();

    const plan = this.plan();
    if (!plan) return;

    // 1. Marcador del depósito (verde)
    const depIcon = L.divIcon({
      html: `<div style="background:#16a34a;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker([plan.deposito.latitud, plan.deposito.longitud], { icon: depIcon })
      .bindPopup(`<b>Depósito</b><br>${plan.deposito.nombre}`)
      .addTo(this.markersLayer!);

  const allBounds = L.latLngBounds([
  [plan.deposito.latitud, plan.deposito.longitud]
]);

    // 2. Por cada envío, dibujar su GeoJSON + marcadores de paradas
    plan.envios.forEach((envio, v) => {
      const color = VEHICLE_COLORS[v % VEHICLE_COLORS.length];

      if (envio.rutaOptima?.features) {
        const geoJsonLayer = L.geoJSON(envio.rutaOptima, {
          style: {
            color,
            weight: 5,
            opacity: 0.8,
          },
        });
        geoJsonLayer.addTo(this.map!);
        this.routeLayers.push(geoJsonLayer);

        // Extender bounds con la ruta
        const layerBounds = geoJsonLayer.getBounds();
        if (layerBounds.isValid()) allBounds.extend(layerBounds);
      }

      // 3. Marcadores por cada parada (numerados)
      envio.pedidos.forEach((pedido) => {
        if (pedido.ordenRuta == null) return;
        if (!pedido.comercio) return;

        const stopIcon = L.divIcon({
          html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">${pedido.ordenRuta}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const llegada = pedido.llegadaEstimada
          ? new Date(pedido.llegadaEstimada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          : '?';

        L.marker([pedido.comercio.latitud, pedido.comercio.longitud], { icon: stopIcon })
          .bindPopup(
            `<b>Parada ${pedido.ordenRuta}</b><br>` +
            `${pedido.comercio.nombre}<br>` +
            `ETA: ${llegada}<br>` +
            `Camión: ${envio.camion?.interno ?? envio.camionId}`,
          )
          .addTo(this.markersLayer!);

        allBounds.extend([pedido.comercio.latitud, pedido.comercio.longitud]);
      });
    });

    // 4. Ajustar zoom para ver todas las rutas
    if (allBounds.isValid()) {
      this.map.fitBounds(allBounds, { padding: [60, 60] });
    }

    // 5. Forzar redibujo (a veces Leaflet no se entera del resize)
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  // ------------------------------------------------------------
  // Acciones
  // ------------------------------------------------------------

  protected optimizar(): void {
    const plan = this.plan();
    if (!plan) return;
    if (!this.canOptimize()) return;

    if (plan.estado === 'OPTIMIZADO') {
      // Confirmar re-optimización
      if (!confirm(`Re-optimizar el plan #${plan.id}? Se perderán las rutas actuales.`)) return;
      this.optimizing.set(true);
      this.planRutaService.updateEstado(plan.id, 'PENDIENTE').subscribe({
        next: () => this.runOptimize(plan.id),
        error: (err) => {
          this.optimizing.set(false);
          this.showError(err);
        },
      });
    } else {
      this.runOptimize(plan.id);
    }
  }

  private runOptimize(planId: number): void {
    this.optimizing.set(true);
    this.planRutaService.optimize(planId, 10_000).subscribe({
      next: (result) => {
        this.optimizing.set(false);
        if (result.pedidosNoAsignables.length > 0) {
          this.messages.add({
            severity: 'warn',
            summary: 'Optimización parcial',
            detail: `${result.pedidosAsignados} pedidos asignados, ${result.pedidosNoAsignables.length} no asignables.`,
            sticky: true,
          });
        } else {
          this.messages.add({
            severity: 'success',
            summary: 'Optimización exitosa',
            detail: `${result.enviosCreados} envío(s), ${(result.distanciaTotalMetros / 1000).toFixed(2)} km total.`,
          });
        }
        // Recargar para ver las nuevas rutas en el mapa
        this.loadPlan(planId);
      },
      error: (err) => {
        this.optimizing.set(false);
        this.showError(err);
      },
    });
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  protected estadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' {
    switch (estado) {
      case 'OPTIMIZADO': return 'success';
      case 'EN_PROCESO': return 'info';
      case 'PENDIENTE': return 'warn';
      case 'FALLIDO': return 'danger';
      default: return 'info';
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  protected formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  protected formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  protected formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters} m`;
  }

  protected get totalDistancia(): number {
    const plan = this.plan();
    if (!plan) return 0;
    return plan.envios.reduce((sum, e) => sum + (e.distanciaMetros ?? 0), 0);
  }

  protected get totalDuracion(): number {
    const plan = this.plan();
    if (!plan) return 0;
    return plan.envios.reduce((sum, e) => sum + (e.duracionSegundos ?? 0), 0);
  }

  protected get totalPedidos(): number {
    const plan = this.plan();
    if (!plan) return 0;
    return plan.envios.reduce((sum, e) => sum + e.pedidos.length, 0);
  }

  private showError(err: HttpErrorResponse): void {
    const m = err.error?.message;
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.'),
    });
  }
}