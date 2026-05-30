// src/pages/Raices.tsx
// Busqueda de raices: Newton-Raphson, Secante, Muller.
// Conectada a la API real: createJob() -> useJobPolling(id) -> resultado.

import { useMemo, useState } from 'react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, Play, RotateCcw, CheckCircle2, XCircle, Loader2, Sigma } from 'lucide-react';
import { createJob, type MetodoSlug } from '../lib/api';
import { useJobPolling } from '../hooks/useJobPolling';
import type { NumericResult, IterationStep } from '../types/job';

// ---------- helpers ----------

const METODOS: { slug: MetodoSlug; label: string; corto: string }[] = [
  { slug: 'newton-raphson', label: 'Newton-Raphson', corto: 'Newton' },
  { slug: 'secante', label: 'Secante', corto: 'Secante' },
  { slug: 'muller', label: 'Müller', corto: 'Müller' },
];

/** Convierte una funcion estilo JS ("x^3 - 2*x - 5") a LaTeX para el preview. */
function toLatex(expr: string): string {
  if (!expr.trim()) return 'f(x) = \\;?';
  const body = expr
    .replace(/\*\*/g, '^')
    .replace(/\*/g, ' ')
    .replace(/sqrt\(([^)]*)\)/g, '\\sqrt{$1}')
    .replace(/exp\(([^)]*)\)/g, 'e^{$1}')
    .replace(/\bpi\b/g, '\\pi');
  return `f(x) = ${body}`;
}

/** Formateo numerico seguro (evita excepciones con null/NaN/Inf). */
function fmt(n: unknown, digits = 6): string {
  if (typeof n === 'string') return n;
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n !== 0 && (Math.abs(n) < 1e-4 || Math.abs(n) >= 1e6)) return n.toExponential(3);
  return n.toFixed(digits);
}

function errorOf(it: IterationStep): number | null {
  const e = (it.error ?? it.error_maximo) as number | undefined;
  return typeof e === 'number' && isFinite(e) ? e : null;
}

// ---------- subcomponentes ----------

function MethodSelector({
  value,
  onChange,
}: {
  value: MetodoSlug;
  onChange: (m: MetodoSlug) => void;
}) {
  const idx = METODOS.findIndex((m) => m.slug === value);
  return (
    <div
      className="relative grid grid-cols-3 rounded-xl p-1"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {/* indicador deslizante */}
      <span
        className="absolute inset-y-1 rounded-lg transition-all duration-300 ease-out"
        style={{
          width: `calc(${100 / 3}% - 4px)`,
          left: `calc(${(idx * 100) / 3}% + 2px)`,
          background: 'var(--nav)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      />
      {METODOS.map((m) => {
        const active = m.slug === value;
        return (
          <button
            key={m.slug}
            type="button"
            onClick={() => onChange(m.slug)}
            className="relative z-10 rounded-lg py-2 text-sm font-medium transition-colors duration-200"
            style={{ color: active ? 'var(--nav-ink)' : 'var(--ink-soft)' }}
          >
            {m.corto}
          </button>
        );
      })}
    </div>
  );
}

/** Campo que aparece/desaparece con animacion suave. */
function Field({
  show = true,
  label,
  children,
}: {
  show?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid overflow-hidden transition-all duration-300 ease-out"
      style={{
        gridTemplateRows: show ? '1fr' : '0fr',
        opacity: show ? 1 : 0,
        marginTop: show ? undefined : 0,
      }}
    >
      <div className="min-h-0">
        <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
};

// ---------- pagina ----------

export default function Raices() {
  const [metodo, setMetodo] = useState<MetodoSlug>('newton-raphson');
  const [funcion, setFuncion] = useState('x^3 - 2*x - 5');
  const [x0, setX0] = useState('2');
  const [x1, setX1] = useState('3');
  const [x2, setX2] = useState('1');
  const [tol, setTol] = useState('1e-6');
  const [maxIter, setMaxIter] = useState('50');

  const [jobId, setJobId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { job, error: pollError, polling } = useJobPolling(jobId);

  const needsX1 = metodo === 'secante' || metodo === 'muller';
  const needsX2 = metodo === 'muller';

  // Parsea el resultado JSON del job (campo `resultado`).
  const result: NumericResult | null = useMemo(() => {
    if (!job?.resultado) return null;
    try {
      return JSON.parse(job.resultado) as NumericResult;
    } catch {
      return null;
    }
  }, [job?.resultado]);

  const chartData = useMemo(() => {
    if (!result?.iteraciones) return [];
    return result.iteraciones
      .map((it) => ({ i: it.iteracion, err: errorOf(it) }))
      .filter((d) => d.err !== null && d.err! > 0) as { i: number; err: number }[];
  }, [result]);

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Nombres EXACTOS que lee tu worker Python (metodos_numericos.py):
      // funcion_str, x0, x1, x2, tol, max_iter.
      const parametros: Record<string, unknown> = {
        funcion_str: funcion,
        x0: Number(x0),
        tol: Number(tol),
        max_iter: Number(maxIter),
      };
      if (needsX1) parametros.x1 = Number(x1);
      if (needsX2) parametros.x2 = Number(x2);

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
          <Activity size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>
            Búsqueda de raíces
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Newton-Raphson, Secante y Müller — los jobs se lanzan al solver de forma asíncrona.
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
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Método numérico
              </label>
              <MethodSelector value={metodo} onChange={setMetodo} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Función f(x)
              </label>
              <input
                value={funcion}
                onChange={(e) => setFuncion(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none transition-all focus:ring-2"
                style={inputStyle}
                placeholder="x^3 - 2*x - 5"
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
                Usa <code>^</code> para potencias. Funciones: sin, cos, tan, exp, ln, sqrt.
              </p>

              {/* vista previa LaTeX */}
              <div
                className="mt-3 rounded-xl px-4 py-3"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                  Vista previa
                </span>
                <div className="mt-1" style={{ color: 'var(--ink)' }}>
                  <BlockMath math={toLatex(funcion)} />
                </div>
              </div>
            </div>

            <Field label="x₀ (valor inicial)">
              <input value={x0} onChange={(e) => setX0(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
            </Field>

            <Field show={needsX1} label="x₁ (segunda aproximación)">
              <input value={x1} onChange={(e) => setX1(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
            </Field>

            <Field show={needsX2} label="x₂ (tercera aproximación)">
              <input value={x2} onChange={(e) => setX2(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
            </Field>

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

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || isActive}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                {submitting || isActive ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {submitting ? 'Enviando…' : isActive ? 'Procesando…' : 'Crear job'}
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              >
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
          {!jobId && <ResultPlaceholder />}

          {jobId && isActive && <ResultPending jobId={jobId} />}
          {jobId && (isDone || isFailed) && (
            <ResultPanel job={job} result={result} isDone={isDone} chartData={chartData} />
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- estados del panel ----------

function ResultPlaceholder() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <Sigma size={40} style={{ color: 'var(--ink-soft)', opacity: 0.5 }} />
      <p className="mt-3 text-sm italic" style={{ color: 'var(--ink-soft)' }}>
        Aquí se mostrará la gráfica de convergencia asíncrona…
      </p>
    </div>
  );
}

function ResultPending({ jobId,}: { jobId: number;}) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">

      {/* Anillo giratorio con número del job adentro */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div
          className="absolute inset-0 animate-spin rounded-full"
          style={{ border: '3px solid var(--border)', borderTopColor: 'var(--accent)' }}
        />
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--ink)' }}>
          #{jobId}
        </span>
      </div>

      {/* Badge EJECUTANDO */}
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-soft)' }}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--ink-soft)' }} />
        Ejecutando
      </span>

      {/* Título */}
      <h3 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>
        Ejecutando...
      </h3>

      {/* Descripción */}
      <p className="max-w-xs text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        El backend procesa el job de forma asíncrona. El sistema está haciendo polling cada 5s — los resultados aparecerán automáticamente.
      </p>

      {/* Info polling */}
      <p className="font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
        polling /api/jobs/{jobId}
      </p>

    </div>
  );
}
// Pega esta función justo ANTES de "function ResultPanel(" en Raices.tsx

function IterationsTableRaices({
  iteraciones,
  metodo,
}: {
  iteraciones: IterationStep[];
  metodo: string;
}) {
  if (!iteraciones?.length) return null;

  const iters = iteraciones as any[];

  const TH_L = 'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide';
  const TH_R = 'px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide';
  const TD_L = 'px-4 py-2 font-mono text-sm';
  const TD_R = 'px-4 py-2 text-right font-mono text-sm';
  const ROW  = { borderTop: '1px solid var(--border)', color: 'var(--ink)' };

  const fmtErr = (n: number | null | undefined) => {
    if (n == null || !isFinite(n as number)) return '—';
    return `${Math.abs(n as number).toFixed(6)}%`;
  };

  const errStyle = (n: number | null | undefined): React.CSSProperties => {
    if (n == null) return { color: 'var(--ink-soft)' };
    if (n < 0.01)  return { color: 'var(--ok)', fontWeight: 600 };
    if (n < 1)     return { color: '#84cc16' };
    if (n < 10)    return { color: '#f59e0b' };
    return { color: 'var(--bad)' };
  };

  /* ── NEWTON-RAPHSON: i | xᵢ | f(xᵢ) | f′(xᵢ) | xᵢ₊₁ | εₐ(%) ── */
  if (metodo === 'newton-raphson') {
    return (
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
          <tr style={{ color: 'var(--ink-soft)' }}>
            <th className={TH_L}>i</th>
            <th className={TH_R}>xᵢ</th>
            <th className={TH_R}>f(xᵢ)</th>
            <th className={TH_R}>f′(xᵢ)</th>
            <th className={TH_R}>xᵢ₊₁</th>
            <th className={TH_R}>εₐ (%)</th>
          </tr>
        </thead>
        <tbody>
          {iters.map((it, k) => {
            const err = it.error ?? null;
            return (
              <tr key={k} style={ROW}>
                <td className={TD_L}>{it.iteracion}</td>
                <td className={TD_R}>{fmt(it.xi_anterior ?? it.xi ?? it.xi_actual)}</td>
                <td className={TD_R}>{fmt(it.f_xi ?? it.fxi ?? it.f_anterior)}</td>
                <td className={TD_R}>{fmt(it.f_prima ?? it.derivada ?? it.fpxi)}</td>
                <td className={TD_R}>{fmt(it.xi_nuevo)}</td>
                <td className={TD_R} style={errStyle(err)}>{fmtErr(err)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  /* ── SECANTE: i | xᵢ₋₁ | xᵢ | f(xᵢ) | xᵢ₊₁ | εₐ(%) ── */
  if (metodo === 'secante') {
    return (
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
          <tr style={{ color: 'var(--ink-soft)' }}>
            <th className={TH_L}>i</th>
            <th className={TH_R}>xᵢ₋₁</th>
            <th className={TH_R}>xᵢ</th>
            <th className={TH_R}>f(xᵢ)</th>
            <th className={TH_R}>xᵢ₊₁</th>
            <th className={TH_R}>εₐ (%)</th>
          </tr>
        </thead>
        <tbody>
          {iters.map((it, k) => {
            const fxi = it.paso_2_evaluar_funcion_actual?.resultado ?? null;
            const err = it.error ?? null;
            return (
              <tr key={k} style={ROW}>
                <td className={TD_L}>{it.iteracion}</td>
                <td className={TD_R}>{fmt(it.xi_anterior)}</td>
                <td className={TD_R}>{fmt(it.xi_actual)}</td>
                <td className={TD_R}>{fmt(fxi)}</td>
                <td className={TD_R}>{fmt(it.xi_nuevo)}</td>
                <td className={TD_R} style={errStyle(err)}>{fmtErr(err)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  /* ── MÜLLER: i | x₀ | x₁ | x₂ | f(x₂) | xᵣ | εₐ(%) ── */
  if (metodo === 'muller') {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
        <tr style={{ color: 'var(--ink-soft)' }}>
          <th className={TH_L}>i</th>
          <th className={TH_R}>X₀</th>
          <th className={TH_R}>X₁</th>
          <th className={TH_R}>X₂</th>
          <th className={TH_R}>F(X₂)</th>
          <th className={TH_R}>Xᵣ (nueva raíz)</th>
          <th className={TH_R}>εₐ (%)</th>
        </tr>
      </thead>
      <tbody>
        {iters.map((it, k) => {
          const err = it.error ?? null;
          return (
            <tr key={k} style={ROW}>
              <td className={TD_L}>{it.iteracion}</td>
              <td className={TD_R}>{fmt(it.x0_actual)}</td>
              <td className={TD_R}>{fmt(it.x1_actual)}</td>
              <td className={TD_R}>{fmt(it.x2_actual)}</td>
              <td className={TD_R}>{fmt(it.paso_2_diferencias_divididas?.f_x2)}</td>
              <td className={TD_R}>{fmt(it.xi_nuevo)}</td>
              <td className={TD_R} style={errStyle(err)}>{fmtErr(err)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

  return null;
}

// ─── Y en ResultPanel reemplaza el bloque {/* tabla de iteraciones */} con esto: ───
//
// {result.iteraciones?.length > 0 && (
//   <div
//     className="overflow-hidden rounded-2xl"
//     style={{ border: '1px solid var(--border)' }}
//   >
//     <div className="max-h-64 overflow-y-auto">
//       <IterationsTableRaices iteraciones={result.iteraciones} metodo={job.metodo} />
//     </div>
//   </div>
// )}


function ResultPanel({
  job,
  result,
  isDone,
  chartData,
}: {
  job: import('../types/job').Job | null;
  result: NumericResult | null;
  isDone: boolean;
  chartData: { i: number; err: number }[];
}) {
  if (!job) return null;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isDone ? (
            <CheckCircle2 size={22} style={{ color: 'var(--ok)' }} />
          ) : (
            <XCircle size={22} style={{ color: 'var(--bad)' }} />
          )}
          <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>
            Job #{job.id} {isDone ? 'completado' : 'fallido'}
          </h2>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold uppercase"
          style={{
            background: isDone ? 'rgba(47,122,82,0.15)' : 'rgba(178,59,59,0.15)',
            color: isDone ? 'var(--ok)' : 'var(--bad)',
          }}
        >
          {job.estado}
        </span>
      </div>

      {/* metricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Método" value={job.metodo} mono />
        <Metric label="Tiempo" value={job.tiempoEjecucionMs != null ? `${job.tiempoEjecucionMs} ms` : '—'} />
        <Metric label="Pasos" value={result?.total_iteraciones ?? result?.iteraciones?.length ?? '—'} />
        <Metric
          label="Convergencia"
          value={result?.convergio ?? job.converged ? 'Sí' : 'No'}
          color={result?.convergio ?? job.converged ? 'var(--ok)' : 'var(--bad)'}
        />
      </div>

      {isDone && result && (
        <>{/* BANNER: no convergió → sin raíz real */}
{!result.convergio && result.raiz == null && (
  <div
    className="rounded-2xl px-4 py-3 flex items-start gap-2"
    style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)' }}
  >
    <span style={{ color: '#f59e0b', fontSize: 18 }}>⚠</span>
    <div>
      <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
        No se encontró raíz real
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>
        {result.mensaje ?? 'El método no convergió. La función podría no tener raíces reales en esta región.'}
      </p>
    </div>
  </div>
        )}
          {/* raiz encontrada */}
          {result.raiz != null && (
            <div
              className="rounded-2xl px-5 py-4 text-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                Raíz encontrada
              </span>
              <div className="mt-1" style={{ color: 'var(--ink)' }}>
                <BlockMath math={`x^{*} = ${typeof result.raiz === 'number' ? fmt(result.raiz, 10) : result.raiz}`} />
              </div>
            </div>
          )}

          {/* grafica de convergencia */}
          {chartData.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Convergencia — error vs. iteración
                </h3>
                <span className="font-mono text-[10px]" style={{ color: 'var(--ink-soft)' }}>log-scale</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="i" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" />
                  <YAxis
                    scale="log"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: 'var(--ink-soft)' }}
                    stroke="var(--border)"
                    tickFormatter={(v) => (typeof v === 'number' ? v.toExponential(0) : v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--ink)',
                    }}
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value);
                      return [isFinite(n) ? n.toExponential(3) : '—', 'error'];
                    }}
                    labelFormatter={(l) => `iteración ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="err"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--accent)' }}
                    activeDot={{ r: 6 }}
                    animationDuration={900}
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* tabla de iteraciones */}
{result.iteraciones?.length > 0 && (
  <div
    className="overflow-hidden rounded-2xl"
    style={{ border: '1px solid var(--border)' }}
  >
    <div className="max-h-64 overflow-y-auto">
      <IterationsTableRaices iteraciones={result.iteraciones} metodo={job.metodo} />
    </div>
  </div>
  )}
      </>
    )}

      {/* mensaje de error del job FAILED */}



      {/* mensaje de error del job FAILED */}
      {!isDone && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: 'rgba(178,59,59,0.1)', color: 'var(--bad)' }}
        >
          {job.errorMessage ?? result?.mensaje ?? 'El job falló sin mensaje específico.'}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </div>
      <div
        className={`mt-0.5 text-base font-bold ${mono ? 'font-mono' : 'font-serif'}`}
        style={{ color: color ?? 'var(--ink)' }}
      >
        {value}
      </div>
    </div>
  );
}
