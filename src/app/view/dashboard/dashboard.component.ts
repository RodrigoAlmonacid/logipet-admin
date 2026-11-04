import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DashboardService, ResumenDashboard } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, ChartModule, CardModule, TableModule, ToastModule],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly messages = inject(MessageService);

  protected readonly resumen = signal<ResumenDashboard | null>(null);
  protected readonly loading = signal(false);

  // Los colores salen del preset de LogiPet (escala primary), con los hex como respaldo.
  private readonly paleta = this.leerPaleta();

  protected readonly dataMarcas = computed(() => {
    const marcas = this.resumen()?.ventas?.marcas ?? [];
    return {
      labels: marcas.map((m) => m.nombre),
      datasets: [
        {
          data: marcas.map((m) => m.unidades),
          backgroundColor: marcas.map((m, i) =>
            m.nombre === 'Otras' ? '#adb5bd' : this.paleta[i % this.paleta.length],
          ),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  });

  protected readonly opcionesTorta = { plugins: { legend: { position: 'right' } } };

  ngOnInit(): void {
    this.loading.set(true);
    this.dashboardService.resumen().subscribe({
      next: (data) => {
        this.resumen.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(err);
      },
    });
  }

  private leerPaleta(): string[] {
    const respaldo = ['#142438', '#2a4868', '#4a76a4', '#93afd0', '#b9cbe1'];
    const estilos = getComputedStyle(document.documentElement);
    return ['900', '700', '500', '300', '200'].map(
      (tono, i) => estilos.getPropertyValue(`--p-primary-${tono}`).trim() || respaldo[i],
    );
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