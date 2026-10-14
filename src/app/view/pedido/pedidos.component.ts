import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { CurrencyPipe } from '@angular/common';
import {
  Pedido, ItemPedido, PedidoService, estadoActual, puedeCancelar, puedeConfirmar, puedeEditar,
} from '../../services/pedido.service';
import { permissionsFor } from '../../helpers/permission-for';

@Component({
  selector: 'app-pedidos',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, CurrencyPipe,
    SelectModule, InputNumberModule, TagModule, ToastModule, ConfirmDialogModule,
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

  protected readonly permisoPedido = permissionsFor('pedido');

  protected readonly form = this.fb.nonNullable.group({
  clienteId: [null as number | null, Validators.required],
  items: this.fb.array([] as FormGroup[]),
});

  protected get items(): FormArray<FormGroup> {
  return this.form.controls.items as FormArray<FormGroup>;
}

  ngOnInit(): void {
    this.load();
    this.clienteService.list().subscribe({
      next: (data) => this.clientesActivos.set(data.filter((c) => c.activo)),
      error: (err) => this.showError(err),
    });
    this.articuloService.list().subscribe({
      next: (data) => this.articulos.set(data),
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.pedidoService.list().subscribe({
      next: (data) => {
        this.pedidos.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err);
      },
    });
  }

  private nuevoItemGroup(articuloId: number | null = null, cantidad = 1) {
    return this.fb.nonNullable.group({
      articuloId: [articuloId as number | null, Validators.required],
      cantidad: [cantidad, [Validators.required, Validators.min(1)]],
    });
  }

  protected agregarItem(): void {
    this.items.push(this.nuevoItemGroup());
  }

  protected quitarItem(i: number): void {
    this.items.removeAt(i);
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
    pedido.articulos.forEach((d) => this.items.push(this.nuevoItemGroup(d.articuloId, d.cantidad)));
    this.dialogVisible.set(true);
  }

  // Preview del total en el diálogo; el importe real lo calcula y devuelve el backend
  protected totalEstimado(): number {
    return this.items.controls.reduce((acc, ctrl) => {
      const { articuloId, cantidad } = ctrl.value;
      const art = this.articulos().find((a) => a.id === articuloId);
      return acc + (art ? art.precio * cantidad : 0);
    }, 0);
  }

  protected save(): void {
  if (this.form.invalid || this.items.length === 0) {
    this.form.markAllAsTouched();
    return;
  }

      const { clienteId, items } = this.form.getRawValue();
  const itemsValidos: ItemPedido[] = items.flatMap(({ articuloId, cantidad }) =>
    articuloId === null ? [] : [{ articuloId, cantidad }],
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

    req$.subscribe({
      next: ({ avisos }) => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: avisos.length ? 'warn' : 'success',
          summary: current ? 'Pedido actualizado' : 'Pedido creado',
          detail: avisos.length ? avisos.join(' · ') : undefined,
          sticky: avisos.length > 0,
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err);
      },
    });
  }

  protected confirmarPedido(pedido: Pedido): void {
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
          },
          error: (err) => this.showError(err),
        }),
    });
  }

  protected cancelarPedido(pedido: Pedido): void {
    this.confirmation.confirm({
      header: 'Cancelar pedido',
      message: `¿Cancelar el pedido #${pedido.id}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cancelar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.pedidoService.cancelar(pedido.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Pedido cancelado' });
            this.load();
          },
          error: (err) => this.showError(err),
        }),
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