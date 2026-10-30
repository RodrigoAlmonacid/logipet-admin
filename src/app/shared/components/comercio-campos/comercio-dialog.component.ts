import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { finalize } from 'rxjs';
import { Comercio, ComercioService } from '../../../services/comercio.service';
import {
  ComercioCamposComponent, comercioDatos, crearComercioGroup, valoresDeComercio,
} from './comercio-campos.component';

@Component({
  selector: 'app-comercio-dialog',
  imports: [ReactiveFormsModule, DialogModule, ButtonModule, ComercioCamposComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comercio-dialog.component.html',
})
export class ComercioDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly comercioService = inject(ComercioService);
  private readonly messages = inject(MessageService);

  readonly visible = model(false);
  readonly clienteId = input<number | null>(null);
  readonly comercio = input<Comercio | null>(null); // null = alta
  readonly guardado = output<Comercio>();

  protected readonly group = crearComercioGroup(this.fb);
  protected readonly saving = signal(false);
  protected readonly titulo = computed(() => (this.comercio() ? 'Editar comercio' : 'Nuevo comercio'));

  constructor() {
    // al abrir: cargar los datos del comercio (o limpiar el formulario)
    effect(() => {
      if (!this.visible()) return;
      const c = this.comercio();
      untracked(() => (c ? this.group.reset(valoresDeComercio(c)) : this.group.reset()));
    });
  }

  protected guardar(): void {
    if (this.group.invalid) {
      this.group.markAllAsTouched();
      return;
    }
    const actual = this.comercio();
    const clienteId = this.clienteId();
    if (!actual && clienteId === null) return;

    const datos = comercioDatos(this.group);
    const req$ = actual
      ? this.comercioService.update(actual.id, datos)
      : this.comercioService.create({ ...datos, clienteId: clienteId! });

    this.saving.set(true);
    req$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (c) => {
        this.visible.set(false);
        this.messages.add({ severity: 'success', summary: actual ? 'Comercio actualizado' : 'Comercio creado' });
        this.guardado.emit(c);
      },
      error: (err: HttpErrorResponse) => {
        const m = err.error?.message;
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.'),
        });
      },
    });
  }
}