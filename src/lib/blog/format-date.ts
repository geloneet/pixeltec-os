// Formato de fechas editoriales del blog. Sin 'use client': importable
// tanto desde Server Components como desde Client Components.
//
// La timezone editorial es FIJA: sin ella, toLocaleDateString usa la zona del
// entorno (UTC en el servidor, la del navegador en el cliente), lo que produce
// fechas distintas para el mismo instante (bug "3 vs 4 de agosto") y un
// hydration mismatch en el cliente.

export const EDITORIAL_TIME_ZONE = 'America/Mexico_City';

export function formatEditorialDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: EDITORIAL_TIME_ZONE,
  });
}
