import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { Observable } from 'rxjs';
import { Marca, MarcaService } from '../../services/marca.service';

@Component({
  selector: 'app-marcas',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './marcas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarcasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly marcaService = inject(MarcaService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly marcas = signal<Marca[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Marca | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
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
    this.form.reset({ nombre: marca.nombre });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const dto = this.form.getRawValue();
    const current = this.editing();
    this.saving.set(true);

    const req$: Observable<unknown> = current
      ? this.marcaService.update(current.id, dto)
      : this.marcaService.create(dto);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: current ? 'Marca actualizada' : 'Marca creada',
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err);
      },
    });
  }

  protected confirmRemove(marca: Marca): void {
    this.confirmation.confirm({
      header: 'Eliminar marca',
      message: `¿Eliminar la marca "${marca.nombre}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.marcaService.remove(marca.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Marca eliminada' });
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