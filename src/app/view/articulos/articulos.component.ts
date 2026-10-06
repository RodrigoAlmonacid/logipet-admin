import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { Observable } from 'rxjs';
import { Articulo, ArticuloService } from '../../services/articulo.service';
import { Marca, MarcaService } from '../../services/marca.service';

@Component({
  selector: 'app-articulos',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, SelectModule, TextareaModule,
    ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './articulos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticulosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly articuloService = inject(ArticuloService);
  private readonly marcaService = inject(MarcaService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly articulos = signal<Articulo[]>([]);
  protected readonly marcas = signal<Marca[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Articulo | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    presentacion: ['', Validators.required],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    marcaId: [null as number | null],
  });

  ngOnInit(): void {
    this.load();
    this.marcaService.list().subscribe({
      next: (data) => this.marcas.set(data),
      error: (err) => this.showError(err),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.articuloService.list().subscribe({
      next: (data) => {
        this.articulos.set(data);
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
    this.form.reset({
      codigo: '',
      nombre: '',
      presentacion: '',
      descripcion: '',
      precio: 0,
      stock: 0,
      marcaId: null,
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(art: Articulo): void {
    this.editing.set(art);
    this.form.reset({
      codigo: art.codigo,
      nombre: art.nombre,
      presentacion: art.presentacion,
      descripcion: art.descripcion ?? '',
      precio: art.precio,
      stock: art.stock,
      marcaId: art.marcaId,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const dto = {
      ...v,
      descripcion: v.descripcion?.trim() ? v.descripcion : null,
    };
    const current = this.editing();
    this.saving.set(true);

    const req$: Observable<unknown> = current
      ? this.articuloService.update(current.id, dto)
      : this.articuloService.create(dto);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: current ? 'Artículo actualizado' : 'Artículo creado',
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err);
      },
    });
  }

  protected confirmRemove(art: Articulo): void {
    this.confirmation.confirm({
      header: 'Eliminar artículo',
      message: `¿Eliminar "${art.nombre}" (${art.codigo})?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.articuloService.remove(art.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Artículo eliminado' });
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