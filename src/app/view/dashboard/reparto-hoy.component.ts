import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../services/auth.service';
import { ItemMiReparto, PlanRutaService } from '../../services/plan-ruta.service';
import { formatTime } from '../../helpers/plan-ruta-ui';

// ============================================================
// "Tus pedidos en reparto hoy" — para el vendedor.
// Solo aparece si hay algo para mostrar: pedidos PROPIOS que salieron a reparto (o que hoy
// no se pudieron entregar). Sin mapa ni importes: a quién se visita, cuándo y cómo viene.
// ============================================================

const ETIQUETA: Record<string, { label: string; severity: 'info' | 'success' | 'warn' | 'secondary' }> = {
  en_ruta: { label: 'En camino', severity: 'info' },
  entregado: { label: 'Entregado', severity: 'success' },
  no_entregado: { label: 'No se pudo entregar', severity: 'warn' },
};

@Component({
  selector: 'app-reparto-hoy',
  imports: [CardModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
      <p-card styleClass="mb-4">
        <ng-template #title><i class="pi pi-truck mr-2"></i>Tus pedidos en reparto hoy</ng-template>
        <div class="flex flex-column gap-3">
          @for (i of items(); track i.pedidoId) {
            <div class="flex align-items-start justify-content-between gap-2 flex-wrap">
              <div>
                <div class="font-semibold">{{ i.comercio.nombre }}</div>
                <small class="text-color-secondary">
                  {{ i.cliente.nombre }} {{ i.cliente.apellido }} · {{ i.comercio.direccion }} · Pedido #{{ i.pedidoId }}
                </small>
              </div>
              <div class="text-right">
                <p-tag [value]="etiqueta(i).label" [severity]="etiqueta(i).severity" />
                @if (i.estado === 'en_ruta' && i.llegadaEstimada) {
                  <div class="text-sm text-color-secondary mt-1">Llega ~{{ hora(i.llegadaEstimada) }} hs</div>
                }
                @if (i.estado === 'no_entregado') {
                  <div class="text-sm text-color-secondary mt-1">Vuelve a la cola de ruteo</div>
                }
              </div>
            </div>
          }
        </div>
      </p-card>
    }
  `,
})
export class RepartoHoyComponent implements OnInit {
  private readonly planRuta = inject(PlanRutaService);
  private readonly auth = inject(AuthService);

  protected readonly items = signal<ItemMiReparto[]>([]);

  ngOnInit(): void {
    // Los roles sin pedido:view (admin, depósito, chofer…) no tienen "pedidos propios": ni se consulta.
    if (!this.auth.can('pedido:view')) return;
    this.planRuta.miReparto().subscribe({
      next: (data) => this.items.set(data),
      error: () => this.items.set([]), // es informativo: si falla, la tarjeta simplemente no aparece
    });
  }

  protected etiqueta(i: ItemMiReparto) {
    return ETIQUETA[i.estado] ?? { label: i.estado, severity: 'secondary' as const };
  }
  protected hora(iso: string) {
    return formatTime(iso);
  }
}
