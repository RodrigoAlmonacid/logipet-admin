import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service';
import { Articulo, ArticuloService } from '../../services/articulo.service';
import { Marca, MarcaService } from '../../services/marca.service';
import { CurrencyPipe } from '@angular/common'

@Component({
  selector: 'app-articulos',
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    SelectModule, ToastModule, ConfirmDialogModule, FormsModule, CurrencyPipe
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './articulos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticulosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly articuloService = inject(ArticuloService);
  private readonly marcaService = inject(MarcaService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly articulos = signal<Articulo[]>([]);
  protected readonly marcas = signal<Marca[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly dialogVisible = signal(false);
  protected readonly editing = signal<Articulo | null>(null);

  // diálogo chico para dar de alta una marca sin salir del formulario de artículo
  protected readonly marcaDialogVisible = signal(false);
  protected readonly savingMarca = signal(false);
  protected nuevaMarcaNombre = '';

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    codigo: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    presentacion: ['', Validators.required],
    descripcion: ['', Validators.required],
    stock: [0, [Validators.required, Validators.min(0)]],
    marcaId: [null as number | null],
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
    this.form.reset({ nombre: '', codigo: '', precio: 0, presentacion: '', descripcion: '', stock: 0, marcaId: null });
    this.dialogVisible.set(true);
  }

  protected openEdit(articulo: Articulo): void {
    this.editing.set(articulo);
    this.form.reset({
      nombre: articulo.nombre,
      codigo: articulo.codigo,
      precio: articulo.precio,
      presentacion: articulo.presentacion,
      descripcion: articulo.descripcion,
      stock: articulo.stock,
      marcaId: articulo.marca?.id ?? null,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, codigo, precio, presentacion, descripcion, stock, marcaId } = this.form.getRawValue();
    const current = this.editing();
    this.saving.set(true);

    if (current) {
      this.articuloService
        .update(current.id, { nombre, codigo, precio, presentacion, descripcion, stock, marcaId })
        .subscribe({
          next: () => {
            this.afterSave();
            this.messages.add({ severity: 'success', summary: 'Artículo actualizado' });
          },
          error: (err) => {
            this.saving.set(false);
            this.showError(err);
          },
        });
    } else {
      this.articuloService.create({ nombre, codigo, precio, presentacion, descripcion, stock, marcaId }).subscribe({
        next: () => {
          this.afterSave();
          this.messages.add({ severity: 'success', summary: 'Artículo creado' });
        },
        error: (err) => {
          this.saving.set(false);
          this.showError(err);
        },
      });
    }
  }

  // --- Alta rápida de marca, sin salir del formulario de artículo ---

  protected abrirNuevaMarca(): void {
    this.nuevaMarcaNombre = '';
    this.marcaDialogVisible.set(true);
  }

  protected guardarNuevaMarca(): void {
    const nombre = this.nuevaMarcaNombre.trim();
    if (!nombre) {
      return;
    }
    this.savingMarca.set(true);

    this.marcaService.create({ nombre }).subscribe({
      next: (response) => {
        const marca = response.marca;
        this.marcas.update((actuales) => [...actuales, marca]);
        this.form.controls.marcaId.setValue(marca.id);
        this.savingMarca.set(false);
        this.marcaDialogVisible.set(false);
      },
      error: (err) => {
        this.savingMarca.set(false);
        this.showError(err);
      },
    });
  }

  protected confirmRemove(art: Articulo): void {
    this.confirmation.confirm({
      header: 'Dar de baja',
      message: `¿Dar de baja a ${art.nombre}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.articuloService.remove(art.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Artículo dado de baja' });
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