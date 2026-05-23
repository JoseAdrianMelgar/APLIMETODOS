// src/pages/Comparar.tsx
// Comparacion de metodos de raices: lanza Newton-Raphson + Secante + Muller en
// paralelo (3 POST), pollea los 3 y superpone sus curvas de convergencia + tabla.

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
import { GitCompareArrows, Play, RotateCcw, Loader2, Trophy } from 'lucide-react';
import { createJob } from '../lib/api';
import { useJobPolling } from '../hooks/useJobPolling';
import type { Job } from '../types/job';

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

function fmt(n: unknown, d = 6): string {
  if (typeof n === 'string') return n;
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n !== 0 && (Math.abs(n) < 1e-4 || Math.abs(n) >= 1e6)) return n.toExponential(3);
  return Number(n.toFixed(d)).toString();
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
};

interface ParsedRun {
  convergio: boolean;
  total: number;
  raiz: number | string | null;
  iteraciones: { i: number; err: number }[];
}

function parseRun(job: Job | null): ParsedRun | null {
  if (!job?.resultado) return null;
  try {
    const r = JSON.parse(job.resultado);
    const iters = (r.iteraciones ?? [])
      .map((it: { iteracion: number; error?: number }) => ({ i: it.iteracion, err: it.error }))
      .filter((d: { err?: number }) => typeof d.err === 'number' && d.err! > 0);
    return {
      convergio: !!r.convergio,
      total: r.total_iteraciones ?? iters.length,
      raiz: r.raiz ?? null,
      iteraciones: iters,
    };
  } catch {
    return null;
  }
}

export default function Comparar() {
  const [funcion, setFuncion] = useState('x^3 - 2*x - 5');
  const [x0, setX0] = useState('2');
  const [x1, setX1] = useState('3');
  const [x2, setX2] = useState('1');
  const [tol, setTol] = useState('1e-6');
  const [maxIter, setMaxIter] = useState('50');

  const [ids, setIds] = useState<{ newton: number; secante: number; muller: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newton = useJobPolling(ids?.newton ?? null);
  const secante = useJobPolling(ids?.secante ?? null);
  const muller = useJobPolling(ids?.muller ?? null);

  const runs = useMemo(
    () => [
      { key: 'newton', label: 'Newton', color: 'var(--nav)', job: newton.job },
      { key: 'secante', label: 'Secante', color: 'var(--accent)', job: secante.job },
      { key: 'muller', label: 'Müller', color: 'var(--ok)', job: muller.job },
    ],
    [newton.job, secante.job, muller.job],
  );

  const parsed = useMemo(
    () => Object.fromEntries(runs.map((r) => [r.key, parseRun(r.job)])) as Record<string, ParsedRun | null>,
    [runs],
  );

  const chartData = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const r of runs) {
      const p = parsed[r.key];
      if (!p) continue;
      for (const it of p.iteraciones) {
        const row = map.get(it.i) ?? { i: it.i };
        row[r.key] = it.err;
        map.set(it.i, row);
      }
    }
    return [...map.values()].sort((a, b) => a.i - b.i);
  }, [runs, parsed]);

  const active = ids && (newton.polling || secante.polling || muller.polling);
  const allDone = ids && runs.every((r) => {
    const e = r.job?.estado?.toLowerCase();
    return e === 'done' || e === 'failed';
  });

  // ganadores (entre los que convergieron)
  const winners = useMemo(() => {
    const conv = runs.filter((r) => parsed[r.key]?.convergio);
    let bestIter: string | null = null;
    let bestTime: string | null = null;
    let minIter = Infinity;
    let minTime = Infinity;
    for (const r of conv) {
      const it = parsed[r.key]!.total;
      const t = r.job?.tiempoEjecucionMs ?? Infinity;
      if (it < minIter) { minIter = it; bestIter = r.key; }
      if (t < minTime) { minTime = t; bestTime = r.key; }
    }
    return { bestIter, bestTime };
  }, [runs, parsed]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const base = { funcion_str: funcion, tol: Number(tol), max_iter: Number(maxIter) };
      const [jn, js, jm] = await Promise.all([
        createJob({ metodo: 'newton-raphson', parametros: { ...base, x0: Number(x0) } }),
        createJob({ metodo: 'secante', parametros: { ...base, x0: Number(x0), x1: Number(x1) } }),
        createJob({ metodo: 'muller', parametros: { ...base, x0: Number(x0), x1: Number(x1), x2: Number(x2) } }),
      ]);
      setIds({ newton: jn.id, secante: js.id, muller: jm.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al lanzar la comparación');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setIds(null);
    setError(null);
  }

  return (
    <div>
      <div className="mb-8 flex items-start gap-3">
        <span className="mt-1 grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          <GitCompareArrows size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>Comparar métodos</h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Ejecuta Newton-Raphson, Secante y Müller sobre la misma f(x) y compara su convergencia.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* config */}
        <section className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="mb-5 font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>Configuración</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>Función f(x)</label>
              <input value={funcion} onChange={(e) => setFuncion(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
              <div className="mt-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Vista previa</span>
                <div className="mt-1" style={{ color: 'var(--ink)' }}><BlockMath math={toLatex(funcion)} /></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Inp label="x₀" value={x0} onChange={setX0} />
              <Inp label="x₁" value={x1} onChange={setX1} />
              <Inp label="x₂" value={x2} onChange={setX2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Inp label="Tolerancia" value={tol} onChange={setTol} />
              <Inp label="Máx. iteraciones" value={maxIter} onChange={setMaxIter} />
            </div>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              x₀ lo usan los 3 · x₁ Secante y Müller · x₂ solo Müller.
            </p>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} disabled={submitting || !!active}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {submitting || active ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {submitting ? 'Lanzando…' : active ? 'Comparando…' : 'Comparar los 3 métodos'}
              </button>
              <button onClick={reset} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                <RotateCcw size={16} /> Reset
              </button>
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
          </div>
        </section>

        {/* resultados */}
        <section className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {!ids && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <GitCompareArrows size={40} style={{ color: 'var(--ink-soft)', opacity: 0.5 }} />
              <p className="mt-3 text-sm italic" style={{ color: 'var(--ink-soft)' }}>Aquí se superpondrán las 3 curvas de convergencia…</p>
            </div>
          )}

          {ids && !allDone && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="mt-4 font-semibold" style={{ color: 'var(--ink)' }}>Ejecutando 3 jobs en paralelo…</p>
              <div className="mt-3 flex gap-3 font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                {runs.map((r) => (
                  <span key={r.key}>{r.label}: {r.job?.estado ?? 'PENDING'}</span>
                ))}
              </div>
            </div>
          )}

          {ids && allDone && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>Convergencia comparada</h2>

              {chartData.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="i" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" />
                      <YAxis scale="log" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--ink-soft)' }} stroke="var(--border)"
                        tickFormatter={(v) => (typeof v === 'number' ? v.toExponential(0) : v)} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)' }}
                        formatter={(value, name) => {
                          const n = typeof value === 'number' ? value : Number(value);
                          return [isFinite(n) ? n.toExponential(3) : '—', name];
                        }}
                        labelFormatter={(l) => `iteración ${l}`} />
                      {runs.map((r) => (
                        <Line key={r.key} type="monotone" dataKey={r.key} name={r.label} stroke={r.color}
                          strokeWidth={2.5} dot={{ r: 3, fill: r.color }} activeDot={{ r: 6 }} connectNulls
                          animationDuration={900} animationEasing="ease-in-out" />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-center gap-5 text-sm" style={{ color: 'var(--ink)' }}>
                    {runs.map((r) => (
                      <span key={r.key} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* tabla comparativa */}
              <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--surface-2)' }}>
                    <tr style={{ color: 'var(--ink-soft)' }}>
                      <th className="px-4 py-2 text-left font-medium">Método</th>
                      <th className="px-4 py-2 text-center font-medium">¿Convergió?</th>
                      <th className="px-4 py-2 text-right font-medium">Iter.</th>
                      <th className="px-4 py-2 text-right font-medium">Tiempo</th>
                      <th className="px-4 py-2 text-right font-medium">Raíz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => {
                      const p = parsed[r.key];
                      return (
                        <tr key={r.key} style={{ borderTop: '1px solid var(--border)', color: 'var(--ink)' }}>
                          <td className="px-4 py-2.5 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold" style={{ color: p?.convergio ? 'var(--ok)' : 'var(--bad)' }}>
                            {p?.convergio ? 'Sí' : 'No'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {p?.total ?? '—'}
                            {winners.bestIter === r.key && <Trophy size={13} className="ml-1 inline" style={{ color: 'var(--accent)' }} />}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {r.job?.tiempoEjecucionMs != null ? `${r.job.tiempoEjecucionMs} ms` : '—'}
                            {winners.bestTime === r.key && <Trophy size={13} className="ml-1 inline" style={{ color: 'var(--accent)' }} />}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--accent)' }}>
                            {p?.raiz != null ? fmt(p.raiz, 8) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                <Trophy size={12} className="mr-1 inline" style={{ color: 'var(--accent)' }} />
                = mejor en menos iteraciones / menor tiempo (entre los que convergieron).
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Inp({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 font-mono text-sm outline-none focus:ring-2" style={inputStyle} />
    </div>
  );
}
