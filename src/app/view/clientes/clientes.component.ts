import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service';
import { DireccionSeleccionada, MapaDireccionComponent } from '../../shared/components/mapa/mapa-direccion.component';
import { CONDICIONES_IVA, Cliente, ClienteService, CondicionIva } from '../../services/cliente.service';
import { SelectModule } from 'primeng/select';
import { permissionsFor } from '../../helpers/permission-for';

@Component({
  selector: 'app-clientes',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule, SelectModule,
    MultiSelectModule, CheckboxModule, TagModule, ToastModule, ConfirmDialogModule, MapaDireccionComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './clientes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clienteService = inject(ClienteService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly condicionesIva = CONDICIONES_IVA;

  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Cliente | null>(null);
  protected readonly currentUserId = this.auth.currentUser()?.id;

  protected readonly permisoCliente = permissionsFor('cliente');

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    comercio: ['', Validators.required],
    cuit: ['', Validators.required],
    condicionIva: ['CONSUMIDOR_FINAL' as CondicionIva, Validators.required],
    telefono: ['', Validators.required],
    horaAbreMat: ['', Validators.required],
    horaCierreMat: ['', Validators.required],
    horaAbreVesp: ['', Validators.required],
    horaCierreVesp: ['', Validators.required],
    direccion: ['', Validators.required],
    latitud: [0, Validators.required],
    longitud: [0, Validators.required],
    activo: [true],
  });

  protected onDireccionConfirmada(d: DireccionSeleccionada): void {
    this.form.patchValue({
      direccion: d.direccion,
      latitud: d.latitud,
      longitud: d.longitud,
    });
  }

  protected etiquetaCondicionIva(valor: CondicionIva): string {
    return this.condicionesIva.find((c) => c.value === valor)?.label ?? valor;
  }

  ngOnInit(): void {
    this.load();
    this.clienteService.list().subscribe({
      next: (clientes) => this.clientes.set(clientes),
      error: (err) => this.showError(err),
    });
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
    this.form.reset({ nombre: '', apellido: '', email: '', comercio: '', telefono: '', cuit: '', horaAbreMat: '', horaCierreMat: '', horaAbreVesp: '', horaCierreVesp: '', direccion: '', latitud: 0, longitud: 0, activo: true });
    this.dialogVisible.set(true);
  }

  protected openEdit(cliente: Cliente): void {
    if (!this.permisoCliente.canUpdate()) return;
    this.editing.set(cliente);
    this.form.reset({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email,
      comercio: cliente.comercio,
      cuit: cliente.cuit,
      telefono: cliente.telefono,
      horaAbreMat: cliente.horaAbreMat,
      horaCierreMat: cliente.horaCierreMat,
      horaAbreVesp: cliente.horaAbreVesp,
      horaCierreVesp: cliente.horaCierreVesp,
      direccion: cliente.direccion,
      latitud: cliente.latitud,
      longitud: cliente.longitud,
      activo: cliente.activo,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {

    const allowed = this.editing()
      ? this.permisoCliente.canUpdate()
      : this.permisoCliente.canCreate();
    if (!allowed) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, apellido, email, comercio, telefono, cuit, horaAbreMat, horaCierreMat, horaAbreVesp, horaCierreVesp, direccion, latitud, longitud } = this.form.getRawValue();
    const current = this.editing();
    this.saving.set(true);

    if (current) {
      this.clienteService
        .update(current.id, { nombre, apellido, email, comercio, telefono, cuit, horaAbreMat, horaCierreMat, horaAbreVesp, horaCierreVesp, direccion, latitud, longitud })
        .subscribe({
          next: () => {
            this.afterSave();
            this.messages.add({ severity: 'success', summary: 'Cliente actualizado' });
          },
          error: (err) => {
            this.saving.set(false);
            this.showError(err);
          },
        });
    } else {
      this.clienteService.create({ nombre, apellido, email, comercio, telefono, cuit, condicionIva: CONDICIONES_IVA[0].value, horaAbreMat, horaCierreMat, horaAbreVesp, horaCierreVesp, direccion, latitud, longitud }).subscribe({
        next: (res) => {
          this.afterSave();
          this.messages.add({
            severity: 'success',
            summary: 'Cliente creado',
            sticky: true,
          });
        },
        error: (err) => {
          this.saving.set(false);
          this.showError(err);
        },
      });
    }
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

  private afterSave(): void {
    this.saving.set(false);
    this.dialogVisible.set(false);
    this.load();
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