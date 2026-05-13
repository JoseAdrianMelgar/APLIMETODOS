// Interface que mapea la respuesta del endpoint GET /api/jobs/{id}.
// Coincide con el modelo Job.cs del backend (.NET).
export interface Job {
  id: number;
  metodo: string;
  parametros: string;
  estado: string;                // "Pending" | "RUNNING" | "DONE" | "FAILED"
  resultado: string | null;      // JSON string con NumericResult, o null
  converged: boolean | null;
  errorMessage: string | null;
  tiempoEjecucionMs: number | null;
  fechaCreacion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
}

// Estructura del JSON parseado del campo 'resultado'.
// Lo genera el worker Python (clase MetodosNumericos).
export interface NumericResult {
  raiz?: number | string;        // Newton-Raphson, Secante, Muller (string si es compleja)
  raiz_es_compleja?: boolean;    // Solo Muller: true cuando el discriminante es negativo
  solucion?: number[];           // Gauss-Seidel (vector)
  funcion?: string;
  derivada?: string;
  formula_general: string;
  iteraciones: IterationStep[];
  total_iteraciones: number;
  convergio: boolean;
  mensaje: string;
  tolerancia?: number;
  valor_inicial?: number;
}

// Cada paso intermedio del cálculo.
export interface IterationStep {
  iteracion: number;
  xi_nuevo?: number | string;    // metodos escalares (string en Muller si es complejo)
  x_nuevo?: number[];            // metodos matriciales
  error?: number;
  error_maximo?: number;
  [key: string]: unknown;        // demas campos del paso a paso
}