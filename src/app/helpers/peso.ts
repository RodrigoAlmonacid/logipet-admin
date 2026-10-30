export function formatoPeso(gramos: number): string {
  return gramos >= 1000
    ? `${(gramos / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`
    : `${gramos} g`;
}