import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';
import { permissionsFor } from '../../helpers/permission-for';
import { CONDICIONES_IVA, Cliente, ClienteService, CondicionIva } from '../../services/cliente.service';
import { Comercio, ComercioService } from '../../services/comercio.service';
import {
  ComercioCamposComponent, comercioDatos, crearComercioGroup,
} from '../../shared/components/comercio-campos/comercio-campos.component';
import { ComercioDialogComponent } from '../../shared/components/comercio-campos/comercio-dialog.component';

@Component({
  selector: 'app-clientes',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule, SelectModule,
    CheckboxModule, TagModule, ToastModule, ConfirmDialogModule, TooltipModule,
    ComercioCamposComponent, ComercioDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clientes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clienteService = inject(ClienteService);
  private readonly comercioService = inject(ComercioService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly condicionesIva = CONDICIONES_IVA;

  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Cliente | null>(null);

  protected readonly permisoCliente = permissionsFor('cliente');
  protected readonly permisoComercio = permissionsFor('comercio');

  // datos fiscales del cliente
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    cuit: ['', Validators.required],
    condicionIva: ['CONSUMIDOR_FINAL' as CondicionIva, Validators.required],
    telefono: ['', Validators.required],
    activo: [true],
  });

  // primer comercio: solo se usa en el alta
  protected readonly comercioInicial = crearComercioGroup(this.fb);

  // gestión de comercios de un cliente
  protected readonly clienteComercios = signal<Cliente | null>(null);
  protected readonly comercios = signal<Comercio[]>([]);
  protected readonly comercioDialog = signal(false);
  protected readonly comercioEditando = signal<Comercio | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected etiquetaCondicionIva(valor: CondicionIva): string {
    return this.condicionesIva.find((c) => c.value === valor)?.label ?? valor;
  }

  protected load(): void {
    this.loading.set(true);
    this.clienteService.list().subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err);
      },
    });
  }

  protected openCreate(): void {
    if (!this.permisoCliente.canCreate()) return;
    this.editing.set(null);
    this.form.reset();           // vuelve a los valores iniciales (CONSUMIDOR_FINAL, activo)
    this.comercioInicial.reset();
    this.dialogVisible.set(true);
  }

  protected openEdit(cliente: Cliente): void {
    if (!this.permisoCliente.canUpdate()) return;
    this.editing.set(cliente);
    this.form.reset({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email,
      cuit: cliente.cuit,
      condicionIva: cliente.condicionIva ?? 'CONSUMIDOR_FINAL',
      telefono: cliente.telefono,
      activo: cliente.activo,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    const current = this.editing();
    if (!(current ? this.permisoCliente.canUpdate() : this.permisoCliente.canCreate())) return;

    if (this.form.invalid || (!current && this.comercioInicial.invalid)) {
      this.form.markAllAsTouched();
      this.comercioInicial.markAllAsTouched();
      return;
    }

    const { nombre, apellido, email, cuit, condicionIva, telefono, activo } = this.form.getRawValue();
    this.saving.set(true);

    const req$ = current
      ? this.clienteService.update(current.id, { nombre, apellido, email, cuit, condicionIva, telefono, activo })
      : this.clienteService.create({
          nombre, apellido, email, cuit, condicionIva, telefono,
          comercio: comercioDatos(this.comercioInicial),
        });

    req$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dialogVisible.set(false);
        this.load();
        this.messages.add({
          severity: 'success',
          summary: current ? 'Cliente actualizado' : 'Cliente creado',
          detail: current ? undefined : 'Se crea inactivo: editalo para activarlo.',
        });
      },
      error: (err) => this.showError(err),
    });
  }

  protected confirmRemove(cli: Cliente): void {
    if (!this.permisoCliente.canDelete()) return;
    this.confirmation.confirm({
      header: 'Dar de baja',
      message: `¿Dar de baja a ${cli.nombre} ${cli.apellido}? No podrá comprar hasta que lo reactives.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.clienteService.remove(cli.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Cliente dado de baja' });
            this.load();
          },
          error: (err) => this.showError(err),
        }),
    });
  }

  // ---------- comercios del cliente ----------
  protected verComercios(cli: Cliente): void {
    this.clienteComercios.set(cli);
    this.comercios.set([]);
    this.recargarComercios();
  }

  protected nuevoComercio(): void {
    this.comercioEditando.set(null);
    this.comercioDialog.set(true);
  }

  protected editarComercio(c: Comercio): void {
    this.comercioEditando.set(c);
    this.comercioDialog.set(true);
  }

  protected recargarComercios(): void {
    const cli = this.clienteComercios();
    if (!cli) return;
    this.comercioService.list(cli.id).subscribe({
      next: (data) => this.comercios.set(data),
      error: (err) => this.showError(err),
    });
    this.load(); // actualiza el conteo de la tabla de clientes
  }

  protected bajaComercio(c: Comercio): void {
    this.confirmation.confirm({
      header: 'Dar de baja el comercio',
      message: `¿Dar de baja "${c.nombre}"? No podrá usarse en pedidos nuevos.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.comercioService.remove(c.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Comercio dado de baja' });
            this.recargarComercios();
          },
          error: (err) => this.showError(err),
        }),
    });
  }

  protected reactivarComercio(c: Comercio): void {
    this.comercioService.update(c.id, { activo: true }).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Comercio reactivado' });
        this.recargarComercios();
      },
      error: (err) => this.showError(err),
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