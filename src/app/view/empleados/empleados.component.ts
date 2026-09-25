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
import { Empleado, EmpleadoService, Rol } from '../../services/empleado.service';

@Component({
  selector: 'app-empleados',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    MultiSelectModule, CheckboxModule, TagModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './empleados.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmpleadosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly empleados = signal<Empleado[]>([]);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Empleado | null>(null);
  protected readonly currentUserId = this.auth.userId();

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    legajo: ['', Validators.required],
    activo: [true],
    roleIds: [[] as number[]],
  });

  ngOnInit(): void {
    this.load();
    this.empleadoService.roles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.empleadoService.list().subscribe({
      next: (data) => {
        this.empleados.set(data);
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
    this.form.reset({ nombre: '', apellido: '', email: '', legajo: '', activo: true, roleIds: [] });
    this.dialogVisible.set(true);
  }

  protected openEdit(emp: Empleado): void {
    this.editing.set(emp);
    this.form.reset({
      nombre: emp.nombre,
      apellido: emp.apellido,
      email: emp.email,
      legajo: emp.legajo,
      activo: emp.activo,
      roleIds: emp.roles.map((r) => r.id),
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, apellido, email, legajo, activo, roleIds } = this.form.getRawValue();
    const current = this.editing();
    this.saving.set(true);

    if (current) {
      this.empleadoService
        .update(current.id, { nombre, apellido, email, legajo, activo, roleIds })
        .subscribe({
          next: () => {
            this.afterSave();
            this.messages.add({ severity: 'success', summary: 'Empleado actualizado' });
          },
          error: (err) => {
            this.saving.set(false);
            this.showError(err);
          },
        });
    } else {
      this.empleadoService.create({ nombre, apellido, email, legajo }).subscribe({
        next: (res) => {
          this.afterSave();
          // Temporal, hasta que esté el envío por mail
          this.messages.add({
            severity: 'success',
            summary: 'Empleado creado',
            detail: `Contraseña provisoria: ${res.tempPassword}`,
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

  protected confirmRemove(emp: Empleado): void {
    this.confirmation.confirm({
      header: 'Dar de baja',
      message: `¿Dar de baja a ${emp.nombre} ${emp.apellido}? No podrá iniciar sesión hasta que lo reactives.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.empleadoService.remove(emp.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Empleado dado de baja' });
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