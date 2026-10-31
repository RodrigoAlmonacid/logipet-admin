import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, AfterViewInit, input, output, signal, viewChild,
} from '@angular/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-escaner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <video #video class="w-full border-round" playsinline muted></video>
    @if (error()) {
    <small class="text-red-500 block mt-2">{{ error() }}</small>
    }
  `,
})
export class EscanerComponent implements AfterViewInit, OnDestroy {
  readonly pausado = input(false);
  readonly codigo = output<string>();

  protected readonly error = signal<string | null>(null);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  private controls?: IScannerControls;
  private ultimo = '';
  private ultimoTs = 0;

  async ngAfterViewInit(): Promise<void> {
    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128,
      ]],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    try {
      this.controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } }, // cámara trasera
        this.video().nativeElement,
        (result) => {
          if (!result || this.pausado()) return;
          const texto = result.getText();
          const ahora = Date.now();
          if (texto === this.ultimo && ahora - this.ultimoTs < 1500) return; // evita lecturas repetidas
          this.ultimo = texto;
          this.ultimoTs = ahora;
          navigator.vibrate?.(80);
          this.codigo.emit(texto);
        },
      );
    } catch (e) {
      const nombre = (e as DOMException).name;
      this.error.set(
        nombre === 'NotAllowedError' ? 'Permití el acceso a la cámara para escanear.'
        : nombre === 'NotFoundError' ? 'No se encontró una cámara en este dispositivo.'
        : 'No se pudo iniciar la cámara (requiere HTTPS).',
      );
    }
  }

  ngOnDestroy(): void {
    this.controls?.stop(); // libera la cámara
  }
}