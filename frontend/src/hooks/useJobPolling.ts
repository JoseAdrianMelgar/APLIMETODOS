import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Job } from '../types/job';

const API_URL = 'http://localhost:5000';
const POLL_INTERVAL = 5000; // 5 segundos, segun la especificacion del proyecto

/**
 * Hook que pollea GET /api/jobs/{id} cada 5 segundos hasta que el job
 * llegue a un estado final (DONE o FAILED).
 *
 * Retorna:
 *   - job: el job actualizado (o null antes de la primera respuesta)
 *   - error: mensaje de error de red si lo hay
 *   - polling: true mientras se esta polleando
 */
export function useJobPolling(jobId: number | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    // Si no hay jobId, resetear todo
    if (!jobId) {
      setJob(null);
      setError(null);
      setPolling(false);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchJob = async () => {
      try {
        const response = await axios.get<Job>(`${API_URL}/api/jobs/${jobId}`);
        if (cancelled) return;

        setJob(response.data);
        setError(null);

        // Si el job termino, detener el polling
        const estado = response.data.estado.toLowerCase();
        if (estado === 'done' || estado === 'failed') {
          setPolling(false);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (e) {
        if (cancelled) return;
        const msg = axios.isAxiosError(e) ? e.message : 'Error desconocido';
        setError(msg);
      }
    };

    // Reset al cambiar de job
    setJob(null);
    setError(null);
    setPolling(true);

    // Primera consulta inmediata (sin esperar 5s)
    fetchJob();

    // Polling cada 5 segundos
    intervalId = setInterval(fetchJob, POLL_INTERVAL);

    // Cleanup al desmontar o cambiar de jobId
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId]);

  return { job, error, polling };
}