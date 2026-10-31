import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { finalize, timer } from 'rxjs';
import { DepositoService, LineaDeposito, PedidoDeposito } from '../../services/deposito.service';
import { EscanerComponent } from '../../shared/components/escaner/escaner.component';

const nombreEstado = (p: PedidoDeposito) =>
  p.historialEstados.find((h) => h.fechaFin === null)?.estado.nombre;

// EAN/UPC: el lector puede devolver un cero de más o de menos
const normalizar = (s: string) => s.trim().replace(/^0+/, '');

@Component({
  selector: 'app-deposito',
  imports: [
    ReactiveFormsModule, ButtonModule, ConfirmDialogModule, DialogModule, InputNumberModule,
    InputTextModule, TagModule, TextareaModule, ToastModule, EscanerComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './deposito.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepositoComponent implements OnInit {
  private readonly deposito = inject(DepositoService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly cargando = signal(false);
  protected readonly procesando = signal(false);
  protected readonly actual = signal<PedidoDeposito | null>(null);
  protected readonly cola = signal<PedidoDeposito[]>([]);
  protected readonly escaneando = signal(false);
  protected readonly lineaActiva = signal<LineaDeposito | null>(null);

  protected readonly cantidadCtrl = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });
  protected readonly justificacionCtrl = new FormControl('', { nonNullable: true });
  protected readonly codigoManual = new FormControl('', { nonNullable: true });
  private readonly cantidadValor = toSignal(this.cantidadCtrl.valueChanges, { initialValue: 0 });

  protected readonly hayFaltante = computed(
    () => (this.cantidadValor() ?? 0) < (this.lineaActiva()?.cantidad ?? 0),
  );

  // pendientes primero: lo que falta escanear queda arriba
  protected readonly lineasOrdenadas = computed(() =>
    [...(this.actual()?.lineas ?? [])].sort(
      (a, b) => Number(a.verificado) - Number(b.verificado) || a.nombre.localeCompare(b.nombre),
    ),
  );
  protected readonly verificadas = computed(() => this.actual()?.lineas.filter((l) => l.verificado).length ?? 0);
  protected readonly todoVerificado = computed(() => {
    const total = this.actual()?.lineas.length ?? 0;
    return total > 0 && this.verificadas() === total;
  });

  constructor() {
    // la cola se refresca sola mientras el operario no tiene un pedido en curso
    timer(30_000, 30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.actual() && !this.procesando()) this.cargarCola();
      });
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.deposito.actual().subscribe({
      next: (p) => {
        this.actual.set(p);
        if (p) {
          this.cola.set([]);
          this.cargando.set(false);
        } else {
          this.cargarCola();
        }
      },
      error: (err) => {
        this.cargando.set(false);
        this.showError(err);
      },
    });
  }

  private cargarCola(): void {
    this.deposito
      .cola()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (data) => this.cola.set(data.filter((p) => nombreEstado(p) === 'pendiente_preparacion')),
        error: (err) => this.showError(err),
      });
  }

  protected espera(p: PedidoDeposito): string {
    const desde = p.historialEstados.find((h) => h.fechaFin === null)?.fechaCreac;
    if (!desde) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(desde).getTime()) / 60000));
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  }

  protected formatoPeso(g: number): string {
    return g >= 1000 ? `${(g / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg` : `${g} g`;
  }

  // ---------- acciones ----------
  protected tomar(p: PedidoDeposito): void {
    this.procesando.set(true);
    this.deposito
      .tomar(p.id)
      .pipe(finalize(() => this.procesando.set(false)))
      .subscribe({
        next: (ped) => {
          this.actual.set(ped);
          this.cola.set([]);
        },
        error: (err) => {
          this.showError(err);
          this.cargar(); // por ejemplo, otro operario lo tomó antes
        },
      });
  }

  protected confirmarSoltar(): void {
    const p = this.actual();
    if (!p) return;
    this.confirmation.confirm({
      header: 'Soltar pedido',
      message: `¿Devolver el pedido #${p.id} a la cola? Se pierden las verificaciones hechas.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Soltar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.procesando.set(true);
        this.deposito
          .soltar(p.id)
          .pipe(finalize(() => this.procesando.set(false)))
          .subscribe({
            next: () => this.reiniciar(),
            error: (err) => this.fallo(err),
          });
      },
    });
  }

  protected confirmarPreparado(): void {
    const p = this.actual();
    if (!p || !this.todoVerificado()) return;
    this.confirmation.confirm({
      header: 'Pedido preparado',
      message: `¿Marcar el pedido #${p.id} como preparado?`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Marcar preparado',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.procesando.set(true);
        this.deposito
          .preparado(p.id)
          .pipe(finalize(() => this.procesando.set(false)))
          .subscribe({
            next: () => {
              this.messages.add({ severity: 'success', summary: `Pedido #${p.id} preparado` });
              this.reiniciar();
            },
            error: (err) => this.fallo(err),
          });
      },
    });
  }

  // ---------- escaneo y cantidad ----------
  protected onCodigo(codigo: string): void {
    const p = this.actual();
    if (!p || this.lineaActiva()) return;
    const linea = p.lineas.find((l) => normalizar(l.codigo) === normalizar(codigo));
    if (!linea) {
      this.messages.add({ severity: 'warn', summary: 'Código no encontrado', detail: `${codigo} no está en este pedido.` });
      return;
    }
    this.cantidadCtrl.setValue(linea.cantidad);
    this.justificacionCtrl.reset('');
    this.lineaActiva.set(linea);
  }

  protected usarCodigoManual(): void {
    const codigo = this.codigoManual.value.trim();
    if (!codigo) return;
    this.onCodigo(codigo);
    this.codigoManual.reset('');
  }

  protected confirmarLinea(): void {
    const p = this.actual();
    const l = this.lineaActiva();
    if (!p || !l) return;

    const cantidad = this.cantidadCtrl.value ?? 0;
    const justificacion = this.justificacionCtrl.value.trim();
    if (cantidad < l.cantidad && justificacion.length < 5) {
      this.justificacionCtrl.markAsTouched();
      return;
    }

    this.procesando.set(true);
    this.deposito
      .verificar(p.id, l.articuloId, {
        codigo: l.codigo,
        cantidad,
        justificacion: cantidad < l.cantidad ? justificacion : undefined,
      })
      .pipe(finalize(() => this.procesando.set(false)))
      .subscribe({
        next: (ped) => {
          this.actual.set(ped);
          this.lineaActiva.set(null);
          if (ped.lineas.every((x) => x.verificado)) this.escaneando.set(false); // ya no hay nada que escanear
        },
        error: (err) => this.fallo(err),
      });
  }

  // ---------- helpers ----------
  private reiniciar(): void {
    this.escaneando.set(false);
    this.lineaActiva.set(null);
    this.actual.set(null);
    this.cargar();
  }

  // 403/404 = el pedido ya no es nuestro (p. ej. administración lo canceló): resincronizar
  private fallo(err: HttpErrorResponse): void {
    this.showError(err);
    if (err.status === 403 || err.status === 404) this.reiniciar();
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