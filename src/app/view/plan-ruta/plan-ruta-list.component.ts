import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Camion, CamionesService } from '../../services/camiones.service';
import { ColaRuteo, PlanRuta, PlanRutaService } from '../../services/plan-ruta.service';
import { permissionsFor } from '../../helpers/permission-for';
import { ESTADO_PLAN, etiquetaFecha, fechaLocalIso, formatDate, formatKg, formatTime, mensajeError, pad2 } from '../../helpers/plan-ruta-ui';

// ============================================================
// Lista de planes de ruta — flujo guiado:
//   1. Se ve la cola (qué hay para rutear) y los planes existentes.
//   2. "Nuevo plan": fecha entre los próximos días hábiles, camiones disponibles con
//      capacidad vs. peso de la cola, y hora límite (solo hora).
//   3. Al crear, se abre el detalle del plan, donde está el paso siguiente (Optimizar).
// ============================================================

@Component({
  selector: 'app-plan-ruta-list',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, DatePickerModule,
    SelectModule, MultiSelectModule, TagModule, ToastModule, MessageModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './plan-ruta-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanRutaListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly planRutaService = inject(PlanRutaService);
  private readonly camionesService = inject(CamionesService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);

  protected readonly permiso = permissionsFor('planruta');

  protected readonly planes = signal<PlanRuta[]>([]);
  protected readonly camiones = signal<(Camion & { etiqueta: string })[]>([]);
  protected readonly fechas = signal<{ value: string; label: string }[]>([]);
  protected readonly cola = signal<ColaRuteo | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fecha: ['', Validators.required],
    camionIds: [[] as number[], [Validators.required, Validators.minLength(1)]],
    horaLimite: [this.horaPorDefecto(), Validators.required],
  });

  private readonly camionIdsSel = toSignal(this.form.controls.camionIds.valueChanges, { initialValue: [] as number[] });

  /** Capacidad total elegida (en gramos) vs. peso de la cola: avisa antes de optimizar. */
  protected readonly capacidadGramos = computed(() =>
    this.camiones().filter((c) => this.camionIdsSel().includes(c.id)).reduce((s, c) => s + c.capacidad * 1000, 0),
  );
  protected readonly capacidadInsuficiente = computed(() => {
    const c = this.cola();
    return !!c && this.camionIdsSel().length > 0 && this.capacidadGramos() < c.pesoTotalGramos;
  });

  protected readonly formatKg = formatKg;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.planRutaService.list().subscribe({
      next: (data) => { this.planes.set(data); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.showError(err); },
    });
    if (this.permiso.canCreate()) {
      this.planRutaService.cola().subscribe({ next: (c) => this.cola.set(c), error: () => this.cola.set(null) });
    }
  }

  protected openCreate(): void {
    if (!this.permiso.canCreate()) return;
    this.form.reset({ fecha: '', camionIds: [], horaLimite: this.horaPorDefecto() });
    this.planRutaService.fechasDisponibles().subscribe({
      next: (fs) => {
        this.fechas.set(fs.map((f) => ({ value: f, label: etiquetaFecha(f) })));
        if (fs.length) this.form.controls.fecha.setValue(fs[0]);
      },
      error: (err) => this.showError(err),
    });
    this.camionesService.listar().subscribe({
      next: (cs) =>
        this.camiones.set(
          cs.filter((c) => c.disponible).map((c) => ({
            ...c,
            etiqueta: `Camión ${c.interno} · ${c.marca}${c.modelo ? ' ' + c.modelo : ''} · ${c.capacidad.toLocaleString('es-AR')} kg`,
          })),
        ),
      error: (err) => this.showError(err),
    });
    this.planRutaService.cola().subscribe({ next: (c) => this.cola.set(c) });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (!this.permiso.canCreate()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const { fecha, camionIds, horaLimite } = this.form.getRawValue();
    this.saving.set(true);
    this.planRutaService.create({
      fecha: fechaLocalIso(fecha),
      camionIds,
      horaLimite: fechaLocalIso(fecha, `${pad2(new Date(horaLimite).getHours())}:${pad2(new Date(horaLimite).getMinutes())}`),
    }).subscribe({
      next: (plan) => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        // El siguiente paso (Optimizar) está en el detalle: llevamos al usuario directo.
        this.router.navigate(['/plan-rutas', plan.id]);
      },
      error: (err) => { this.saving.set(false); this.showError(err); },
    });
  }

  protected abrir(plan: PlanRuta): void {
    this.router.navigate(['/plan-rutas', plan.id]);
  }

  protected puedeEliminar(plan: PlanRuta): boolean {
    return this.permiso.canCreate() && ['PENDIENTE', 'FALLIDO'].includes(plan.estado) && plan.envios.length === 0;
  }

  protected eliminar(plan: PlanRuta): void {
    this.confirmation.confirm({
      header: 'Eliminar hoja de ruta',
      message: `¿Eliminar la hoja del ${formatDate(plan.fecha)}? Los pedidos de la cola no se tocan.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.planRutaService.eliminar(plan.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Eliminada', detail: `Plan #${plan.id}` });
            this.load();
          },
          error: (err) => this.showError(err),
        }),
    });
  }

  /** Texto del botón principal de cada fila según en qué paso está el plan. */
  protected accion(plan: PlanRuta): { label: string; icon: string; severity: 'success' | 'primary' | 'secondary' } {
    switch (plan.estado) {
      case 'PENDIENTE':
      case 'FALLIDO': return { label: 'Optimizar', icon: 'pi pi-bolt', severity: 'primary' };
      case 'OPTIMIZADO': return { label: 'Asignar y despachar', icon: 'pi pi-users', severity: 'success' };
      default: return { label: 'Ver', icon: 'pi pi-eye', severity: 'secondary' };
    }
  }

  protected etiquetaEstado(plan: PlanRuta): string {
    return ESTADO_PLAN[plan.estado].label;
  }
  protected severidadEstado(plan: PlanRuta) {
    return ESTADO_PLAN[plan.estado].severity;
  }

  protected totalPedidos(plan: PlanRuta): number {
    return plan.envios.reduce((s, e) => s + e.pedidos.length, 0);
  }

  private horaPorDefecto(): Date {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  }

  private showError(err: { error?: { message?: string | string[] } }): void {
    this.messages.add({ severity: 'error', summary: 'Error', detail: mensajeError(err) });
  }
}
