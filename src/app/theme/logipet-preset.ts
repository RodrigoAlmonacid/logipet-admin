import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Paleta de marca de LogiPet.
 *
 * Tomamos el azul marino del isotipo como color "primary": es el que va
 * a aparecer en el header, la sidebar y los botones principales. El rosa
 * del logo queda fuera de la paleta funcional a propósito -- esta es una
 * app de gestión con tablas y listados, no tiene sentido un primary rosa.
 * Si en algún momento se necesita ese rosa como acento puntual (por ej.
 * un detalle del logo o un badge chico), se puede usar el hex directo
 * (#ff6fa5 aprox.) sin agregarlo acá.
 */
export const LogipetPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eff3f8',
      100: '#dce5f0',
      200: '#b9cbe1',
      300: '#93afd0',
      400: '#6d93be',
      500: '#4a76a4',
      600: '#375d85',
      700: '#2a4868',
      800: '#1e344c',
      900: '#142438',
      950: '#0c1522',
    },
  },
});
