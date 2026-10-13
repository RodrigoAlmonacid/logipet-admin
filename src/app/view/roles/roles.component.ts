import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Permiso, PermisoService } from '../../services/permiso.service';
import { Rol, RolService } from '../../services/rol.service';

@Component({
  selector: 'app-roles',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    MultiSelectModule, TagModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './roles.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly rolService = inject(RolService);
  private readonly permisoService = inject(PermisoService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly roles = signal<Rol[]>([]);
  protected readonly permisosDisponibles = signal<Permiso[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Rol | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    permisoIds: [[] as number[]],
  });

  ngOnInit(): void {
    this.load();
    this.permisoService.list().subscribe({
      next: (permisos) => this.permisosDisponibles.set(permisos),
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.rolService.list().subscribe({
      next: (data) => {
        this.roles.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err);
      },
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ nombre: '', descripcion: '', permisoIds: [] });
    this.dialogVisible.set(true);
  }

  protected openEdit(rol: Rol): void {
    this.editing.set(rol);
    this.form.reset({
      nombre: rol.nombre,
      descripcion: rol.descripcion ?? '',
      permisoIds: rol.permisos.map((p) => p.id),
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, descripcion, permisoIds } = this.form.getRawValue();
    const current = this.editing();
    this.saving.set(true);

    if (current) {
      this.rolService.update(current.id, { nombre, descripcion, permisoIds }).subscribe({
        next: () => {
          this.afterSave();
          this.messages.add({ severity: 'success', summary: 'Rol actualizado' });
        },
        error: (err) => {
          this.saving.set(false);
          this.showError(err);
        },
      });
    } else {
      this.rolService.create({ nombre, descripcion, permisoIds }).subscribe({
        next: () => {
          this.afterSave();
          this.messages.add({ severity: 'success', summary: 'Rol creado' });
        },
        error: (err) => {
          this.saving.set(false);
          this.showError(err);
        },
      });
    }
  }

  protected confirmRemove(rol: Rol): void {
    this.confirmation.confirm({
      header: 'Eliminar rol',
      message: `¿Eliminar el rol "${rol.nombre}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.rolService.remove(rol.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Rol eliminado' });
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