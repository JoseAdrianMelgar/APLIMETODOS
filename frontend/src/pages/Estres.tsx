// src/pages/Estres.tsx
// Pruebas de estres con dos barras simultaneas: encolado y procesado por el worker.

import { useEffect, useRef, useState } from 'react';
import { Zap, Play, Loader2, CheckCircle2 } from 'lucide-react';
import { createJob, listJobs, type CreateJobPayload } from '../lib/api';

const PRESETS: CreateJobPayload[] = [
  { metodo: 'newton-raphson', parametros: { funcion_str: 'x^3 - 2*x - 5', x0: 2, tol: 1e-6, max_iter: 50 } },
  { metodo: 'secante', parametros: { funcion_str: 'x^2 - 2', x0: 1, x1: 2, tol: 1e-6, max_iter: 50 } },
  { metodo: 'muller', parametros: { funcion_str: 'x^2 + 1', x0: 0, x1: 1, x2: 2, tol: 1e-3, max_iter: 50 } },
  { metodo: 'gauss', parametros: { A: [[4, 1, -1], [2, 7, 1], [1, -3, 12]], b: [3, 19, 31] } },
  { metodo: 'gauss-jordan', parametros: { A: [[4, 1, -1], [2, 7, 1], [1, -3, 12]], b: [3, 19, 31] } },
  { metodo: 'gauss-seidel', parametros: { A: [[4, 1, -1], [2, 7, 1], [1, -3, 12]], b: [3, 19, 31], tol: 0.001, max_iter: 50 } },
];
const QUICK = [50, 100, 250, 500];
const CONCURRENCY = 8;

function randomJob(): CreateJobPayload {
  const base = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  if ('x0' in base.parametros) {
    return { metodo: base.metodo, parametros: { ...base.parametros, x0: +(1 + Math.random() * 2).toFixed(2) } };
  }
  return base;
}

type Phase = 'idle' | 'creating' | 'processing' | 'done';

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs" style={{ color: 'var(--ink-soft)' }}>
        <span>{label}</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>{value} / {max}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), #D4A95A)' }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: color ?? 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}>{value}</div>
    </div>
  );
}

export default function Estres() {
  const [n, setN] = useState('100');
  const [phase, setPhase] = useState<Phase>('idle');
  const [created, setCreated] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [creationMs, setCreationMs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const cancelRef = useRef(false);
  const idsRef = useRef<number[]>([]);
  const startRef = useRef<number>(0);
  const totalRef = useRef(0);

  const total = Number(n) || 0;
  const settled = done + failed;

  // Timer de elapsed en tiempo real
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  async function launch(totalN: number) {
    cancelRef.current = false;
    idsRef.current = [];
    totalRef.current = totalN;
    setCreated(0); setDone(0); setFailed(0);
    setCreationMs(null); setElapsed(0);
    setPhase('creating');

    startRef.current = Date.now();
    let idx = 0;

    async function worker() {
      while (idx < totalN && !cancelRef.current) {
        idx++;
        try {
          const job = await createJob(randomJob());
          idsRef.current.push(job.id);
        } catch { /* ignora */ }
        setCreated((c) => c + 1);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalN) }, worker));
    const cm = Date.now() - startRef.current;
    setCreationMs(cm);
    setPhase('processing');

    const idSet = new Set(idsRef.current);
    for (let p = 0; p < 25 && !cancelRef.current; p++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const all = await listJobs();
        let d = 0, f = 0;
        for (const j of all) {
          if (!idSet.has(j.id)) continue;
          if (j.estado?.toLowerCase() === 'done') d++;
          else if (j.estado?.toLowerCase() === 'failed') f++;
        }
        setDone(d); setFailed(f);
        if (d + f >= idsRef.current.length) break;
      } catch { /* sigue */ }
    }

    setPhase('done');
  }

  const throughput = creationMs && created > 0
    ? (created / (creationMs / 1000)).toFixed(1)
    : phase === 'creating' && elapsed > 200 ? (created / (elapsed / 1000)).toFixed(1) : null;
  const elapsedSec = (elapsed / 1000).toFixed(1);
  const running = phase === 'creating' || phase === 'processing';

  return (
    <div>
      <div className="mb-8 flex items-start gap-3">
        <span className="mt-1 grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          <Zap size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>Pruebas de estrés</h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Encola lotes masivos de jobs reales y mide cómo responde la cola Redis + worker. Aparecen en el Historial.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Config */}
        <section className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="mb-5 font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>Configuración de la carga</h2>

          <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>Cantidad de jobs (N)</label>
          <input value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ''))} disabled={running}
            className="mb-3 w-full rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:ring-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />

          <div className="mb-5 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} onClick={() => setN(String(q))} disabled={running}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                {q}
              </button>
            ))}
          </div>

          <button onClick={() => launch(total)} disabled={running || total <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'var(--accent)' }}>
            {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {running ? 'En ejecución...' : `Lanzar ${total || 0} jobs`}
          </button>

          <p className="mt-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
            Se crean con {CONCURRENCY} POST simultáneos y parámetros aleatorios válidos (raíces y sistemas).
          </p>
        </section>

        {/* Monitor */}
        <section className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {phase === 'idle' && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <Zap size={40} style={{ color: 'var(--ink-soft)', opacity: 0.4 }} />
              <p className="mt-3 text-sm italic" style={{ color: 'var(--ink-soft)' }}>Lanzá un lote para ver el throughput…</p>
            </div>
          )}

          {running && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span className="absolute inset-0 animate-ping rounded-full" style={{ background: 'var(--accent)', opacity: 0.15 }} />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                    {phase === 'creating' ? 'Encolando jobs…' : 'Worker procesando…'}
                  </h2>
                  <p className="font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
                    polling /api/jobs en lotes paralelos…
                  </p>
                </div>
              </div>

              <BarRow label="Encolado" value={created} max={totalRef.current} />
              <BarRow label="Procesado por el worker" value={settled} max={Math.max(idsRef.current.length, 1)} />

              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Throughput" value={throughput ? `${throughput} j/s` : '…'} color="var(--accent)" />
                <StatCard label="Tiempo de encolado" value={creationMs ? `${(creationMs / 1000).toFixed(2)} s` : `${elapsedSec} s`} />
                <StatCard label="Done" value={done} color="var(--ok)" />
                <StatCard label="Failed" value={failed} color={failed > 0 ? 'var(--bad)' : 'var(--ink-soft)'} />
              </div>

              <p className="text-xs italic" style={{ color: 'var(--ink-soft)' }}>
                Consultando el avance cada 2s… (el worker resuelve la cola de forma asíncrona)
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={22} style={{ color: 'var(--ok)' }} />
                <h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--ink)' }}>Lote completado</h2>
              </div>

              <BarRow label="Encolado" value={created} max={totalRef.current} />
              <BarRow label="Procesado por el worker" value={settled} max={Math.max(idsRef.current.length, 1)} />

              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Throughput" value={creationMs ? `${(created / (creationMs / 1000)).toFixed(1)} j/s` : '—'} color="var(--accent)" />
                <StatCard label="Tiempo encolado" value={creationMs ? `${(creationMs / 1000).toFixed(2)} s` : '—'} />
                <StatCard label="Done" value={done} color="var(--ok)" />
                <StatCard label="Failed" value={failed} color={failed > 0 ? 'var(--bad)' : 'var(--ink)'} />
              </div>

              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                Los {created} jobs están registrados en el Historial.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
