// src/pages/Sistemas.tsx
// Sistemas lineales Ax = b: Gauss (pivoteo), Gauss-Jordan (RREF), Gauss-Seidel (iterativo).
// Conectado a la API real. El worker manda A y b por separado; el resultado trae el
// paso a paso (eliminacion / normalizacion / sustitucion_regresiva / pasos_por_variable).

import { Fragment, useMemo, useState } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Grid3X3,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { createJob, type MetodoSlug } from '../lib/api';
import { useJobPolling } from '../hooks/useJobPolling';
import type { Job } from '../types/job';

// ---------- tipos locales del resultado de sistemas ----------

interface ElimStep {
  iteracion: number;
  tipo: 'eliminacion' | 'normalizacion' | 'sustitucion_regresiva' | 'solucion';
  descripcion: string;
  matriz_antes?: number[][];
  matriz_despues?: number[][];
  fila_cambiada?: number;
  valor?: number;
  solucion_parcial?: number[];
}

interface SeidelVarStep {
  variable: string;
  formula_despeje: string;
  terminos_sumatoria: { indice_j: number; coeficiente: number; x_j_usado: number; producto: number }[];
  suma_no_diagonal: number;
  numerador: number;
  denominador: number;
  resultado: number;
  error_variable: number;
}

interface SeidelStep {
  iteracion: number;
  x_anterior: number[];
  pasos_por_variable: SeidelVarStep[];
  x_nuevo: number[];
  error_maximo: number;
}

type SystemStep = ElimStep | SeidelStep;

interface SystemResult {
  solucion: number[] | null;
  matriz_A?: number[][];
  vector_b?: number[];
  matriz_aumentada_inicial?: number[][];
  matriz_aumentada_final?: number[][];
  vector_inicial?: number[];
  formula_general?: string;
  despejes?: string[];
  iteraciones: SystemStep[];
  total_iteraciones: number;
  convergio: boolean;
  mensaje: string;
}

function isSeidelStep(s: SystemStep): s is SeidelStep {
  return 'pasos_por_variable' in s;
}

// ---------- helpers ----------

const METODOS: { slug: MetodoSlug; label: string; full: string }[] = [
  { slug: 'gauss', label: 'Gauss', full: 'Gauss (eliminación con pivoteo parcial)' },
  { slug: 'gauss-seidel', label: 'Seidel', full: 'Gauss-Seidel (iterativo)' },
  { slug: 'gauss-jordan', label: 'Jordan', full: 'Gauss-Jordan (RREF)' },
];

const SIZES = [2, 3, 4] as const;

function fmt(n: unknown, digits = 4): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n !== 0 && (Math.abs(n) < 1e-4 || Math.abs(n) >= 1e6)) return n.toExponential(3);
  return Number(n.toFixed(digits)).toString();
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
};

function makeGrid(n: number, prev?: string[][]): string[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => prev?.[i]?.[j] ?? '0'),
  );
}

const EXAMPLE_3: string[][] = [
  ['4', '1', '-1', '3'],
  ['2', '7', '1', '19'],
  ['1', '-3', '12', '31'],
];



// ---------- subcomponentes ----------

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  const idx = options.indexOf(value);
  return (
    <div
      className="relative grid rounded-xl p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      <span
        className="absolute inset-y-1 rounded-lg transition-all duration-300 ease-out"
        style={{
          width: `calc(${100 / options.length}% - 4px)`,
          left: `calc(${(idx * 100) / options.length}% + 2px)`,
          background: 'var(--nav)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      />
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className="relative z-10 rounded-lg py-2 text-sm font-medium transition-colors duration-200"
          style={{ color: o === value ? 'var(--nav-ink)' : 'var(--ink-soft)' }}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

function MatrixView({ m }: { m: number[][] }) {
  const cols = m[0]?.length ?? 0;
  const bCol = cols - 1;
  return (
    <div className="overflow-x-auto py-1 font-mono text-xs" style={{ color: 'var(--ink)' }}>
      {m.map((row, i) => (
        <div key={i} className="flex items-center gap-1 whitespace-nowrap">
          <span className="w-6" style={{ color: 'var(--ink-soft)' }}>F{i + 1}</span>
          <span>[</span>
          {row.map((v, j) => (
            <Fragment key={j}>
              {j === bCol && <span className="px-1" style={{ color: 'var(--ink-soft)' }}>|</span>}
              <span
                className="w-16 text-right tabular-nums"
                style={j === bCol ? { color: 'var(--accent)' } : undefined}
              >
                {fmt(v)}
              </span>
            </Fragment>
          ))}
          <span className="pl-1">]</span>
        </div>
      ))}
    </div>
  );
}

function badgeColor(tipo: ElimStep['tipo']) {
  switch (tipo) {
    case 'eliminacion':
      return { bg: 'var(--surface-2)', fg: 'var(--ink-soft)' };
    case 'normalizacion':
      return { bg: 'rgba(30,58,95,0.12)', fg: 'var(--nav)' };
    default: // sustitucion_regresiva / solucion
      return { bg: 'var(--accent-soft)', fg: 'var(--accent)' };
  }
}

function StepRow({ step }: { step: ElimStep }) {
  const [open, setOpen] = useState(false);
  const c = badgeColor(step.tipo);
  return (
    <div className="rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase"
          style={{ background: c.bg, color: c.fg }}
        >
          {step.tipo.replace('_', ' ')}
        </span>
        <span className="flex-1 font-mono text-sm" style={{ color: 'var(--ink)' }}>
          {step.descripcion}
        </span>
        {step.matriz_despues && (
          <ChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{ color: 'var(--ink-soft)', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        )}
      </button>
      {open && step.matriz_despues && (
        <div className="px-3 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="py-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
            Matriz después de la operación
          </p>
          <MatrixView m={step.matriz_despues} />
        </div>
      )}
    </div>
  );
}

function SeidelRow({ step, vars }: { step: SeidelStep; vars: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--nav)' }}>
          #{step.iteracion}
        </span>
        <span className="flex-1 font-mono text-xs" style={{ color: 'var(--ink)' }}>
          x = [{step.x_nuevo.slice(0, vars).map((v) => fmt(v, 5)).join(', ')}]
        </span>
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ color: 'var(--ink-soft)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
          {step.pasos_por_variable.map((p, k) => (
            <div key={k} className="pt-2">
              <div className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{p.formula_despeje}</div>
              <div className="mt-1 font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                = ({fmt(p.numerador)}) / ({fmt(p.denominador)}) = <span style={{ color: 'var(--ink)' }}>{fmt(p.resultado, 6)}</span>
                {'   '}· error {fmt(p.error_variable, 4)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function KaTeXDisplay({ math }: { math: string }) {
  try {
    const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ color: 'var(--ink)' }} />;
  } catch {
    return <div className="font-mono text-sm">{math}</div>;
  }
}

function backSubSteps(U: number[][]): string[] {
  const n = U.length;
  const x = new Array(n).fill(0);
  const steps: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const bi = U[i][n];
    let acc = bi;
    const parts: string[] = [];
    for (let j = i + 1; j < n; j++) {
      acc -= U[i][j] * x[j];
      parts.push(`(${fmt(U[i][j])})(${fmt(x[j])})`);
    }
    x[i] = acc / U[i][i];
    const num = parts.length ? `${fmt(bi)} - ${parts.join(' - ')}` : `${fmt(bi)}`;
    const reduced = parts.length ? ` = \\frac{${fmt(acc)}}{${fmt(U[i][i])}}` : '';
    steps.push(`x_{${i+1}} = \\frac{${num}}{${fmt(U[i][i])}}${reduced} = \\boldsymbol{${fmt(x[i], 4)}}`);
  }
  return steps;
}

// ---------- pagina ----------

export default function Sistemas() {
  const [metodo, setMetodo] = useState<MetodoSlug>('gauss');
  const [size, setSize] = useState<number>(3);
  const [cells, setCells] = useState<string[][]>(EXAMPLE_3);
  const [tol, setTol] = useState('0.001');
  const [maxIter, setMaxIter] = useState('50');

  const [jobId, setJobId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { job, error: pollError, polling } = useJobPolling(jobId);

  const isSeidel = metodo === 'gauss-seidel';

  function changeSize(n: number) {
    setSize(n);
    setCells((prev) => makeGrid(n, prev));
  }

  function setCell(i: number, j: number, val: string) {
    setCells((prev) => prev.map((row, ri) => (ri === i ? row.map((c, cj) => (cj === j ? val : c)) : row)));
  }

  const result: SystemResult | null = useMemo(() => {
    if (!job?.resultado) return null;
    try {
      return JSON.parse(job.resultado) as SystemResult;
    } catch {
      return null;
    }
  }, [job?.resultado]);

  // datos de la grafica de convergencia (solo Seidel)
  const chartData = useMemo(() => {
    if (!result) return [];
    return result.iteraciones
      .filter(isSeidelStep)
      .map((s) => ({ i: s.iteracion, err: s.error_maximo }))
      .filter((d) => d.err > 0);
  }, [result]);

  async function handleSubmit() {
    setSubmitError(null);

    // E-05: validar celdas antes del POST
    for (let i = 0; i < size; i++) {
      for (let j = 0; j <= size; j++) {
        const val = cells[i][j].trim();
        const col = j < size ? `col ${j + 1}` : 'vector b';
        if (val === '')
          return setSubmitError(`Celda vacía en F${i + 1}, ${col}. Completa toda la matriz.`);
        if (!isFinite(Number(val)))
          return setSubmitError(`"${val}" no es un número válido (F${i + 1}, ${col}).`);
      }
    }

    setSubmitting(true);  
    try {
      const A = cells.map((row) => row.slice(0, size).map(Number));
      const b = cells.map((row) => Number(row[size]));
      const parametros: Record<string, unknown> = { A, b };
      if (isSeidel) {
        parametros.tol = Number(tol);
        parametros.max_iter = Number(maxIter);
      }
      const created = await createJob({ metodo, parametros });
      setJobId(created.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Error al crear el job');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setJobId(null);
    setSubmitError(null);
  }

  const estado = job?.estado?.toLowerCase();
  const isDone = estado === 'done';
  const isFailed = estado === 'failed';
  const isActive = polling && !isDone && !isFailed;

  return (
    <div>
      {/* encabezado */}
      <div className="mb-8 flex items-start gap-3">
        <span
          className="mt-1 grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          <Grid3X3 size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>
            Sistemas lineales <InlineMath math="Ax = b" />
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Gauss con pivoteo, Gauss-Seidel iterativo y Gauss-Jordan (RREF) — paso a paso completo.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- CONFIGURACION ---------- */}
        <section
          className="rounded-3xl p-6 shadow-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              Configuración
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>Método</label>
              <Segmented options={METODOS.map((m) => m.slug)} value={metodo} onChange={setMetodo}
                render={(s) => METODOS.find((m) => m.slug === s)!.label} />
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
                {METODOS.find((m) => m.slug === metodo)!.full}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Tamaño de la matriz (n × n)
              </label>
              <Segmented options={SIZES} value={size} onChange={changeSize} render={(n) => `${n} × ${n}`} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Matriz aumentada{' '}
                <span className="font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>[A | b]</span>
              </label>
              <div className="space-y-2">
                {cells.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-6 text-xs" style={{ color: 'var(--ink-soft)' }}>F{i + 1}</span>
                    {row.map((val, j) => (
                      <Fragment key={j}>
                        {j === size && <span className="px-0.5 text-lg" style={{ color: 'var(--ink-soft)' }}>|</span>}
                        <input
                          value={val}
                          onChange={(e) => setCell(i, j, e.target.value)}
                          className="w-14 rounded-lg px-1 py-2 text-center font-mono text-sm outline-none transition-all focus:ring-2"
                          style={j === size ? { ...inputStyle, background: 'var(--accent-soft)' } : inputStyle}
                        />
                      </Fragment>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
                Última columna (ámbar) = vector b. Usá punto decimal.
              </p>
            </div>

            {isSeidel && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>Tolerancia</label>
                  <input value={tol} onChange={(e) => setTol(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>Máx. iteraciones</label>
                  <input value={maxIter} onChange={(e) => setMaxIter(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || isActive}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                {submitting || isActive ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {submitting ? 'Enviando…' : isActive ? 'Resolviendo…' : 'Resolver sistema'}
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                <RotateCcw size={16} /> Reset
              </button>
            </div>

            {(submitError || pollError) && (
              <p className="text-sm" style={{ color: 'var(--bad)' }}>
                {submitError ?? `Error de red: ${pollError}`}
              </p>
            )}
          </div>
        </section>

        {/* ---------- RESULTADOS ---------- */}
        <section
          className="rounded-3xl p-6 shadow-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {!jobId && <Placeholder />}
          {jobId && isActive && <Pending jobId={jobId} />}
          {jobId && (isDone || isFailed) && (
            <ResultPanel job={job} result={result} isDone={isDone} metodo={metodo} size={size} chartData={chartData} />
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- estados del panel ----------

function Placeholder() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <Grid3X3 size={40} style={{ color: 'var(--ink-soft)', opacity: 0.5 }} />
      <p className="mt-3 text-sm italic" style={{ color: 'var(--ink-soft)' }}>
        Aquí se mostrará la solución y el paso a paso matricial…
      </p>
    </div>
  );
}

function Pending({ jobId }: { jobId: number }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div
          className="absolute inset-0 animate-spin rounded-full"
          style={{ border: '3px solid var(--border)', borderTopColor: 'var(--accent)' }}
        />
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--ink)' }}>
          #{jobId}
        </span>
      </div>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-soft)' }}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--ink-soft)' }} />
        Ejecutando
      </span>
      <h3 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>
        Ejecutando...
      </h3>
      <p className="max-w-xs text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        El backend procesa el job de forma asíncrona. El sistema está haciendo polling cada 5s — los resultados aparecerán automáticamente.
      </p>
      <p className="font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
        polling /api/jobs/{jobId}
      </p>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>{label}</div>
      <div className="mt-0.5 text-base font-bold" style={{ color: color ?? 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function ResultPanel({
  job,
  result,
  isDone,
  metodo,
  size,
  chartData,
}: {
  job: Job | null;
  result: SystemResult | null;
  isDone: boolean;
  metodo: MetodoSlug;
  size: number;
  chartData: { i: number; err: number }[];
}) {
  if (!job) return null;
  const convergio = result?.convergio ?? job.converged ?? false;
  const elimSteps = (result?.iteraciones ?? []).filter((s): s is ElimStep => !isSeidelStep(s));
  const seidelSteps = (result?.iteraciones ?? []).filter(isSeidelStep);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isDone && convergio ? (
            <CheckCircle2 size={22} style={{ color: 'var(--ok)' }} />
          ) : (
            <XCircle size={22} style={{ color: 'var(--bad)' }} />
          )}
          <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>
            Job #{job.id} {isDone ? 'completado' : 'fallido'}
          </h2>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold uppercase"
          style={{
            background: isDone ? 'rgba(47,122,82,0.15)' : 'rgba(178,59,59,0.15)',
            color: isDone ? 'var(--ok)' : 'var(--bad)',
          }}>
          {job.estado}
        </span>
      </div>

      {/* metricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Método" value={<span className="font-mono">{job.metodo}</span>} />
        <Metric label="Tiempo" value={job.tiempoEjecucionMs != null ? `${job.tiempoEjecucionMs} ms` : '—'} />
        <Metric label="Pasos" value={result?.total_iteraciones ?? 0} />
        <Metric label="Convergencia" value={convergio ? 'Sí' : 'No'} color={convergio ? 'var(--ok)' : 'var(--bad)'} />
      </div>

      {/* no convergio / fallido */}
      {!(isDone && convergio) && (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(200,146,76,0.12)', border: '1px solid var(--accent)' }}>
          <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--accent)' }}>
            <AlertTriangle size={16} /> El método no entregó solución única.
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {job.errorMessage ?? result?.mensaje}
          </p>
        </div>
      )}

      {isDone && convergio && result && (
        <>
          {/* vector solucion */}
          {result.solucion && (
            <div className="rounded-2xl px-5 py-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                Vector solución x
              </span>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono sm:grid-cols-3" style={{ color: 'var(--ink)' }}>
                {result.solucion.map((v, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <InlineMath math={`x_{${i + 1}} =`} />
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>{fmt(v, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEIDEL: despejes + grafica + iteraciones */}
          {metodo === 'gauss-seidel' && (
            <>
              {result.despejes && (
                <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <h3 className="mb-2 font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Despejes</h3>
                  <div className="space-y-1 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                    {result.despejes.map((d, i) => <div key={i}>{d}</div>)}
                  </div>
                </div>
              )}

              {chartData.length > 0 && (
                <ConvergenceChart data={chartData} />
              )}
              <SeidelSummaryTable steps={seidelSteps} vars={size} />

              <div className="space-y-2">
                <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Iteraciones ({seidelSteps.length})
                </h3>
                {seidelSteps.map((s, k) => <SeidelRow key={k} step={s} vars={size} />)}
              </div>
            </>
          )}

          {/* GAUSS / GAUSS-JORDAN: paso a paso matricial */}
          {metodo !== 'gauss-seidel' && (
            <div className="space-y-2">
              <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Paso a paso ({result.total_iteraciones} operaciones)
              </h3>

              {result.matriz_aumentada_inicial && (
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                    Matriz aumentada inicial
                  </p>
                  <MatrixView m={result.matriz_aumentada_inicial} />
                </div>
              )}

              {elimSteps.map((s, k) => <StepRow key={k} step={s} />)}
              {metodo === 'gauss' && result.matriz_aumentada_final && (
  <BackSubSection
    U={result.matriz_aumentada_final}
    tiempo={job.tiempoEjecucionMs}
    ops={result.total_iteraciones}
  />
)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BackSubSection({ U, tiempo, ops }: { U: number[][], tiempo?: number | null, ops?: number }) {
  const n = U.length;
  const steps = backSubSteps(U);
  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <span className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          ↓ Sustitución regresiva ({n} variables)
        </span>
        {tiempo != null && (
          <span className="font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
            {tiempo} ms · {ops ?? steps.length} ops
          </span>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Matriz triangular superior</p>
          <MatrixView m={U} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Fórmula general</p>
          <KaTeXDisplay math={"x_i = \\frac{b_i - \\displaystyle\\sum_{j=i+1}^{n} a_{ij}\\, x_j}{a_{ii}}"} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Despeje paso a paso (de x_{n} hacia arriba)</p>
          <div className="space-y-3">
            {steps.map((s, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {idx + 1}
                </span>
                <div className="flex-1"><KaTeXDisplay math={s} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function SeidelSummaryTable({ steps, vars }: { steps: SeidelStep[]; vars: number }) {
  if (!steps.length) return null;
  const subs = ['₁','₂','₃','₄','₅','₆'];
  const fmtErr = (n: number) => {
    const color = n < 0.01 ? 'var(--ok)' : n < 1 ? '#84cc16' : n < 10 ? '#f59e0b' : 'var(--bad)';
    return <span style={{ color, fontWeight: n < 0.01 ? 600 : 400 }}>{Math.abs(n).toFixed(6)}%</span>;
  };
  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
            <tr style={{ color: 'var(--ink-soft)' }}>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Iteración</th>
              {Array.from({ length: vars }, (_, i) => (
                <th key={i} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide">
                  x{subs[i] ?? i+1}
                </th>
              ))}
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide">Error máx. (%)</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, k) => (
              <tr key={k} style={{ borderTop: '1px solid var(--border)', color: 'var(--ink)' }}>
                <td className="px-4 py-2 font-mono text-sm">{s.iteracion}</td>
                {Array.from({ length: vars }, (_, i) => (
                  <td key={i} className="px-4 py-2 text-right font-mono text-sm" style={{ color: 'var(--accent)' }}>
                    {fmt(s.x_nuevo[i] ?? null)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-mono text-sm">{fmtErr(s.error_maximo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConvergenceChart({ data }: { data: { i: number; err: number }[] }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Convergencia — error máx. vs. iteración
        </h3>
        <span className="font-mono text-[10px]" style={{ color: 'var(--ink-soft)' }}>log-scale</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="i" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" />
          <YAxis scale="log" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--ink-soft)' }}
            stroke="var(--border)" tickFormatter={(v) => (typeof v === 'number' ? v.toExponential(0) : v)} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)' }}
            formatter={(value) => {
              const n = typeof value === 'number' ? value : Number(value);
              return [isFinite(n) ? `${n.toExponential(3)} %` : '—', 'error máx'];
            }}
            labelFormatter={(l) => `iteración ${l}`}
          />
          <Line type="monotone" dataKey="err" stroke="var(--accent)" strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--accent)' }} activeDot={{ r: 6 }} animationDuration={900} animationEasing="ease-in-out" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
