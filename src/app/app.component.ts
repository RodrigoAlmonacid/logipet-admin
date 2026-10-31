import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent } from 'rxjs';
import { SpinnerComponent } from './shared/components/spinner/spinner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SpinnerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly title = signal('logipet-admin');
  private readonly sw = inject(SwUpdate);

  constructor() {
    if (!this.sw.isEnabled) return; // en ng serve el service worker está apagado

    this.sw.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (confirm('Hay una versión nueva de LogiPet. ¿Actualizar ahora?')) location.reload();
      });

    // al volver a la app desde segundo plano, buscar actualización
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sw.checkForUpdate().catch(() => {}));
  }
}