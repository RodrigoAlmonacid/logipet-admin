import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent } from 'rxjs';
import { SpinnerComponent } from './shared/components/spinner/spinner.component';
import { PrimeNG } from 'primeng/config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SpinnerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly title = signal('logipet-admin');
  private readonly sw = inject(SwUpdate);
  
  private readonly primeConfig = inject(PrimeNG);

  constructor() {
    this.primeConfig.setTranslation({
      startsWith: 'Comienza con',
      contains: 'Contiene',
      notContains: 'No contiene',
      endsWith: 'Termina con',
      equals: 'Igual a',
      notEquals: 'Diferente a',
      noFilter: 'Sin filtro',
      lt: 'Menor que',
      lte: 'Menor o igual a',
      gt: 'Mayor que',
      gte: 'Mayor o igual a',
      is: 'Es',
      isNot: 'No es',
      before: 'Antes',
      after: 'Después',
      clear: 'Limpiar',
      apply: 'Aplicar',
      matchAll: 'Coincidir todo',
      matchAny: 'Coincidir cualquiera',
      addRule: 'Agregar regla',
      removeRule: 'Eliminar regla',
      emptyMessage: 'No se encontraron resultados',
      emptyFilterMessage: 'No se encontraron opciones'
    });

    if (!this.sw.isEnabled) return; 

    this.sw.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (confirm('Hay una versión nueva de LogiPet. ¿Actualizar ahora?')) location.reload();
      });

    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sw.checkForUpdate().catch(() => {}));
  }
}