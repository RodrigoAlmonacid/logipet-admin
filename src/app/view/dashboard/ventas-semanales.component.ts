import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../services/auth.service';
import { DashboardService, DesgloseVentas, MetricaVentas, VentasSemanales } from '../../services/dashboard.service';

// ============================================================
// Ventas por semana (línea de tiempo).
//   Eje X: semanas (lunes a domingo, según la fecha de ENTREGA).
//   Eje Y: UNA métrica a la vez (ventas $ / pedidos / unidades) — nunca dos escalas juntas.
//   Series: sin desglose, o por marca / perros-gatos / vendedor (lo que el rol permite).
// ============================================================

const ETIQUETA_METRICA: Record<MetricaVentas, string> = {
  importe: 'Ventas ($ con IVA)',
  pedidos: 'Pedidos entregados',
  unidades: 'Unidades vendidas',
};
const ETIQUETA_DESGLOSE: Record<DesgloseVentas, string> = {
  total: 'Sin desglose',
  marca: 'Por marca',
  especie: 'Perros / Gatos',
  vendedor: 'Por vendedor',
  equipo: 'Yo vs. el equipo',
};
const PERIODOS = [
  { label: 'Últimas 12 semanas', value: 12 },
  { label: 'Últimas 26 semanas', value: 26 },
  { label: 'Último año', value: 52 },
  { label: 'Últimos 2 años', value: 104 },
];

// Paleta categórica validada (orden fijo, nunca cíclica). El color sigue a la entidad cuando existe una fija.
const SLOTS = ['#0EA5E9', '#F0B06B', '#10B981', '#eda100', '#FF69B4'];
const GRIS = '#9a9a96';
const COLOR_FIJO: Record<string, string> = {
  Perros: SLOTS[0], Gatos: SLOTS[1], Otros: GRIS, Otras: GRIS, 'Sin marca': GRIS, Total: SLOTS[0],
  Yo: SLOTS[0], // en la comparación con el equipo, "yo" siempre es el azul
  'Promedio por vendedor': GRIS, 'Promedio del equipo': GRIS,
};

@Component({
  selector: 'app-ventas-semanales',
  imports: [FormsModule, ButtonModule, CardModule, ChartModule, MultiSelectModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <p-card styleClass="mb-4">
        <ng-template #title><i class="pi pi-chart-line mr-2"></i>Ventas por semana</ng-template>

        @if (datos()) {
        <div class="flex flex-wrap gap-3 mb-3 align-items-end">
          <div class="flex flex-column gap-1">
            <label class="text-sm font-medium" for="vs-metrica">Medir</label>
            <p-select inputId="vs-metrica" [options]="opcionesMetrica()" optionLabel="label" optionValue="value"
              [ngModel]="metrica()" (ngModelChange)="cambiar({ metrica: $event })" appendTo="body" />
          </div>
          <div class="flex flex-column gap-1">
            <label class="text-sm font-medium" for="vs-desglose">Desglosar</label>
            <p-select inputId="vs-desglose" [options]="opcionesDesglose()" optionLabel="label" optionValue="value"
              [ngModel]="desglose()" (ngModelChange)="cambiar({ desglose: $event })" appendTo="body" />
          </div>
          <div class="flex flex-column gap-1">
            <label class="text-sm font-medium" for="vs-periodo">Período</label>
            <p-select inputId="vs-periodo" [options]="periodos" optionLabel="label" optionValue="value"
              [ngModel]="semanas()" (ngModelChange)="cambiar({ semanas: $event })" appendTo="body" />
          </div>
          @if (datos()?.desglose === 'vendedor' && (datos()?.vendedores?.length ?? 0) > 0) {
            <div class="flex flex-column gap-1">
              <label class="text-sm font-medium" for="vs-vendedores">Vendedores a comparar</label>
              <p-multiselect inputId="vs-vendedores" [options]="datos()!.vendedores!" optionLabel="nombre" optionValue="id"
                [ngModel]="vendedoresElegidos()" (ngModelChange)="cambiar({ vendedores: $event })"
                [selectionLimit]="8" [showToggleAll]="false" display="chip" placeholder="Los 5 mejores" appendTo="body"
                styleClass="w-full md:w-20rem" />
            </div>
          }
          <p-button [label]="verTabla() ? 'Ver gráfico' : 'Ver como tabla'" [icon]="verTabla() ? 'pi pi-chart-line' : 'pi pi-table'"
            [text]="true" size="small" (onClick)="verTabla.set(!verTabla())" />
        </div>
        }

        @if (datos(); as d) {
          <div class="text-color-secondary text-sm mb-2">
            {{ d.desglose === 'equipo' ? 'Vos contra el equipo' : d.alcance === 'propios' ? 'Tus ventas' : 'Todas las ventas' }} ·
            {{ d.desglose === 'equipo' ? 'tu total' : 'total del período' }}: <strong>{{ formatear(d.totalPeriodo) }}</strong>
            @if (d.desglose === 'marca') { · se muestran las 5 principales y "Otras" }
            @if (d.desglose === 'vendedor') { · línea punteada: promedio por vendedor activo }
            @if (d.desglose === 'equipo') { · línea punteada: promedio del equipo (no se muestran otros vendedores) }
          </div>
          @if (d.totalPeriodo === 0) {
            <p class="text-center text-color-secondary p-4 m-0">No hay ventas entregadas en este período.</p>
          } @else {
            @if (verTabla()) {
              <div class="overflow-auto" style="max-height: 320px">
                <table class="w-full text-sm" style="border-collapse: collapse">
                  <thead>
                    <tr class="text-left">
                      <th class="p-2">Semana del</th>
                      @for (s of d.series; track s.nombre) { <th class="p-2 text-right">{{ s.nombre }}</th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (sem of d.semanas; track sem; let i = $index) {
                      <tr style="border-top: 1px solid var(--p-content-border-color)">
                        <td class="p-2">{{ fechaCorta(sem) }}</td>
                        @for (s of d.series; track s.nombre) { <td class="p-2 text-right">{{ formatear(s.valores[i]) }}</td> }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p-chart type="line" [data]="grafico()" [options]="opciones()" height="320px" />
            }
            <small class="text-color-secondary">
              Cada punto es una semana (lunes a domingo) según la fecha de entrega.
              @if (d.desglose === 'marca' || d.desglose === 'especie') {
                Un pedido con varias marcas o especies cuenta en cada una.
              }
            </small>
          }
        } @else if (cargando()) {
          <p class="text-center text-color-secondary p-4 m-0"><i class="pi pi-spin pi-spinner mr-2"></i>Cargando…</p>
        }
      </p-card>
    }
  `,
})
export class VentasSemanalesComponent implements OnInit {
  private readonly service = inject(DashboardService);
  private readonly auth = inject(AuthService);

  protected readonly periodos = PERIODOS;
  protected readonly datos = signal<VentasSemanales | null>(null);
  protected readonly cargando = signal(false);
  protected readonly verTabla = signal(false);
  protected readonly oculto = signal(false); // si el backend responde 403, no se muestra la tarjeta

  protected readonly semanas = signal(26);
  protected readonly metrica = signal<MetricaVentas | undefined>(undefined);
  protected readonly desglose = signal<DesgloseVentas>('total');
  /** Ids elegidos a mano por el dueño; vacío = el backend muestra los 5 mejores. */
  protected readonly vendedoresElegidos = signal<number[]>([]);

  // Alcanza con poder ver pedidos (propios o todos) o stock; el backend decide qué opciones ofrecer.
  protected readonly visible = computed(
    () => !this.oculto() && (this.auth.can('pedido:view') || this.auth.can('pedido:view_all') || this.auth.can('stock:view')),
  );

  protected readonly opcionesMetrica = computed(() =>
    (this.datos()?.opciones.metricas ?? []).map((value) => ({ value, label: ETIQUETA_METRICA[value] })),
  );
  protected readonly opcionesDesglose = computed(() =>
    (this.datos()?.opciones.desgloses ?? []).map((value) => ({ value, label: ETIQUETA_DESGLOSE[value] })),
  );

  private readonly texto = this.leerCss('--p-text-color', '#334155');
  private readonly textoSecundario = this.leerCss('--p-text-muted-color', '#64748b');
  private readonly lineas = this.leerCss('--p-content-border-color', '#e2e8f0');

  protected readonly grafico = computed(() => {
    const d = this.datos();
    if (!d) return { labels: [], datasets: [] };
    let siguiente = 0;
    return {
      labels: d.semanas.map((s) => this.corta(s)),
      datasets: d.series.map((s) => {
        const esPromedio = s.nombre.startsWith('Promedio');
        const color = COLOR_FIJO[s.nombre] ?? SLOTS[siguiente++ % SLOTS.length];
        return {
          label: s.nombre,
          data: s.valores,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          borderDash: esPromedio ? [6, 4] : [], // el promedio se distingue por el trazo, no solo por el color
          pointRadius: 0, // línea limpia; el punto aparece al pasar el mouse / tocar
          pointHoverRadius: 5,
          pointHitRadius: 12,
          tension: 0.2,
          fill: false,
        };
      }),
    };
  });

  protected readonly opciones = computed(() => {
    const d = this.datos();
    const m = d?.metrica ?? 'importe';
    const semanasISO = d?.semanas ?? [];
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        // Con una sola serie el título ya la nombra: sin leyenda. Con 2+ la leyenda es obligatoria.
        legend: { display: (d?.series.length ?? 0) > 1, position: 'bottom', labels: { usePointStyle: true, color: this.texto } },
        tooltip: {
          callbacks: {
            title: (items: { dataIndex: number }[]) => `Semana del ${this.corta(semanasISO[items[0].dataIndex] ?? '')}`,
            label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
              `${ctx.dataset.label}: ${this.formatearMetrica(ctx.parsed.y, m)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: this.textoSecundario, maxTicksLimit: 10, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          grid: { color: this.lineas },
          ticks: { color: this.textoSecundario, callback: (v: number | string) => this.formatearMetrica(Number(v), m, true) },
          title: { display: true, text: ETIQUETA_METRICA[m], color: this.textoSecundario },
        },
      },
    };
  });

  ngOnInit(): void {
    if (this.visible()) this.cargar();
  }

  protected cambiar(c: { metrica?: MetricaVentas; desglose?: DesgloseVentas; semanas?: number; vendedores?: number[] }): void {
    if (c.metrica) this.metrica.set(c.metrica);
    if (c.desglose) {
      this.desglose.set(c.desglose);
      this.vendedoresElegidos.set([]); // al cambiar de desglose se vuelve a la selección por defecto
    }
    if (c.vendedores) this.vendedoresElegidos.set(c.vendedores);
    if (c.semanas) this.semanas.set(c.semanas);
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.service.ventasSemanales({ semanas: this.semanas(), metrica: this.metrica(), desglose: this.desglose(), vendedores: this.vendedoresElegidos() }).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.metrica.set(d.metrica); // el backend resuelve el default según el rol
        this.desglose.set(d.desglose);
        if (d.desglose === 'vendedor' && d.seleccion && this.vendedoresElegidos().length === 0) this.vendedoresElegidos.set(d.seleccion);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        if (!this.datos()) this.oculto.set(true); // sin permiso o caído: no estorba al resto del dashboard
      },
    });
  }

  protected formatear(valor: number): string {
    return this.formatearMetrica(valor, this.datos()?.metrica ?? 'importe');
  }

  private formatearMetrica(v: number, m: MetricaVentas, compacto = false): string {
    if (m !== 'importe') return v.toLocaleString('es-AR');
    return compacto && v >= 1000
      ? `$ ${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: 0 })} mil`
      : v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  }

  protected fechaCorta(iso: string): string {
    return this.corta(iso);
  }

  /** "2026-11-23" -> "23/11" */
  private corta(iso: string): string {
    const [, m, d] = iso.split('-');
    return d ? `${d}/${m}` : iso;
  }

  private leerCss(variable: string, respaldo: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || respaldo;
  }
}
