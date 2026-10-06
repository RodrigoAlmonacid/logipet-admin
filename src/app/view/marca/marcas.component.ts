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
import { Marca, MarcaService } from '../../services/marca.service';

@Component({
  selector: 'app-marcas',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    MultiSelectModule, CheckboxModule, TagModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './marcas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarcasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly marcaService = inject(MarcaService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly marcas = signal<Marca[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Marca | null>(null);
  protected readonly currentUserId = this.auth.currentUser()?.id;

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
    this.marcaService.list().subscribe({
      next: (marcas) => this.marcas.set(marcas),
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.marcaService.list().subscribe({
      next: (data) => {
        this.marcas.set(data);
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
    this.form.reset({ nombre: '' });
    this.dialogVisible.set(true);
  }

  protected openEdit(marca: Marca): void {
    this.editing.set(marca);
    this.form.reset({
      nombre: marca.nombre,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre } = this.form.getRawValue();
    const current = this.editing();
    this.saving.set(true);

    if (current) {
      this.marcaService
        .update(current.id, { nombre })
        .subscribe({
          next: () => {
            this.afterSave();
            this.messages.add({ severity: 'success', summary: 'Marca actualizada' });
          },
          error: (err) => {
            this.saving.set(false);
            this.showError(err);
          },
        });
    } else {
      this.marcaService.create({ nombre }).subscribe({
        next: (res) => {
          this.afterSave();
          this.messages.add({
            severity: 'success',
            summary: 'Marca creada',
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

  protected confirmRemove(marca: Marca): void {
    this.confirmation.confirm({
      header: 'Dar de baja',
      message: `¿Dar de baja a ${marca.nombre}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.marcaService.remove(marca.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Marca dada de baja' });
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