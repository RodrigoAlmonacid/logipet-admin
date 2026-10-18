import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { AlicuotaIvaService, AlicuotaIva } from '../../services/alicuotaIva.service';
import { permissionsFor } from '../../helpers/permission-for';

@Component({
  selector: 'app-articulos',
  imports: [
    ReactiveFormsModule, FormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, SelectModule, TextareaModule,
    ToastModule, ConfirmDialogModule, CurrencyPipe,
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
  private readonly alicuotaIvaService = inject(AlicuotaIvaService);

  protected readonly alicuotasIva = signal<AlicuotaIva[]>([]);
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
  protected readonly permisoMarca = permissionsFor('marca');
  protected readonly permisoArticulo = permissionsFor('articulo');


  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    presentacion: ['', Validators.required],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    marcaId: [null as number | null],
    alicuotaIvaId: [null as number | null],
  });

  ngOnInit(): void {
    this.load();

    if (this.permisoMarca.canView()) {
      this.marcaService.list().subscribe({
        next: (data) => this.marcas.set(data),
        error: (err) => this.showError(err),
      });
    }

    this.alicuotaIvaService.list().subscribe({
      next: (data) => this.alicuotasIva.set(data),
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
    if (!this.permisoArticulo.canCreate()) return;
    this.editing.set(null);
    this.form.reset({
      codigo: '', nombre: '', presentacion: '', descripcion: '',
      precio: 0, stock: 0, marcaId: null, alicuotaIvaId: null
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(art: Articulo): void {
    if (!this.permisoArticulo.canUpdate()) return;
    this.editing.set(art);
    this.form.reset({
      codigo: art.codigo,
      nombre: art.nombre,
      presentacion: art.presentacion,
      descripcion: art.descripcion ?? '',
      precio: art.precio,
      stock: art.stock,
      marcaId: art.marcaId,
      alicuotaIvaId: art.alicuotaIvaId ?? null,
    });
    this.dialogVisible.set(true);
  }

  protected save(): void {

    const allowed = this.editing()
      ? this.permisoArticulo.canUpdate()
      : this.permisoArticulo.canCreate();
    if (!allowed) return;
    
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

  // --- Alta rápida de marca, sin salir del formulario de artículo ---

  protected abrirNuevaMarca(): void {
    if (!this.permisoMarca.canCreate()) return;
    this.nuevaMarcaNombre = '';
    this.marcaDialogVisible.set(true);
  }

  protected guardarNuevaMarca(): void {
    if (!this.permisoMarca.canCreate()) return;
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
    if (!this.permisoArticulo.canDelete()) return;
    this.confirmation.confirm({
      header: 'Dar de baja',
      message: `¿Dar de baja "${art.nombre}" (${art.codigo})?`,
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

  private showError(err: HttpErrorResponse): void {
    const m = err.error?.message;
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.'),
    });
  }
}