// src/lib/api.ts
// Servicio central de la API .NET. El polling sigue en hooks/useJobPolling.ts;
// aqui va la creacion de jobs (POST) y la base URL compartida.

import axios from 'axios';
import type { Job } from '../types/job';

const API_URL = ''; 

// Slugs de metodo. AJUSTA estos valores si tu dispatcher en el worker Python
// o tu API .NET esperan otros strings (ej. "NewtonRaphson").
export type MetodoSlug =
  | 'newton-raphson'
  | 'secante'
  | 'muller'
  | 'gauss'
  | 'gauss-seidel'
  | 'gauss-jordan';

export interface CreateJobPayload {
  metodo: MetodoSlug;
  // Los parametros varian por metodo (funcion, x0, x1, x2, tolerancia,
  // maxIteraciones, matriz, etc.). Se serializan a JSON antes de enviar.
  parametros: Record<string, unknown>;
}

/**
 * Crea un job nuevo. La API responde con el job en estado PENDING y su id,
 * que luego se usa con useJobPolling(id).
 *
 * El DTO en .NET es: CreateJobRequest(string Metodo, JsonElement? Parametros).
 * Como `Parametros` es un JsonElement, enviamos el OBJETO directamente
 * (NO un string). .NET lo recibe como JSON, lo guarda, y Python lo lee como dict.
 */
export async function createJob(payload: CreateJobPayload): Promise<Job> {
  const res = await axios.post<Job>(`${API_URL}/api/jobs`, {
    metodo: payload.metodo,
    parametros: payload.parametros, // objeto crudo, sin stringify
  });
  return res.data;
}

/** Lista de jobs (para el Historial). Filtros opcionales. */
export async function listJobs(params?: {
  status?: string;
  method?: string;
}): Promise<Job[]> {
  const res = await axios.get<Job[]>(`${API_URL}/api/jobs`, { params });
  return res.data;
}