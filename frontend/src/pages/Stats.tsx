// src/pages/Stats.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { listJobs } from '../lib/api';
import type { Job } from '../types/job';
import { ALL_METHODS, methodLabel, parseJob, statusKind } from '../lib/jobUtils';

function Kpi({ label, value, color, dot }: { label: string; value: string | number; color?: string; dot?: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold" style={{ color: color ?? 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}>{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${className ?? ''}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="font-serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
      {subtitle && <p className="mb-3 text-xs" style={{ color: 'var(--ink-soft)' }}>{subtitle}</p>}
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  color: 'var(--ink)',
};

export default function Stats() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listJobs()
      .then((d) => { if (alive) setJobs(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const agg = useMemo(() => {
    const estadoCounts = { done: 0, failed: 0, running: 0, pending: 0 };
    const perMethod: Record<string, { iterSum: number; iterN: number; timeSum: number; timeN: number; done: number; conv: number }> = {};
    for (const m of ALL_METHODS) perMethod[m] = { iterSum: 0, iterN: 0, timeSum: 0, timeN: 0, done: 0, conv: 0 };

    let doneTotal = 0, convTotal = 0;

    for (const j of jobs) {
      const k = statusKind(j.estado);
      estadoCounts[k]++;
      const pm = perMethod[j.metodo];
      if (!pm) continue;
      if (k === 'done') {
        const p = parseJob(j);
        pm.done++;
        doneTotal++;
        if (p.convergio) { pm.conv++; convTotal++; }
        if (p.iteraciones > 0) { pm.iterSum += p.iteraciones; pm.iterN++; }
        if (j.tiempoEjecucionMs != null) { pm.timeSum += j.tiempoEjecucionMs; pm.timeN++; }
      }
    }

    const byMethod = ALL_METHODS.map((m) => {
      const pm = perMethod[m];
      return {
        metodo: methodLabel(m),
        iteraciones: pm.iterN ? +(pm.iterSum / pm.iterN).toFixed(1) : 0,
        tiempo: pm.timeN ? +(pm.timeSum / pm.timeN).toFixed(1) : 0,
        convergencia: pm.done ? +((pm.conv / pm.done) * 100).toFixed(1) : 0,
      };
    });

    const pie = [
      { name: 'Done', value: estadoCounts.done, color: 'var(--ok)' },
      { name: 'Failed', value: estadoCounts.failed, color: 'var(--bad)' },
      { name: 'Running', value: estadoCounts.running, color: 'var(--nav)' },
      { name: 'Pending', value: estadoCounts.pending, color: 'var(--accent)' },
    ].filter((d) => d.value > 0);

    
    return {
      total: jobs.length,
      done: estadoCounts.done,
      failed: estadoCounts.failed,
      tasa: doneTotal ? ((convTotal / doneTotal) * 100).toFixed(1) : '0',
      pie,
      byMethod,
    };
  }, [jobs]);

  return (
    <div>
      <div className="mb-8 flex items-start gap-3">
        <span className="mt-1 grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          <BarChart3 size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>Estadísticas</h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Visión agregada del rendimiento de los solvers — útil cuando hay volumen de jobs en el historial.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(178,59,59,0.1)', color: 'var(--bad)' }}>{error}</div>
      )}
      {loading && <p className="text-sm italic" style={{ color: 'var(--ink-soft)' }}>Cargando estadísticas…</p>}

      {!loading && (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total jobs" value={agg.total} />
            <Kpi label="Completados" value={agg.done} color="var(--ok)" dot="var(--ok)" />
            <Kpi label="Fallidos" value={agg.failed} color="var(--bad)" dot="var(--bad)" />
            <Kpi label="Tasa de convergencia" value={`${agg.tasa}%`} color="var(--accent)" dot="var(--accent)" />
          </div>

          {/* Gráficas */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Pie — col 1 */}
            <Panel title="Jobs por estado" subtitle="Distribución actual." className="lg:col-span-1">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={agg.pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {agg.pie.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm" style={{ color: 'var(--ink)' }}>
                {agg.pie.map((d) => {
                  const pct = agg.total > 0 ? ((d.value / agg.total) * 100).toFixed(0) : 0;
                  return (
                    <span key={d.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name} <strong>{d.value}</strong> <span style={{ color: 'var(--ink-soft)' }}>({pct}%)</span>
                    </span>
                  );
                })}
              </div>
            </Panel>

            {/* Iteraciones — col 2-3 */}
            <Panel title="Promedio de iteraciones por método" subtitle="Sólo jobs DONE." className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={agg.byMethod} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="metodo" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" angle={0} textAnchor="middle" height={30} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent-soft)' }} />
                  <Bar dataKey="iteraciones" fill="var(--accent)" radius={[6, 6, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Tiempo — col 1-2 */}
            <Panel title="Tiempo promedio por método (ms)" subtitle="Sólo jobs DONE." className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={agg.byMethod} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="metodo" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" angle={0} textAnchor="middle" height={30} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(30,58,95,0.08)' }} />
                  <Bar dataKey="tiempo" fill="var(--nav)" radius={[6, 6, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Convergencia — col 3 */}
            <Panel title="Tasa de convergencia por método" subtitle="% por método (jobs DONE)." className="lg:col-span-1">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={agg.byMethod} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} stroke="var(--border)" />
                  <YAxis type="category" dataKey="metodo" tick={{ fontSize: 10, fill: 'var(--ink-soft)' }} stroke="var(--border)" width={80} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(47,122,82,0.08)' }} formatter={(v) => [`${v}%`, 'convergencia']} />
                  <Bar dataKey="convergencia" fill="var(--ok)" radius={[0, 6, 6, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

          </div>
        </>
      )}
    </div>
  );
}