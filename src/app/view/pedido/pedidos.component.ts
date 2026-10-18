import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service';
import { Articulo, ArticuloService } from '../../services/articulo.service';
import { Cliente, ClienteService } from '../../services/cliente.service';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Pedido, ItemPedido, PedidoService, estadoActual, puedeCancelar, puedeConfirmar, puedeEditar,
  esBorrador,
  LineaCalculada,
  puedeAprobar,
  puedeRechazar,
  cancelaRequiereMotivo,
  MotivoBaja,
  Vista,
  puedeReabrir,
  motivoRechazo,
} from '../../services/pedido.service';
import { permissionsFor } from '../../helpers/permission-for';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ValidatorFn } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { PERMISOS } from '../../helpers/permisos.constants';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';

function stockValidator(getArticulos: () => Articulo[]): ValidatorFn {
  return (group) => {
    const { articuloId, cantidad } = group.value;
    const art = getArticulos().find((a) => a.id === articuloId);
    if (!art || cantidad == null) return null;
    return cantidad > art.stock
      ? { stockInsuficiente: { stock: art.stock, cantidad } }
      : null;
  };
}

function crearItemGroup(
  fb: FormBuilder,
  getArticulos: () => Articulo[],
  articuloId: number | null = null,
  cantidad = 1,
  descuentoPorcentaje = 0,
) {
  return fb.nonNullable.group(
    {
      articuloId: [articuloId as number | null, Validators.required],
      cantidad: [cantidad, [Validators.required, Validators.min(1)]],
      descuentoPorcentaje: [descuentoPorcentaje, [Validators.min(0), Validators.max(100)]],
    },
    { validators: stockValidator(getArticulos) },
  );
}

type ItemGroup = ReturnType<typeof crearItemGroup>;

const PESTANAS: { vista: Vista; label: string; permisos: string[] }[] = [
  { vista: 'borradores', label: 'Borradores', permisos: [PERMISOS.PEDIDO_VIEW] },
  { vista: 'rechazados', label: 'Rechazados', permisos: [PERMISOS.PEDIDO_VIEW] },
  { vista: 'en-proceso', label: 'En proceso', permisos: [PERMISOS.PEDIDO_VIEW, PERMISOS.PEDIDO_VIEW_ALL] },
  { vista: 'finalizados', label: 'Finalizados', permisos: [PERMISOS.PEDIDO_VIEW, PERMISOS.PEDIDO_VIEW_ALL] },
  { vista: 'administracion', label: 'Por aprobar', permisos: [PERMISOS.PEDIDO_APPROVE, PERMISOS.PEDIDO_REJECT] },
  { vista: 'deposito', label: 'Depósito', permisos: [PERMISOS.PEDIDO_PREPARE] },
  { vista: 'ruteo', label: 'Ruteo', permisos: [PERMISOS.PEDIDO_ROUTE] },
];

@Component({
  selector: 'app-pedidos',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, CurrencyPipe, DatePipe,
    SelectModule, InputNumberModule, TagModule, ToastModule, ConfirmDialogModule,
    TabsModule, TooltipModule, TextareaModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './pedidos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PedidosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly pedidoService = inject(PedidoService);
  private readonly clienteService = inject(ClienteService);
  private readonly articuloService = inject(ArticuloService);
  protected readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly clientesActivos = signal<Cliente[]>([]);
  protected readonly articulos = signal<Articulo[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Pedido | null>(null);

  // expuestos al template, para no repetir la lógica de estado en el HTML
  protected readonly estadoActual = estadoActual;
  protected readonly puedeEditar = puedeEditar;
  protected readonly puedeConfirmar = puedeConfirmar;
  protected readonly puedeCancelar = puedeCancelar;
  protected readonly esBorrador = esBorrador;
  protected readonly lineasCalculadas = signal<(LineaCalculada | null)[]>([]);

  protected readonly permisoPedido = permissionsFor('pedido');

  protected readonly form = this.fb.nonNullable.group({
    clienteId: [null as number | null, Validators.required],
    items: this.fb.array<ItemGroup>([]),
  });

  protected get items() {
    return this.form.controls.items;
  }

  protected readonly puedeAprobar = puedeAprobar;
  protected readonly puedeRechazar = puedeRechazar;
  protected readonly cancelaRequiereMotivo = cancelaRequiereMotivo;

  protected readonly motivos: { label: string; value: MotivoBaja }[] = [
    { label: 'Arrepentimiento del cliente', value: 'ARREPENTIMIENTO' },
    { label: 'Producto dañado o vencido', value: 'PRODUCTO_DANADO' },
  ];

  protected readonly cancelando = signal<Pedido | null>(null);
  protected readonly rechazando = signal<Pedido | null>(null);
  protected readonly motivoCtrl = new FormControl<MotivoBaja | null>(null, Validators.required);
  protected readonly observacionCtrl = new FormControl('', { nonNullable: true });
  protected readonly rechazoCtrl = new FormControl('', { nonNullable: true, validators: Validators.required });

  protected readonly puedeReabrir = puedeReabrir;
  protected readonly motivoRechazo = motivoRechazo;

  protected readonly pestanas = computed(() => PESTANAS.filter((t) => this.auth.canAny(t.permisos)));
  protected readonly vistaActiva = signal<Vista | null>(null);
  protected readonly viendo = signal<Pedido | null>(null);

  ngOnInit(): void {
    const primera = this.pestanas()[0];
    if (primera) {
      this.vistaActiva.set(primera.vista);
      this.load();
    }

    const arma = this.permisoPedido.canCreate() || this.permisoPedido.canUpdate();
    if (arma) {
      this.clienteService.list().subscribe({
        next: (data) => this.clientesActivos.set(data.filter((c) => c.activo)),
        error: (err) => this.showError(err),
      });
    }
    if (arma || this.permisoPedido.canConfirm()) this.cargarArticulos();
  }

  protected verDetalle(pedido: Pedido): void {
    this.viendo.set(pedido);
  }

  protected cambiarVista(v: string | number | undefined): void {
    this.vistaActiva.set(v as Vista);
    this.load();
  }

  protected reabrirPedido(pedido: Pedido): void {
    this.pedidoService.reabrir(pedido.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Vuelto a borrador', detail: 'Corregilo y confirmalo de nuevo.' });
        this.load();
      },
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    const vista = this.vistaActiva();
    if (!vista) return;
    this.loading.set(true);
    this.pedidoService.list(vista).subscribe({
      next: (data) => { this.pedidos.set(data); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.showError(err); },
    });
  }

  constructor() {
    this.items.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.recalcular());
  }

  protected severidad(e: string) {
    const m: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      borrador: 'secondary', pendiente: 'warn', pendiente_preparacion: 'info',
      en_preparacion: 'info', preparado: 'info', en_ruta: 'info',
      entregado: 'success', no_entregado: 'warn', rechazado: 'danger', cancelado: 'danger',
    };
    return m[e] ?? 'secondary';
  }

  protected agregarItem(): void {
    this.items.push(crearItemGroup(this.fb, () => this.articulos()));
  }

  protected quitarItem(i: number): void {
    this.items.removeAt(i);
  }

  private cargarArticulos(): void {
    this.articuloService.list().subscribe({
      next: (data) => {
        this.articulos.set(data);
        // si el diálogo ya está armado, revalidá con el stock nuevo
        this.items.controls.forEach((c) => c.updateValueAndValidity());
        this.recalcular();
      },
      error: (err) => this.showError(err),
    });
  }

  protected stockDe(i: number): number | null {
    const id = this.items.at(i).controls.articuloId.value;
    return this.articulos().find((a) => a.id === id)?.stock ?? null;
  }

  protected stockPendiente(pedido: Pedido, articuloId: number): number | null {
  if (estadoActual(pedido) !== 'pendiente') return null;
  return pedido.articulos.find((d) => d.articuloId === articuloId)?.articulo.stock ?? null;
}

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ clienteId: null });
    this.items.clear();
    this.agregarItem();
    this.dialogVisible.set(true);
  }

  protected openEdit(pedido: Pedido): void {
    this.editing.set(pedido);
    this.form.reset({ clienteId: pedido.cliente.id });
    this.items.clear();
    pedido.articulos.forEach((d) =>
      this.items.push(
        crearItemGroup(this.fb, () => this.articulos(), d.articuloId, d.cantidad, d.descuentoPorcentaje ?? 0),
      ),
    );
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const { clienteId, items } = this.form.getRawValue();
    const itemsValidos: ItemPedido[] = items.flatMap(({ articuloId, cantidad, descuentoPorcentaje }) =>
      articuloId === null ? [] : [{ articuloId, cantidad, descuentoPorcentaje }],
    );


    if (clienteId === null || itemsValidos.length !== items.length) {
      this.form.markAllAsTouched();
      return;
    }

    const dto = { clienteId, items: itemsValidos };
    const current = this.editing();
    this.saving.set(true);

    const req$ = current
      ? this.pedidoService.update(current.id, dto)
      : this.pedidoService.create(dto);

    req$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.dialogVisible.set(false);
          this.messages.add({
            severity: 'success',
            summary: current ? 'Pedido actualizado' : 'Pedido creado',
          });
          this.load();
        },
        error: (err) => this.showError(err),
      });
  }

  protected confirmarPedido(pedido: Pedido): void {
    const sinStock = pedido.articulos.filter((d) => {
      const art = this.articulos().find((a) => a.id === d.articuloId);
      return !art || d.cantidad > art.stock;
    });

    if (sinStock.length) {
      const detalle = sinStock
        .map((d) => {
          const art = this.articulos().find((a) => a.id === d.articuloId);
          return `${art?.nombre ?? `Artículo ${d.articuloId}`} (pedido: ${d.cantidad}, stock: ${art?.stock ?? 0})`;
        })
        .join(' · ');
      this.messages.add({
        severity: 'error',
        summary: 'Stock insuficiente',
        detail: detalle,
        sticky: true,
      });
      return;
    }
    this.confirmation.confirm({
      header: 'Confirmar pedido',
      message: `¿Confirmar el pedido #${pedido.id}? Pasará a estado "pendiente".`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Confirmar',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.pedidoService.confirmar(pedido.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Pedido confirmado' });
            this.load();
            this.cargarArticulos(); // el stock pudo cambiar
          },
          error: (err) => this.showError(err),
        }),
    });
  }

  protected cancelarPedido(pedido: Pedido): void {
    if (cancelaRequiereMotivo(pedido)) {
      this.motivoCtrl.reset();
      this.observacionCtrl.reset();
      this.cancelando.set(pedido);
      return;
    }
    // borrador/pendiente: sin stock descontado, el confirm de siempre
    this.confirmation.confirm({
      header: 'Cancelar pedido',
      message: `¿Cancelar el pedido #${pedido.id}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cancelar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.ejecutarCancelacion(pedido.id, {}),
    });
  }

  protected confirmarCancelacion(): void {
    const pedido = this.cancelando();
    if (!pedido || this.motivoCtrl.invalid) {
      this.motivoCtrl.markAsTouched();
      return;
    }
    this.ejecutarCancelacion(pedido.id, {
      motivo: this.motivoCtrl.value!,
      observacion: this.observacionCtrl.value || undefined,
    });
    this.cancelando.set(null);
  }

  private ejecutarCancelacion(id: number, body: { motivo?: MotivoBaja; observacion?: string }): void {
    this.pedidoService.cancelar(id, body).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Pedido cancelado' });
        this.load();
        this.cargarArticulos(); // si devolvió stock, hay que refrescarlo
      },
      error: (err) => this.showError(err),
    });
  }

  protected esPropio(pedido: Pedido): boolean {
    return pedido.empleado.id === this.auth.userId();
  }

  // cancel: solo lo propio y antes de que administración lo apruebe
  // cancel_any: cualquier pedido, en cualquier etapa cancelable
  protected puedeCancelarPedido(pedido: Pedido): boolean {
    if (!puedeCancelar(pedido)) return false;
    if (this.permisoPedido.canCancelAny()) return true;
    return (
      this.permisoPedido.canCancel() &&
      this.esPropio(pedido) &&
      ['borrador', 'pendiente', 'rechazado'].includes(estadoActual(pedido))
    );
  }

  protected aprobarPedido(pedido: Pedido): void {
    this.confirmation.confirm({
      header: 'Aprobar pedido',
      message: `¿Aprobar el pedido #${pedido.id}? Se descontará el stock de los artículos.`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Aprobar',
      rejectLabel: 'Volver',
      accept: () =>
        this.pedidoService.aprobar(pedido.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Pedido aprobado' });
            this.load();
            this.cargarArticulos();
            this.viendo.set(null);
          },
          error: (err) => this.showError(err),
        }),
    });
  }

  protected rechazarPedido(pedido: Pedido): void {
    this.rechazoCtrl.reset();
    this.rechazando.set(pedido);
  }

  protected confirmarRechazo(): void {
    const pedido = this.rechazando();
    if (!pedido || this.rechazoCtrl.invalid) {
      this.rechazoCtrl.markAsTouched();
      return;
    }
    this.pedidoService.rechazar(pedido.id, this.rechazoCtrl.value).subscribe({
      next: () => {
        this.rechazando.set(null);
        this.messages.add({ severity: 'success', summary: 'Pedido rechazado' });
        this.load();
        this.viendo.set(null);
      },
      error: (err) => this.showError(err),
    });
  }

  protected exportar(pedido: Pedido): void {
    this.pedidoService.exportarPresupuesto(pedido.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presupuesto-${pedido.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.showError(err),
    });
  }

  protected recalcular(): void {
    const lineas = this.items.controls.map((ctrl): LineaCalculada | null => {
      const { articuloId, cantidad, descuentoPorcentaje } = ctrl.getRawValue();

      const articulo = this.articulos().find((a) => a.id === articuloId);

      if (!articulo || cantidad < 1) {
        return null;
      }

      const args = {
        articuloId: articulo.id,
        nombre: articulo.nombre,
        cantidad,
        precioVenta: articulo.precio,
        descuentoPorcentaje: descuentoPorcentaje ?? 0,
        alicuotaIvaPorcentaje: articulo.alicuotaIva?.porcentaje ?? 0,
      };

      const importeBruto = args.precioVenta * args.cantidad;
      const importeDescuento =
        importeBruto * (args.descuentoPorcentaje / 100);
      const importeNeto = importeBruto - importeDescuento;
      const importeIva =
        importeNeto * (args.alicuotaIvaPorcentaje / 100);
      const importeFinal = importeNeto + importeIva;

      return {
        ...args,
        importeBruto,
        importeDescuento,
        importeNeto,
        importeIva,
        importeFinal,
      };
    });

    this.lineasCalculadas.set(lineas);
  }

  protected lineaCalculada(i: number): LineaCalculada | null {
    return this.lineasCalculadas()[i] ?? null;
  }

  protected totalEstimado(): number {
    return this.lineasCalculadas().reduce(
      (total, linea) => total + (linea?.importeFinal ?? 0),
      0,
    );
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