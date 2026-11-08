import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service'; // ajustá la ruta a tu AuthService
import { AnalisisReposicion, ItemReposicion, ReabastecimientoService, ResumenReposicion, Urgencia } from '../../services/reabastecimiento.service';

type Filtro = 'todos' | 'accion' | 'altaDemanda';

@Component({
  selector: 'app-reabastecimiento',
  imports: [DecimalPipe, FormsModule, ButtonModule, CardModule, SelectButtonModule, TableModule, TagModule, ToastModule],
  providers: [MessageService],
  templateUrl: './reabastecimiento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReabastecimientoComponent implements OnInit {
  private readonly service = inject(ReabastecimientoService);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);

  protected readonly puedeAnalizar = computed(() => this.auth.can('stock:analyze'));
  protected readonly analisis = signal<AnalisisReposicion | null>(null);
  protected readonly analizando = signal(false);

  protected readonly resumen = signal<ResumenReposicion | null>(null);
  protected readonly loading = signal(false);
  protected readonly filtro = signal<Filtro>('accion');

  protected readonly opcionesFiltro = [
    { label: 'Requieren acción', value: 'accion' },
    { label: 'Alta demanda (A)', value: 'altaDemanda' },
    { label: 'Todos', value: 'todos' },
  ];

  protected readonly items = computed<ItemReposicion[]>(() => {
    const todos = this.resumen()?.items ?? [];
    switch (this.filtro()) {
      case 'accion': return todos.filter((i) => i.urgencia === 'critico' || i.urgencia === 'urgente');
      case 'altaDemanda': return todos.filter((i) => i.abc === 'A');
      default: return todos;
    }
  });

  protected readonly cantidadCriticos = computed(
    () => this.resumen()?.items.filter((i) => i.urgencia === 'critico').length ?? 0,
  );

  protected severidad(u: Urgencia): 'danger' | 'warn' | 'success' | 'secondary' {
    return { critico: 'danger', urgente: 'warn', ok: 'success', sin_ventas: 'secondary' }[u] as never;
  }
  protected etiqueta(u: Urgencia): string {
    return { critico: 'Crítico', urgente: 'Urgente', ok: 'Ok', sin_ventas: 'Sin ventas' }[u];
  }

  analizar(): void {
    this.analizando.set(true);
    this.service.analisis().subscribe({
      next: (a) => { this.analisis.set(a); this.analizando.set(false); },
      error: (err: HttpErrorResponse) => { this.analizando.set(false); this.mostrarError(err); },
    });
  }

  protected severidadPrioridad(p: 'alta' | 'media' | 'baja'): 'danger' | 'warn' | 'secondary' {
    return { alta: 'danger', media: 'warn', baja: 'secondary' }[p] as never;
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.service.resumen().subscribe({
      next: (r) => { this.resumen.set(r); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.mostrarError(err); },
    });
  }

  private mostrarError(err: HttpErrorResponse): void {
    const m = err.error?.message;
    this.messages.add({ severity: 'error', summary: 'Error', detail: Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.') });
  }
}
