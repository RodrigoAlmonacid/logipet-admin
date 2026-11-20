import { EstadoPlan } from '../services/plan-ruta.service';

// Colores por camión: se usan en el mapa, en la leyenda y en cada tarjeta de envío.
export const VEHICLE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];
export const colorCamion = (i: number) => VEHICLE_COLORS[i % VEHICLE_COLORS.length];

export const ESTADO_PLAN: Record<EstadoPlan, { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' }> = {
  PENDIENTE: { label: 'Sin optimizar', severity: 'warn' },
  EN_PROCESO: { label: 'Optimizando…', severity: 'info' },
  OPTIMIZADO: { label: 'Listo para despachar', severity: 'success' },
  DESPACHADO: { label: 'En reparto', severity: 'info' },
  FINALIZADO: { label: 'Finalizado', severity: 'secondary' },
  FALLIDO: { label: 'Falló la optimización', severity: 'danger' },
};

/** Paso actual del flujo: 1 crear · 2 optimizar · 3 asignar equipo · 4 en reparto · 5 terminado. */
export function pasoDelPlan(estado: EstadoPlan): number {
  switch (estado) {
    case 'OPTIMIZADO': return 3;
    case 'DESPACHADO': return 4;
    case 'FINALIZADO': return 5;
    default: return 2;
  }
}

export const PASOS_PLAN = [
  { n: 1, label: 'Crear plan', icon: 'pi-calendar-plus' },
  { n: 2, label: 'Optimizar', icon: 'pi-bolt' },
  { n: 3, label: 'Asignar equipo', icon: 'pi-users' },
  { n: 4, label: 'En reparto', icon: 'pi-truck' },
];

/** "2026-11-23" -> "lunes 23/11" (+ " · mañana" si corresponde). */
export function etiquetaFecha(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace(',', '');
  const m = new Date(Date.now() + 24 * 3600 * 1000);
  const manana = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
  return ymd === manana ? `${dia} · mañana` : dia;
}

/** Argentina es UTC-3 todo el año: así el servidor interpreta bien la fecha sin importar la zona del navegador. */
export const fechaLocalIso = (ymd: string, hhmm = '00:00') => `${ymd}T${hhmm}:00-03:00`;

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatKg(gramos: number): string {
  const kg = gramos / 1000;
  return `${kg.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;
}
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

export function mensajeError(err: { error?: { message?: string | string[] } }): string {
  const m = err.error?.message;
  return Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.');
}
