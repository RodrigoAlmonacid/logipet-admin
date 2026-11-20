import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import * as L from 'leaflet';
import { AuthService } from '../../services/auth.service';
import { permissionsFor } from '../../helpers/permission-for';
import { EnvioRuta, OptimizeResult, PlanRuta, PlanRutaService, Repartidor } from '../../services/plan-ruta.service';
import { PERMISOS } from '../../helpers/permisos.constants';
import {
  ESTADO_PLAN, PASOS_PLAN, colorCamion, formatDate, formatDistance, formatDuration, formatKg, formatTime,
  mensajeError, pasoDelPlan,
} from '../../helpers/plan-ruta-ui';

// ============================================================
// Detalle del plan — guía al usuario paso a paso:
//   1 Crear (hecho) → 2 Optimizar → 3 Asignar equipo (chofer + ayudante por camión) y despachar → 4 En reparto
// Cada estado muestra UNA acción principal y un texto que explica qué sigue.
// ============================================================

interface Opcion { value: number; label: string; disabled: boolean }

@Component({
  selector: 'app-plan-ruta-detalle',
  imports: [FormsModule, ButtonModule, TagModule, ToastModule, ConfirmDialogModule, SelectModule, MessageModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './plan-ruta-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanRutaDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly planRutaService = inject(PlanRutaService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly permiso = permissionsFor('planruta');
  protected readonly canOptimize = computed(() => this.auth.can(PERMISOS.PLANRUTA_OPTIMIZE));
  protected readonly canDispatch = computed(() => this.auth.can(PERMISOS.PLANRUTA_DISPATCH));

  protected readonly plan = signal<PlanRuta | null>(null);
  protected readonly loading = signal(false);
  protected readonly optimizing = signal(false);
  protected readonly despachando = signal(false);
  protected readonly resultado = signal<OptimizeResult | null>(null);
  protected readonly repartidores = signal<Repartidor[]>([]);
  /** envioId -> { chofer, ayudante } elegidos en pantalla (todavía sin guardar). */
  protected readonly asignaciones = signal<Record<number, { chofer: number | null; ayudante: number | null }>>({});

  protected readonly pasos = PASOS_PLAN;
  protected readonly estado = ESTADO_PLAN;
  protected readonly colorCamion = colorCamion;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly formatDistance = formatDistance;
  protected readonly formatDuration = formatDuration;
  protected readonly formatKg = formatKg;

  protected readonly paso = computed(() => {
    const p = this.plan();
    return p ? pasoDelPlan(p.estado) : 1;
  });
  protected readonly totalPedidos = computed(() => (this.plan()?.envios ?? []).reduce((s, e) => s + e.pedidos.length, 0));
  protected readonly totalDistancia = computed(() => (this.plan()?.envios ?? []).reduce((s, e) => s + (e.distanciaMetros ?? 0), 0));
  protected readonly totalDuracion = computed(() => (this.plan()?.envios ?? []).reduce((s, e) => s + (e.duracionSegundos ?? 0), 0));
  protected readonly choferesAsignados = computed(() => {
    const a = this.asignaciones();
    return (this.plan()?.envios ?? []).filter((e) => a[e.id]?.chofer != null).length;
  });
  protected readonly faltanChoferes = computed(() => {
    const total = this.plan()?.envios.length ?? 0;
    const disponibles = this.repartidores().filter((r) => r.roles.includes('chofer') && !r.ocupado).length;
    return total > 0 && disponibles < total;
  });

  // ---- Mapa (se crea cuando aparece el <div #map>, no antes) ----
  private map?: L.Map;
  private routeLayers: L.Layer[] = [];
  private markersLayer?: L.LayerGroup;
  private mapEl?: HTMLDivElement;

  @ViewChild('map') set mapRef(ref: ElementRef<HTMLDivElement> | undefined) {
    const el = ref?.nativeElement;
    if (el === this.mapEl) return;
    this.destroyMap();
    this.mapEl = el;
    if (el) {
      this.initMap(el);
      this.renderRoutes();
    }
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.loadPlan(id);
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  protected eliminar(): void {
    const plan = this.plan();
    if (!plan) return;
    this.confirmation.confirm({
      header: 'Eliminar hoja de ruta',
      message: 'Se elimina esta hoja sin optimizar. Los pedidos de la cola no se tocan. ¿Continuar?',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.planRutaService.eliminar(plan.id).subscribe({
          next: () => this.router.navigate(['/plan-rutas']),
          error: (err) => this.showError(err),
        }),
    });
  }

  protected volver(): void {
    this.location.back();
  }

  private loadPlan(id: number): void {
    this.loading.set(true);
    this.planRutaService.get(id).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
        setTimeout(() => this.renderRoutes(), 50);
        if (plan.estado === 'OPTIMIZADO' && this.canDispatch()) this.cargarRepartidores(plan.id);
      },
      error: (err) => { this.loading.set(false); this.showError(err); },
    });
  }

  private cargarRepartidores(planId: number): void {
    this.planRutaService.repartidores(planId).subscribe({
      next: (r) => this.repartidores.set(r),
      error: (err) => this.showError(err),
    });
  }

  // ------------------------------------------------------------
  // Paso 2: optimizar
  // ------------------------------------------------------------

  protected optimizar(): void {
    const plan = this.plan();
    if (!plan || !this.canOptimize()) return;
    if (plan.estado === 'OPTIMIZADO') {
      this.confirmation.confirm({
        header: 'Volver a optimizar',
        message: 'Se descartan las rutas actuales y la selección de chofer/ayudante, y se calcula todo de nuevo con la cola actual. ¿Continuar?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Re-optimizar',
        rejectLabel: 'Cancelar',
        accept: () => {
          this.optimizing.set(true);
          this.planRutaService.updateEstado(plan.id, 'PENDIENTE').subscribe({
            next: () => this.correrOptimizacion(plan.id),
            error: (err) => { this.optimizing.set(false); this.showError(err); },
          });
        },
      });
      return;
    }
    this.correrOptimizacion(plan.id);
  }

  private correrOptimizacion(planId: number): void {
    this.optimizing.set(true);
    this.planRutaService.optimize(planId).subscribe({
      next: (r) => {
        this.optimizing.set(false);
        this.resultado.set(r);
        this.asignaciones.set({});
        this.messages.add({
          severity: r.pedidosNoAsignables.length ? 'warn' : 'success',
          summary: 'Rutas calculadas',
          detail: `${r.enviosCreados} camión(es), ${r.pedidosAsignados} pedido(s), ${(r.distanciaTotalMetros / 1000).toFixed(1)} km.`,
        });
        this.loadPlan(planId);
      },
      error: (err) => { this.optimizing.set(false); this.showError(err); this.loadPlan(planId); },
    });
  }

  // ------------------------------------------------------------
  // Paso 3: equipo por camión y despacho
  // ------------------------------------------------------------

  protected opcionesChofer(envioId: number): Opcion[] {
    return this.opciones(envioId, 'chofer');
  }
  protected opcionesAyudante(envioId: number): Opcion[] {
    return this.opciones(envioId, 'ayudante');
  }

  private opciones(envioId: number, rol: 'chofer' | 'ayudante'): Opcion[] {
    const a = this.asignaciones();
    // Ya elegidos en cualquier otro select (de este u otro camión): no se pueden repetir.
    const tomados = new Set<number>();
    for (const [id, par] of Object.entries(a)) {
      const esteEnvio = Number(id) === envioId;
      if (par.chofer != null && !(esteEnvio && rol === 'chofer')) tomados.add(par.chofer);
      if (par.ayudante != null && !(esteEnvio && rol === 'ayudante')) tomados.add(par.ayudante);
    }
    return this.repartidores()
      .filter((r) => r.roles.includes(rol))
      .map((r) => ({
        value: r.id,
        label: `${r.apellido}, ${r.nombre}${r.ocupado ? ' (ocupado ese día)' : ''}`,
        disabled: r.ocupado || tomados.has(r.id),
      }));
  }

  protected valor(envioId: number, rol: 'chofer' | 'ayudante'): number | null {
    return this.asignaciones()[envioId]?.[rol] ?? null;
  }

  protected setAsignacion(envioId: number, rol: 'chofer' | 'ayudante', empleadoId: number | null): void {
    this.asignaciones.update((a) => ({
      ...a,
      [envioId]: { chofer: a[envioId]?.chofer ?? null, ayudante: a[envioId]?.ayudante ?? null, [rol]: empleadoId },
    }));
  }

  protected despachar(): void {
    const plan = this.plan();
    if (!plan || !this.canDispatch()) return;
    const a = this.asignaciones();
    const asignaciones = plan.envios.map((e) => ({
      envioId: e.id,
      empleadoIds: [a[e.id]?.chofer, a[e.id]?.ayudante].filter((x): x is number => x != null),
    }));
    if (asignaciones.some((x) => x.empleadoIds.length === 0)) {
      this.messages.add({ severity: 'warn', summary: 'Falta el chofer', detail: 'Cada camión necesita al menos un chofer.' });
      return;
    }
    this.confirmation.confirm({
      header: 'Despachar hoja de ruta',
      message: `Los ${this.totalPedidos()} pedidos pasan a "En ruta" y el equipo ve su hoja desde su celular. Después ya no se puede re-optimizar. ¿Despachar?`,
      icon: 'pi pi-send',
      acceptLabel: 'Despachar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.despachando.set(true);
        this.planRutaService.despachar(plan.id, { asignaciones }).subscribe({
          next: () => {
            this.despachando.set(false);
            this.messages.add({ severity: 'success', summary: 'Hoja despachada', detail: 'Los pedidos salieron a reparto.' });
            this.loadPlan(plan.id);
          },
          error: (err) => { this.despachando.set(false); this.showError(err); },
        });
      },
    });
  }

  protected equipo(envio: EnvioRuta): string {
    return (envio.empleados ?? []).map((e) => `${e.nombre} ${e.apellido}`).join(' y ') || 'Sin asignar';
  }

  protected pesoEnvio(envio: EnvioRuta): number {
    return envio.pedidos.reduce((s, p) => s + (p.pesoGramos ?? 0), 0);
  }

  // ------------------------------------------------------------
  // Leaflet
  // ------------------------------------------------------------

  private initMap(el: HTMLDivElement): void {
    this.map = L.map(el).setView([-38.9517, -68.0626], 13); // Neuquén
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  private destroyMap(): void {
    this.map?.remove();
    this.map = undefined;
    this.routeLayers = [];
    this.markersLayer = undefined;
  }

  private renderRoutes(): void {
    const plan = this.plan();
    if (!this.map || !plan || !this.markersLayer) return;

    this.routeLayers.forEach((l) => l.remove());
    this.routeLayers = [];
    this.markersLayer.clearLayers();

    const depIcon = L.divIcon({
      html: `<div style="background:#16a34a;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
      className: '', iconSize: [24, 24], iconAnchor: [12, 12],
    });
    L.marker([plan.deposito.latitud, plan.deposito.longitud], { icon: depIcon })
      .bindPopup(`<b>Depósito</b><br>${plan.deposito.nombre}`)
      .addTo(this.markersLayer);

    const bounds = L.latLngBounds([[plan.deposito.latitud, plan.deposito.longitud]]);

    plan.envios.forEach((envio, v) => {
      const color = colorCamion(v);
      if (envio.rutaOptima?.features) {
        const layer = L.geoJSON(envio.rutaOptima, { style: { color, weight: 5, opacity: 0.8 } }).addTo(this.map!);
        this.routeLayers.push(layer);
        const lb = layer.getBounds();
        if (lb.isValid()) bounds.extend(lb);
      }
      envio.pedidos.forEach((p) => {
        if (p.ordenRuta == null || !p.comercio) return;
        const icon = L.divIcon({
          html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">${p.ordenRuta}</div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const eta = p.llegadaEstimada ? formatTime(p.llegadaEstimada) : '?';
        L.marker([p.comercio.latitud, p.comercio.longitud], { icon })
          .bindPopup(`<b>Parada ${p.ordenRuta}</b><br>${p.comercio.nombre}<br>Llegada estimada: ${eta}<br>Camión ${envio.camion?.interno ?? envio.camionId}`)
          .addTo(this.markersLayer!);
        bounds.extend([p.comercio.latitud, p.comercio.longitud]);
      });
    });

    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [40, 40] });
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  private showError(err: { error?: { message?: string | string[] } }): void {
    this.messages.add({ severity: 'error', summary: 'Error', detail: mensajeError(err) });
  }
}
