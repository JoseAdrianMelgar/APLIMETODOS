// src/lib/jobUtils.ts
// Helpers compartidos por Historial y Stats para interpretar los jobs de la API.

import type { Job } from '../types/job';

export const METHOD_LABELS: Record<string, string> = {
  'newton-raphson': 'Newton',
  secante: 'Secante',
  muller: 'Müller',
  gauss: 'Gauss',
  'gauss-seidel': 'Gauss-Seidel',
  'gauss-jordan': 'Gauss-Jordan',
};

export const ALL_METHODS = Object.keys(METHOD_LABELS);

export function methodLabel(m: string): string {
  return METHOD_LABELS[m] ?? m;
}

export type StatusKind = 'done' | 'failed' | 'running' | 'pending';

export function statusKind(estado: string): StatusKind {
  const s = (estado ?? '').toLowerCase();
  if (s === 'done') return 'done';
  if (s === 'failed') return 'failed';
  if (s === 'running') return 'running';
  return 'pending';
}

export interface ParsedJob {
  iteraciones: number;
  convergio: boolean;
  resumen: string;
  mensaje?: string;
}

/** Extrae info util del job parseando `resultado` y `parametros` (ambos JSON string). */
export function parseJob(job: Job): ParsedJob {
  let iteraciones = 0;
  let convergio = job.converged ?? false;
  let resumen = '';
  let mensaje: string | undefined;

  try {
    const r = JSON.parse(job.resultado ?? '{}');
    iteraciones = r.total_iteraciones ?? (Array.isArray(r.iteraciones) ? r.iteraciones.length : 0);
    if (typeof r.convergio === 'boolean') convergio = r.convergio;
    if (typeof r.mensaje === 'string') mensaje = r.mensaje;
  } catch {
    /* resultado vacio o invalido */
  }

  try {
    const p = JSON.parse(job.parametros ?? '{}');
    if (typeof p.funcion_str === 'string') resumen = p.funcion_str;
    else if (Array.isArray(p.A)) resumen = `${p.A.length}×${p.A.length} — sistema lineal`;
  } catch {
    /* parametros vacio o invalido */
  }

  return { iteraciones, convergio, resumen, mensaje };
}

/** Formatea una fecha ISO a "YYYY-MM-DD HH:mm". */
export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}