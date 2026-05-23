// src/pages/Historial.tsx
// Monitoreo de jobs en tiempo real: tabla con filtros por estado y metodo,
// busqueda por ID, contadores y auto-refresh cada 5s (consume GET /api/jobs).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, Activity, Grid3X3 } from 'lucide-react';
import { listJobs } from '../lib/api';
import type { Job } from '../types/job';
import {
  ALL_METHODS,
  fmtDate,
  methodLabel,
  parseJob,
  statusKind,
  type StatusKind,
} from '../lib/jobUtils';

const ESTADOS: { key: string; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'done', label: 'Done' },
  { key: 'running', label: 'Running' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
];

// Traduce el estado de la API al español para mostrar en el badge
function badgeLabel(estado: string): string {
  const map: Record<string, string> = {
    done: 'Completado',
    failed: 'Fallido',
    running: 'Ejecutando',
    pending: 'Pendiente',
  };
  return map[estado.toLowerCase()] ?? estado;
}

// Icono segun tipo de metodo
function MethodIcon({ metodo }: { metodo: string }) {
  const m = metodo.toLowerCase();
  const isMatrix = m.includes('gauss') || m.includes('jordan') || m.includes('seidel');
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
    >
      {isMatrix ? <Grid3X3 size={13} /> : <Activity size={13} />}
    </span>
  );
}

function badgeStyle(kind: StatusKind): { bg: string; fg: string; pulse?: boolean } {
  switch (kind) {
    case 'done':
      return { bg: 'rgba(47,122,82,0.18)', fg: '#2F7A52' };
    case 'failed':
      return { bg: 'rgba(178,59,59,0.13)', fg: '#B23B3B' };
    case 'running':
      return { bg: 'rgba(30,58,95,0.12)', fg: 'var(--nav)', pulse: true };
    default:
      return { bg: 'var(--accent-soft)', fg: 'var(--accent)' };
  }
}

function StatusBadge({ estado }: { estado: string }) {
  const kind = statusKind(estado);
  const s = badgeStyle(kind);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${s.pulse ? 'animate-pulse' : ''}`}
        style={{ background: s.fg }}
      />
      {badgeLabel(estado)}
    </span>
  );
}

function Counter({ label, value, color, dot }: { label: string; value: number; color?: string; dot?: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
     <div
  className="mt-1 text-3xl font-bold"
  style={{ color: color ?? 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}
>
  {value}
</div>
    </div>
  );
}

export default function Historial() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [estado, setEstado] = useState('todos');
  const [metodo, setMetodo] = useState('todos');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await listJobs();
      setJobs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000); // auto-refresh asincrono
    return () => clearInterval(id);
  }, [load]);

  const counts = useMemo(() => {
    let done = 0, failed = 0, activos = 0;
    for (const j of jobs) {
      const k = statusKind(j.estado);
      if (k === 'done') done++;
      else if (k === 'failed') failed++;
      else activos++;
    }
    return { total: jobs.length, done, failed, activos };
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (estado !== 'todos' && statusKind(j.estado) !== estado) return false;
      if (metodo !== 'todos' && j.metodo !== metodo) return false;
      if (query.trim() && !String(j.id).includes(query.trim())) return false;
      return true;
    });
  }, [jobs, estado, metodo, query]);

  return (
    <div>
      {/* encabezado */}
      <div className="mb-8 flex items-start gap-3">
        <span className="mt-1 grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          <History size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>Historial de jobs</h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Monitorea jobs en tiempo real. Polling cada 5s; los estados activos se actualizan automáticamente.
          </p>
        </div>
      </div>

      {/* contadores */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Counter label="Total" value={counts.total} />
        <Counter label="Completados" value={counts.done} color="var(--ok)" dot="var(--ok)" />
        <Counter label="Activos" value={counts.activos} dot="var(--ink-soft)" />
        <Counter label="Fallidos" value={counts.failed} color="var(--bad)" dot="var(--bad)" />
      </div>

      {/* filtros */}
      <div className="mb-6 rounded-2xl p-4 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por ID"
              className="rounded-full py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </div>

          <FilterGroup label="Estado" options={ESTADOS} value={estado} onChange={setEstado} />
          <FilterGroup
            label="Método"
            options={[{ key: 'todos', label: 'Todos' }, ...ALL_METHODS.map((m) => ({ key: m, label: methodLabel(m) }))]}
            value={metodo}
            onChange={setMetodo}
          />

          <button
            onClick={load}
            className="ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refrescar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(178,59,59,0.1)', color: 'var(--bad)' }}>
          {error}
        </div>
      )}

      {/* tabla */}
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr style={{ color: 'var(--ink-soft)' }}>
                <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs">ID</th>
                <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs">Método</th>
                <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs">Resumen</th>
                <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs">Estado</th>
                <th className="px-5 py-3 text-right font-semibold uppercase tracking-wider text-xs">Tiempo</th>
                <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm italic" style={{ color: 'var(--ink-soft)' }}>
                    {loading ? 'Cargando jobs…' : 'No hay jobs que coincidan con los filtros.'}
                  </td>
                </tr>
              )}
              {filtered.map((j) => {
                const p = parseJob(j);
                return (
                  <tr key={j.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--ink)' }}>
                    <td className="px-5 py-3 font-mono font-semibold">#{j.id}</td>
                    <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--ink)' }}>
                            <MethodIcon metodo={j.metodo} />
                            {methodLabel(j.metodo)}
                          </span>
                        </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>{p.resumen || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge estado={j.estado} /></td>
                    <td className="px-5 py-3 text-right font-mono">{j.tiempoEjecucionMs != null ? `${j.tiempoEjecucionMs} ms` : '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>{fmtDate(j.fechaCreacion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>{label}</div>
      <div className="flex flex-wrap gap-1 rounded-full p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200"
              style={{ background: active ? 'var(--nav)' : 'transparent', color: active ? 'var(--nav-ink)' : 'var(--ink-soft)' }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
