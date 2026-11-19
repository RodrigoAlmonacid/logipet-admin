import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service';
import { Deposito, DepositoCatalogoService } from '../../services/deposito-catalogo.service';
import { PlanRuta, PlanRutaService } from '../../services/plan-ruta.service';
import { permissionsFor } from '../../helpers/permission-for';
import { PERMISOS } from '../../helpers/permisos.constants';
import { MultiSelectModule } from 'primeng/multiselect';
import { Camion, CamionesService } from '../../services/camiones.service';

// ============================================================
// PlanRutaListComponent — lista todos los planes de ruta.
//
// Sigue el mismo patrón que EmpleadosComponent:
//   - PrimeNG table con signal-based state
//   - Dialog inline para crear nuevo plan
//   - Toast messages + ConfirmDialog
//   - permissionsFor() para UI condicional
//
// Cada fila tiene un botón "Ver" que navega al detalle con mapa.
// ============================================================

@Component({
  selector: 'app-plan-ruta-list',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    DatePickerModule, SelectModule, TagModule, ToastModule, ConfirmDialogModule, MultiSelectModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './plan-ruta-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanRutaListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly planRutaService = inject(PlanRutaService);
  private readonly depositoCatalogo = inject(DepositoCatalogoService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly camionesService = inject(CamionesService);
  protected readonly camiones = signal<(Camion & { etiqueta: string })[]>([]);

  protected readonly planes = signal<PlanRuta[]>([]);
  protected readonly depositos = signal<Deposito[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly optimizing = signal<number | null>(null);
  protected readonly dialogVisible = signal(false);

  protected readonly permiso = permissionsFor('planruta');

  // permissionsFor no tiene canOptimize (sólo canView/create/update/delete/etc.)
  // — lo calculamos directo desde auth.can() con el permiso específico.
  protected readonly canOptimize = computed(() => this.auth.can(PERMISOS.PLANRUTA_OPTIMIZE));

  protected readonly form = this.fb.nonNullable.group({
    fecha: [new Date(), Validators.required],
    depositoId: [0, [Validators.required, Validators.min(1)]],
    horaLimite: [this.defaultHoraLimite(), Validators.required],
    camionIds: [[] as number[], Validators.required], // required rechaza el array vacío
  });

  ngOnInit(): void {
    this.load();
    this.depositoCatalogo.findActivos().subscribe({
      next: (deps) => this.depositos.set(deps),
      error: (err) => this.showError(err),
    });
    this.camionesService.listar().subscribe({
      next: (lista) => this.camiones.set(
        lista.filter((c) => c.disponible)
          .map((c) => ({ ...c, etiqueta: `Interno ${c.interno} · ${c.marca}` })),
      ),
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.planRutaService.list().subscribe({
      next: (data) => {
        this.planes.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err);
      },
    });
  }

  protected openCreate(): void {
    if (!this.permiso.canCreate()) return;
    this.form.reset({
      fecha: new Date(),
      depositoId: 0,
      horaLimite: this.defaultHoraLimite(),
      camionIds: [],
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (!this.permiso.canCreate()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fecha, depositoId, horaLimite, camionIds } = this.form.getRawValue();
    this.saving.set(true);

    this.planRutaService.create({
      fecha: this.toIso(fecha),
      depositoId,
      horaLimite: this.toIso(horaLimite),
      camionIds,
    }).subscribe({
      next: (plan) => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Plan de ruta creado',
          detail: `Plan #${plan.id} para ${plan.deposito.nombre}`,
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err);
      },
    });
  }

  protected verDetalle(plan: PlanRuta): void {
    this.router.navigate(['/plan-rutas', plan.id]);
  }

  protected optimizar(plan: PlanRuta): void {
    if (!this.canOptimize()) return;
    if (plan.estado === 'OPTIMIZADO') {
      this.confirmation.confirm({
        header: 'Re-optimizar',
        message: `El plan #${plan.id} ya está optimizado. ¿Re-optimizar? Se perderán las rutas actuales.`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Re-optimizar',
        rejectLabel: 'Cancelar',
        accept: () => this.doOptimize(plan.id, true),
      });
      return;
    }
    this.doOptimize(plan.id, false);
  }

  private doOptimize(planId: number, reOptimize: boolean): void {
    const runOptimize = () => {
      this.optimizing.set(planId);
      this.planRutaService.optimize(planId, 10_000).subscribe({
        next: (result) => {
          this.optimizing.set(null);
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
              detail: `${result.enviosCreados} envío(s), ${result.pedidosAsignados} pedido(s), ${(result.distanciaTotalMetros / 1000).toFixed(2)} km total.`,
            });
          }
          this.load();
        },
        error: (err) => {
          this.optimizing.set(null);
          this.showError(err);
        },
      });
    };

    if (reOptimize) {
      // Pasar a PENDIENTE primero, después optimizar
      this.planRutaService.updateEstado(planId, 'PENDIENTE').subscribe({
        next: () => runOptimize(),
        error: (err) => this.showError(err),
      });
    } else {
      runOptimize();
    }
  }

  // ------------------------------------------------------------
  // Helpers privados
  // ------------------------------------------------------------

  private defaultHoraLimite(): Date {
    // Default: hoy a las 20:00
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  }

  private toIso(date: Date): string {
    // Calendar devuelve un Date local — lo convertimos a ISO UTC
    return date.toISOString();
  }

  protected estadoSeverity(estado: PlanRuta['estado']): 'success' | 'info' | 'warn' | 'danger' {
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

  private showError(err: HttpErrorResponse): void {
    const m = err.error?.message;
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.'),
    });
  }
}