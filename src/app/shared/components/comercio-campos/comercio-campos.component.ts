import { Component, input, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Comercio, ComercioDatos } from '../../../services/comercio.service';
import { DireccionSeleccionada, MapaDireccionComponent } from '../mapa/mapa-direccion.component';

export function crearComercioGroup(fb: FormBuilder) {
  return fb.nonNullable.group({
    nombre: ['', Validators.required],
    telefono: [''],
    horaAbreMat: ['', Validators.required],
    horaCierreMat: ['', Validators.required],
    horaAbreVesp: ['', Validators.required],
    horaCierreVesp: ['', Validators.required],
    direccion: ['', Validators.required],
    latitud: [0, Validators.required],
    longitud: [0, Validators.required],
  });
}
export type ComercioGroup = ReturnType<typeof crearComercioGroup>;

export function valoresDeComercio(c: Comercio) {
  return {
    nombre: c.nombre,
    telefono: c.telefono ?? '',
    horaAbreMat: c.horaAbreMat,
    horaCierreMat: c.horaCierreMat,
    horaAbreVesp: c.horaAbreVesp,
    horaCierreVesp: c.horaCierreVesp,
    direccion: c.direccion,
    latitud: c.latitud,
    longitud: c.longitud,
  };
}

export function comercioDatos(g: ComercioGroup): ComercioDatos {
  const { telefono, ...resto } = g.getRawValue();
  return { ...resto, telefono: telefono.trim() || undefined };
}

let siguiente = 0;

@Component({
  selector: 'app-comercio-campos',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MapaDireccionComponent],
  templateUrl: './comercio-campos.component.html',
})
export class ComercioCamposComponent {
  readonly group = input.required<ComercioGroup>();
  private readonly mapa = viewChild.required(MapaDireccionComponent);
  protected readonly uid = `com${++siguiente}`; // ids únicos si hay más de una instancia

  protected readonly horarios = [
    { key: 'horaAbreMat', label: 'Apertura mañana' },
    { key: 'horaCierreMat', label: 'Cierre mañana' },
    { key: 'horaAbreVesp', label: 'Apertura tarde' },
    { key: 'horaCierreVesp', label: 'Cierre tarde' },
  ] as const;

  protected abrirMapa(): void {
    const { latitud, longitud, direccion } = this.group().getRawValue();
    const hayPunto = latitud !== 0 || longitud !== 0; // 0,0 = todavía sin ubicar
    this.mapa().abrir(hayPunto ? { latitud, longitud, direccion } : undefined);
  }

  protected onDireccionConfirmada(d: DireccionSeleccionada): void {
    const g = this.group();
    g.patchValue({ direccion: d.direccion, latitud: d.latitud, longitud: d.longitud });
    g.controls.direccion.markAsTouched();
  }
}