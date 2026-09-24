import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { LogipetPreset } from './theme/logipet-preset'
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import Lara from '@primeuix/themes/lara'

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(), provideRouter(routes), provideAnimationsAsync(), providePrimeNG({
      theme: {
        preset: Lara,
        options: {
          darkModeSelector: false || '.my-app-dark' // Previene que se active el modo oscuro sin querer
        }
      }
    })],
};
