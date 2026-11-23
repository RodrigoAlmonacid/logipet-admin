import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { EnvioMiRuta, PedidoMiRuta, PlanRutaService } from '../../services/plan-ruta.service';
import { RepartoService } from '../../services/reparto.service';
import { MotivoBaja } from '../../services/pedido.service';
import { formatKg, formatTime, mensajeError } from '../../helpers/plan-ruta-ui';
import { ParadaMapa, RutaMapaComponent } from './../../shared/components/ruta-mapa/ruta-mapa.component';

// ============================================================
// Mi ruta — vista MÓVIL de chofer y ayudante.
// Paradas en orden, con teléfono y dirección (abre Google Maps), "Entregado" de un toque
// y "No se pudo entregar" con motivo. Cliente ausente => vuelve a la cola de ruteo.
// ============================================================

@Component({
  selector: 'app-mi-ruta',
  imports: [ReactiveFormsModule, RutaMapaComponent, ButtonModule, TagModule, ToastModule, ConfirmDialogModule, DialogModule, SelectModule, TextareaModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './mi-ruta.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiRutaComponent implements OnInit {
  private readonly planRutaService = inject(PlanRutaService);
  private readonly reparto = inject(RepartoService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly envios = signal<EnvioMiRuta[]>([]);
  protected readonly loading = signal(false);
  protected readonly trabajando = signal<number | null>(null);
  protected readonly fallido = signal<PedidoMiRuta | null>(null);
  /** Envíos cuyo mapa está desplegado (en el celu arranca cerrado para no gastar datos ni pantalla). */
  protected readonly mapasAbiertos = signal<ReadonlySet<number>>(new Set());
  protected readonly dialogVisible = computed(() => this.fallido() !== null);

  protected readonly motivos: { label: string; value: MotivoBaja }[] = [
    { label: 'Cliente ausente (se reprograma)', value: 'CLIENTE_AUSENTE' },
    { label: 'El cliente rechazó el pedido', value: 'CLIENTE_RECHAZO' },
    { label: 'Producto dañado', value: 'PRODUCTO_DANADO' },
  ];
  protected readonly motivoCtrl = new FormControl<MotivoBaja | null>(null, Validators.required);
  protected readonly obsCtrl = new FormControl('', { nonNullable: true });

  protected readonly formatTime = formatTime;
  protected readonly formatKg = formatKg;

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.planRutaService.misEnvios().subscribe({
      next: (e) => { this.envios.set(e); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.error(err); },
    });
  }

  protected toggleMapa(envioId: number): void {
    this.mapasAbiertos.update((abiertos) => {
      const nuevo = new Set(abiertos);
      if (!nuevo.delete(envioId)) nuevo.add(envioId);
      return nuevo;
    });
  }

  /**
   * Paradas de cada envío, en orden; las ya resueltas se dibujan en gris.
   * Es un computed (y no un método) para que el array no cambie en cada ciclo de detección
   * y el mapa no se redibuje ni pierda el zoom del chofer.
   */
  protected readonly paradasPorEnvio = computed(
    () =>
      new Map<number, ParadaMapa[]>(
        this.envios().map((e) => [
          e.id,
          e.pedidos
            .filter((p) => p.ordenRuta != null)
            .map((p) => ({
              orden: p.ordenRuta as number,
              latitud: p.comercio.latitud,
              longitud: p.comercio.longitud,
              nombre: p.comercio.nombre,
              direccion: p.comercio.direccion,
              eta: p.llegadaEstimada ? formatTime(p.llegadaEstimada) : null,
              resuelta: this.estadoDe(p) !== 'en_ruta',
            })),
        ]),
      ),
  );

  protected estadoDe(p: PedidoMiRuta): string {
    return p.historialEstados[0]?.estado.nombre ?? '';
  }
  protected enCalle(p: PedidoMiRuta): boolean {
    return this.estadoDe(p) === 'en_ruta';
  }
  protected resumen(e: EnvioMiRuta): { total: number; hechos: number } {
    return { total: e.pedidos.length, hechos: e.pedidos.filter((p) => !this.enCalle(p)).length };
  }
  /** Próxima parada pendiente de cada envío (se destaca). */
  protected proxima(e: EnvioMiRuta): number | null {
    return e.pedidos.find((p) => this.enCalle(p))?.id ?? null;
  }
  protected etiquetaEstado(p: PedidoMiRuta): { label: string; severity: 'success' | 'warn' | 'danger' | 'info' } {
    switch (this.estadoDe(p)) {
      case 'entregado': return { label: 'Entregado', severity: 'success' };
      case 'no_entregado': return { label: 'Reprogramado', severity: 'warn' };
      case 'cancelado': return { label: 'Cancelado', severity: 'danger' };
      default: return { label: 'Pendiente', severity: 'info' };
    }
  }
  protected mapsUrl(p: PedidoMiRuta): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.comercio.latitud},${p.comercio.longitud}`;
  }

  protected entregar(p: PedidoMiRuta): void {
    this.confirmation.confirm({
      header: 'Confirmar entrega',
      message: `¿Entregaste el pedido #${p.id} en ${p.comercio.nombre}?`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, entregado',
      rejectLabel: 'Todavía no',
      accept: () => {
        this.trabajando.set(p.id);
        this.reparto.entregar(p.id).subscribe({
          next: () => { this.trabajando.set(null); this.messages.add({ severity: 'success', summary: 'Entregado', detail: p.comercio.nombre }); this.cargar(); },
          error: (err) => { this.trabajando.set(null); this.error(err); },
        });
      },
    });
  }

  protected abrirNoEntregado(p: PedidoMiRuta): void {
    this.motivoCtrl.reset(null);
    this.obsCtrl.reset('');
    this.fallido.set(p);
  }
  protected cerrar(): void {
    this.fallido.set(null);
  }

  protected confirmarNoEntregado(): void {
    const p = this.fallido();
    if (!p) return;
    if (this.motivoCtrl.invalid) { this.motivoCtrl.markAsTouched(); return; }
    this.trabajando.set(p.id);
    this.reparto.noEntregado(p.id, this.motivoCtrl.value!, this.obsCtrl.value || undefined).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.fallido.set(null);
        this.messages.add({ severity: 'info', summary: 'Registrado', detail: p.comercio.nombre });
        this.cargar();
      },
      error: (err) => { this.trabajando.set(null); this.error(err); },
    });
  }

  private error(err: { error?: { message?: string | string[] } }): void {
    this.messages.add({ severity: 'error', summary: 'Error', detail: mensajeError(err) });
  }
}
