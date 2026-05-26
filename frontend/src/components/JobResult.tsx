import { Loader2, CheckCircle2, XCircle, Hash, Clock, Activity, TrendingDown, Sigma, AlertTriangle } from 'lucide-react';
import { useJobPolling } from '../hooks/useJobPolling';
import type { NumericResult } from '../types/job';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface JobResultProps {
  jobId: number | null;
}

const animationStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35); }
    50%      { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
  }
  .fade-in-up   { animation: fadeInUp 0.45s ease-out forwards; }
  .fade-in      { animation: fadeIn 0.6s ease-out forwards; }
  .badge-glow   { animation: glow 2.4s ease-in-out infinite; }
  .stagger-1    { animation-delay: 0.05s; opacity: 0; }
  .stagger-2    { animation-delay: 0.15s; opacity: 0; }
  .stagger-3    { animation-delay: 0.25s; opacity: 0; }
  .stagger-4    { animation-delay: 0.35s; opacity: 0; }
`;

function parseResultado(raw: string | null): NumericResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error parseando resultado:', e);
    return null;
  }
}

/** Gráfica de convergencia (error % vs iteración). */
function ConvergenceChart({ resultado }: { resultado: NumericResult }) {
  const chartData = (resultado.iteraciones ?? []).map((it) => {
    const errVal =
      typeof it.error === 'number'
        ? it.error
        : typeof it.error_maximo === 'number'
          ? it.error_maximo
          : 0;
    return { iter: it.iteracion, error: Number(errVal.toFixed(6)) };
  });

  if (chartData.length === 0) return null;

  // bug 2: un solo punto no dibuja línea — mostrar resumen textual en su lugar
  if (chartData.length === 1) {
    return (
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-4 fade-in-up stagger-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
          <TrendingDown size={14} className="text-cyan-400" />
          Convergencia (error % vs iteración)
        </h3>
        <p className="text-slate-500 text-xs mb-3">
          Solo una iteración completada — no hay curva que graficar.
        </p>
        <div className="flex items-center gap-6 bg-slate-800 rounded-lg p-3">
          <div>
            <p className="text-slate-500 text-xs">Iteración</p>
            <p className="text-slate-200 font-mono text-lg">{chartData[0].iter}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Error %</p>
            <p className="text-cyan-300 font-mono text-lg">{chartData[0].error}%</p>
          </div>
        </div>
      </div>
    );
  }

  const tolerancia = resultado.tolerancia;

  return (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-4 fade-in-up stagger-4">
      <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
        <TrendingDown size={14} className="text-cyan-400" />
        Convergencia (error % vs iteración)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="iter"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{
              value: 'Iteración',
              position: 'insideBottom',
              offset: -4,
              fill: '#64748b',
              fontSize: 12,
            }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{
              value: 'Error %',
              angle: -90,
              position: 'insideLeft',
              fill: '#64748b',
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#e2e8f0',
            }}
            labelStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
            formatter={(value) => [`${value}%`, 'Error']}
            labelFormatter={(label) => `Iteración ${label}`}
          />
          {typeof tolerancia === 'number' && tolerancia > 0 && (
            <ReferenceLine
              y={tolerancia}
              stroke="#22c55e"
              strokeDasharray="4 4"
              label={{
                value: `tol = ${tolerancia}%`,
                fill: '#22c55e',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="error"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ fill: '#22d3ee', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#67e8f9' }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tabla de iteraciones (parciales o completas). */
function IterationsTable({ resultado, method }: { resultado: NumericResult; method: string }) {
  if (!resultado.iteraciones || resultado.iteraciones.length === 0) return null;

  const iters = resultado.iteraciones as any[];

  /* ── helpers ── */
  const fmt = (n: number | null | undefined, d = 8): string => {
    if (n == null) return '—';
    const abs = Math.abs(n);
    if (abs !== 0 && abs < 1e-4) return n.toExponential(4);
    return n.toFixed(d);
  };
  const fmtErr = (n: number | null | undefined): string =>
    n == null ? '—' : `${Math.abs(n).toFixed(6)}%`;
  const errColor = (n: number | null | undefined): string => {
    if (n == null) return 'text-slate-400';
    if (n < 0.01) return 'text-emerald-400 font-semibold';
    if (n < 1)    return 'text-lime-400';
    if (n < 10)   return 'text-amber-400';
    return 'text-rose-400';
  };

  /* ── estilos compartidos ── */
  const TH = 'px-3 py-2 text-xs font-semibold text-slate-300 text-right';
  const THL = 'px-3 py-2 text-xs font-semibold text-slate-300 text-left';
  const TD = 'px-3 py-2 font-mono text-xs text-slate-200 text-right';
  const TDC = 'px-3 py-2 font-mono text-xs text-cyan-300 text-right';
  const TDI = 'px-3 py-2 font-mono text-xs text-slate-400 text-left';
  const ROW = 'border-t border-slate-800 hover:bg-slate-800/60 transition-colors';

  /* ── tablas por método ── */
  const renderContent = () => {
    // ── NEWTON-RAPHSON ──────────────────────────────────────────────
    // Columnas: i | xᵢ | f(xᵢ) | f′(xᵢ) | xᵢ₊₁ | εₐ (%)
    if (method === 'newton-raphson') {
      return (
        <>
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              <th className={THL}>i</th>
              <th className={TH}>xᵢ</th>
              <th className={TH}>f(xᵢ)</th>
              <th className={TH}>f′(xᵢ)</th>
              <th className={TH}>xᵢ₊₁</th>
              <th className={TH}>εₐ (%)</th>
            </tr>
          </thead>
          <tbody>
            {iters.map((it) => {
              const err = it.error ?? null;
              return (
                <tr key={it.iteracion} className={ROW}>
                  <td className={TDI}>{it.iteracion}</td>
                  <td className={TD}>{fmt(it.xi_anterior ?? it.xi ?? it.xi_actual)}</td>
                  <td className={TD}>{fmt(it.f_xi ?? it.fxi ?? it.f_anterior)}</td>
                  <td className={TD}>{fmt(it.f_prima ?? it.derivada ?? it.fpxi)}</td>
                  <td className={TDC}>{fmt(it.xi_nuevo)}</td>
                  <td className={`${TH} ${errColor(err)}`}>{fmtErr(err)}</td>
                </tr>
              );
            })}
          </tbody>
        </>
      );
    }

    // ── SECANTE ─────────────────────────────────────────────────────
    // Columnas: i | xᵢ₋₁ | xᵢ | f(xᵢ) | xᵢ₊₁ | εₐ (%)
    if (method === 'secante') {
      return (
        <>
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              <th className={THL}>i</th>
              <th className={TH}>xᵢ₋₁</th>
              <th className={TH}>xᵢ</th>
              <th className={TH}>f(xᵢ)</th>
              <th className={TH}>xᵢ₊₁</th>
              <th className={TH}>εₐ (%)</th>
            </tr>
          </thead>
          <tbody>
            {iters.map((it) => {
              const fxi = it.paso_2_evaluar_funcion_actual?.resultado ?? null;
              const err = it.error ?? null;
              return (
                <tr key={it.iteracion} className={ROW}>
                  <td className={TDI}>{it.iteracion}</td>
                  <td className={TD}>{fmt(it.xi_anterior)}</td>
                  <td className={TD}>{fmt(it.xi_actual)}</td>
                  <td className={TD}>{fmt(fxi)}</td>
                  <td className={TDC}>{fmt(it.xi_nuevo)}</td>
                  <td className={`${TH} ${errColor(err)}`}>{fmtErr(err)}</td>
                </tr>
              );
            })}
          </tbody>
        </>
      );
    }

    // ── MÜLLER ──────────────────────────────────────────────────────
    // Columnas: i | x₀ | x₁ | x₂ | f(x₂) | xᵣ | εₐ (%)
    if (method === 'muller') {
      return (
        <>
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              <th className={THL}>i</th>
              <th className={TH}>x₀</th>
              <th className={TH}>x₁</th>
              <th className={TH}>x₂</th>
              <th className={TH}>f(x₂)</th>
              <th className={TH}>xᵣ (nueva raíz)</th>
              <th className={TH}>εₐ (%)</th>
            </tr>
          </thead>
          <tbody>
            {iters.map((it) => {
              const err = it.error ?? null;
              return (
                <tr key={it.iteracion} className={ROW}>
                  <td className={TDI}>{it.iteracion}</td>
                  <td className={TD}>{fmt(it.x0 ?? it.x_0)}</td>
                  <td className={TD}>{fmt(it.x1 ?? it.x_1)}</td>
                  <td className={TD}>{fmt(it.x2 ?? it.x_2)}</td>
                  <td className={TD}>{fmt(it.f_x2 ?? it.fx2 ?? it.f_xi)}</td>
                  <td className={TDC}>{fmt(it.xi_nuevo ?? it.xr)}</td>
                  <td className={`${TH} ${errColor(err)}`}>{fmtErr(err)}</td>
                </tr>
              );
            })}
          </tbody>
        </>
      );
    }

    // ── GAUSS-SEIDEL ─────────────────────────────────────────────────
    // Columnas: Iteración | x₁ | x₂ | x₃ | Error máx. (%)
    // Dinámico: detecta cuántas variables tiene x_nuevo
    if (method === 'gauss-seidel') {
      const nVars = Array.isArray(iters[0]?.x_nuevo) ? iters[0].x_nuevo.length : 3;
      const subs  = ['₁','₂','₃','₄','₅','₆'];
      return (
        <>
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              <th className={THL}>Iteración</th>
              {Array.from({ length: nVars }, (_, i) => (
                <th key={i} className={TH}>x{subs[i] ?? i + 1}</th>
              ))}
              <th className={TH}>Error máx. (%)</th>
            </tr>
          </thead>
          <tbody>
            {iters.map((it) => {
              const xNew: number[] = Array.isArray(it.x_nuevo) ? it.x_nuevo : [];
              const err = it.error_maximo ?? null;
              return (
                <tr key={it.iteracion} className={ROW}>
                  <td className={TDI}>{it.iteracion}</td>
                  {Array.from({ length: nVars }, (_, i) => (
                    <td key={i} className={TDC}>{fmt(xNew[i] ?? null)}</td>
                  ))}
                  <td className={`${TH} ${errColor(err)}`}>{fmtErr(err)}</td>
                </tr>
              );
            })}
          </tbody>
        </>
      );
    }

    // ── GAUSS / GAUSS-JORDAN ─────────────────────────────────────────
    // Métodos directos. Cuando el backend guarde X1,X2,X3 en x_nuevo,
    // aparecen automáticamente. Mientras tanto: mensaje informativo.
    if (method === 'gauss' || method === 'gauss-jordan') {
      const hasVec = iters.some((it) => Array.isArray(it.x_nuevo) && it.x_nuevo.length > 0);
      const subs   = ['₁','₂','₃','₄','₅','₆'];
      const nVars  = hasVec
        ? (iters.find((it) => Array.isArray(it.x_nuevo))?.x_nuevo?.length ?? 3)
        : 3;

      if (!hasVec) {
        return (
          <tbody>
            <tr>
              <td colSpan={5} className="px-6 py-6 text-center">
                <p className="text-slate-500 text-sm">Método directo — sin iteraciones de convergencia.</p>
                <p className="text-slate-600 text-xs mt-1">
                  El vector solución aparece en la sección "Vector solución" de arriba.
                </p>
              </td>
            </tr>
          </tbody>
        );
      }

      return (
        <>
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              <th className={THL}>Paso</th>
              {Array.from({ length: nVars }, (_, i) => (
                <th key={i} className={TH}>x{subs[i] ?? i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {iters.map((it) => {
              const xNew: number[] = Array.isArray(it.x_nuevo) ? it.x_nuevo : [];
              return (
                <tr key={it.iteracion} className={ROW}>
                  <td className={TDI}>{it.iteracion}</td>
                  {Array.from({ length: nVars }, (_, i) => (
                    <td key={i} className={TDC}>{fmt(xNew[i] ?? null)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </>
      );
    }

    // ── fallback ─────────────────────────────────────────────────────
    return (
      <tbody>
        <tr>
          <td colSpan={5} className="px-3 py-4 text-center text-slate-500 text-sm">
            Método no reconocido: <code className="font-mono">{method}</code>
          </td>
        </tr>
      </tbody>
    );
  };

  return (
    <div className="fade-in-up stagger-4">
      <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
        <Activity size={14} className="text-cyan-400" />
        Tabla de iteraciones
      </h3>
      <div className="bg-slate-900 rounded-lg overflow-hidden max-h-72 overflow-y-auto border border-slate-700">
        <table className="w-full text-sm">
          {renderContent()}
        </table>
      </div>
    </div>
  );
}


function JobResult({ jobId }: JobResultProps) {
  const { job, error } = useJobPolling(jobId);

  // ----- sin job -----
  if (!jobId) {
    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex items-center justify-center min-h-[500px] fade-in">
          <div className="text-center">
            <Sigma className="text-slate-600 mx-auto mb-3" size={36} />
            <p className="text-slate-500 italic">
              Aquí se mostrará la gráfica de convergencia asíncrona...
            </p>
          </div>
        </div>
      </>
    );
  }

  // ----- cargando primera respuesta -----
  if (!job && !error) {
    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col items-center justify-center min-h-[500px] fade-in">
          <Loader2 className="animate-spin text-cyan-400 mb-3" size={32} />
          <p className="text-slate-400">Conectando con el job #{jobId}...</p>
        </div>
      </>
    );
  }

  // ----- error de red (bug 10: muestra info útil en vez de pantalla en blanco) -----
  if (error) {
    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-red-700 shadow-xl min-h-[500px] fade-in">
          <h2 className="text-xl font-bold mb-2 text-red-400 flex items-center gap-2">
            <XCircle size={20} /> Error de conexión
          </h2>
          <p className="text-slate-300 mb-2">{error}</p>
          <p className="text-slate-500 text-sm">
            Verificá que la API esté corriendo en localhost:5000 y que los contenedores estén activos.
          </p>
        </div>
      </>
    );
  }

  if (!job) return null;
  const estado = job.estado.toLowerCase();

  // ----- pending / running -----
  if (estado === 'pending' || estado === 'running') {
    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-cyan-700 shadow-xl min-h-[500px] flex flex-col items-center justify-center fade-in">
          <div className="relative mb-4">
            <Loader2 className="animate-spin text-cyan-400" size={48} />
            <div className="absolute inset-0 rounded-full animate-ping bg-cyan-400/20" />
          </div>
          <h2 className="text-xl font-bold text-cyan-400 mb-2">
            Procesando Job #{job.id}
          </h2>
          <p className="text-slate-300 mb-1">
            Estado: <span className="font-mono bg-slate-900 px-2 py-0.5 rounded">{job.estado}</span>
          </p>
          <p className="text-slate-500 text-sm animate-pulse">Polling cada 5 segundos...</p>
        </div>
      </>
    );
  }

  // ----- failed -----
  if (estado === 'failed') {
    const resultado = parseResultado(job.resultado);
    const hayParciales = !!resultado?.iteraciones?.length;

    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-red-700 shadow-xl min-h-[500px] fade-in">
          <h2 className="text-xl font-bold mb-3 text-red-400 flex items-center gap-2">
            <XCircle size={20} /> Job #{job.id} falló
          </h2>
          <p className="text-slate-300 mb-3">
            Estado: <span className="font-mono">{job.estado}</span>
          </p>
          {job.errorMessage && (
            <pre className="bg-slate-900 p-3 rounded text-sm text-red-300 overflow-auto whitespace-pre-wrap border border-red-900/50 mb-4">
              {job.errorMessage}
            </pre>
          )}

          {hayParciales && resultado && (
            <>
              <div className="bg-amber-900/30 border border-amber-700/60 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-300 text-sm font-semibold">
                    El job falló, pero se muestran las iteraciones que alcanzó a calcular.
                  </p>
                  {resultado.mensaje && (
                    <p className="text-amber-200/80 text-xs mt-1">{resultado.mensaje}</p>
                  )}
                </div>
              </div>
              <ConvergenceChart resultado={resultado} />
              <IterationsTable resultado={resultado} method={job.metodo} />
            </>
          )}
        </div>
      </>
    );
  }

  // ----- done -----
  if (estado === 'done') {
    const resultado = parseResultado(job.resultado);
    const noConvergio = resultado ? resultado.convergio === false : false;
    const sinIteraciones = !resultado?.iteraciones?.length;

    const formatRaiz = (raiz: number | string | undefined): string => {
      if (raiz === undefined || raiz === null) return '—';
      if (typeof raiz === 'number') return raiz.toString();
      return raiz;
    };

    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-green-700 shadow-xl min-h-[500px] fade-in-up">

          {/* HEADER */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-green-400 flex items-center gap-2">
              <CheckCircle2 size={20} /> Job #{job.id} completado
            </h2>
            <span className="text-xs bg-green-700 text-white px-2 py-1 rounded font-mono badge-glow">
              {job.estado}
            </span>
          </div>

          {/*
            bug 1: el banner ahora muestra el mensaje EXACTO del worker.
            Así el usuario entiende por qué la tabla tiene N filas pero el
            error ocurrió en la iteración N+1 (ej. "Derivada cercana a cero
            en iteracion 2" con 1 fila en la tabla).
          */}
          {noConvergio && (
            <div className="bg-amber-900/30 border border-amber-700/60 rounded-lg p-3 mb-4 flex items-start gap-2 fade-in-up">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-300 text-sm font-semibold">El método no convergió.</p>
                {resultado?.mensaje ? (
                  <p className="text-amber-200/80 text-xs mt-1">{resultado.mensaje}</p>
                ) : sinIteraciones ? (
                  <p className="text-amber-200/80 text-xs mt-1">
                    El método se detuvo antes de generar iteraciones.
                  </p>
                ) : (
                  <p className="text-amber-200/80 text-xs mt-1">
                    Se alcanzó el máximo de iteraciones. Abajo se muestran los datos parciales.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* MÉTRICAS */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-slate-900 p-3 rounded-lg fade-in-up stagger-1 transition-colors hover:bg-slate-900/70">
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <Hash size={12} /> Método
              </p>
              <p className="text-slate-200 font-mono">{job.metodo}</p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg fade-in-up stagger-2 transition-colors hover:bg-slate-900/70">
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <Clock size={12} /> Tiempo
              </p>
              <p className="text-slate-200">{job.tiempoEjecucionMs} ms</p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg fade-in-up stagger-3 transition-colors hover:bg-slate-900/70">
              <p className="text-slate-500 text-xs">Convergió</p>
              <p className={resultado?.convergio ? 'text-green-400' : 'text-red-400'}>
                {resultado?.convergio ? '✓ Sí' : '✗ No'}
              </p>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg fade-in-up stagger-4 transition-colors hover:bg-slate-900/70">
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <Activity size={12} /> Iteraciones
              </p>
              <p className="text-slate-200">{resultado?.total_iteraciones ?? '—'}</p>
            </div>
          </div>

          {/* RAÍZ */}
          {resultado?.raiz !== undefined && resultado?.raiz !== null && (
            <div className="bg-slate-900 p-4 rounded-lg border border-cyan-700 mb-4 fade-in-up stagger-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-500 text-xs">
                  {resultado.raiz_es_compleja ? 'Raíz compleja aproximada' : 'Raíz aproximada'}
                </p>
                {resultado.raiz_es_compleja && (
                  <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded font-mono">
                    ℂ complejo
                  </span>
                )}
              </div>
              <p className="text-3xl font-mono text-cyan-400 break-all">
                {formatRaiz(resultado.raiz)}
              </p>
            </div>
          )}

          {/* SOLUCIÓN VECTORIAL (Gauss-Seidel y futuros sistemas) */}
          {resultado?.solucion && (
            <div className="bg-slate-900 p-4 rounded-lg border border-cyan-700 mb-4 fade-in-up stagger-4">
              <p className="text-slate-500 text-xs mb-2">Vector solución</p>
              <div className="space-y-1 font-mono text-cyan-400">
                {resultado.solucion.map((val, i) => (
                  <p key={i}>x{i + 1} = {val}</p>
                ))}
              </div>
            </div>
          )}

          {/* GRÁFICA + TABLA */}
          {resultado && <ConvergenceChart resultado={resultado} />}
          {resultado && <IterationsTable resultado={resultado} method={job.metodo} />}

          {/*
            Mensaje al fondo: solo cuando convergió.
            Cuando NO convergió ya se muestra en el banner de arriba
            para evitar repetición y dar contexto justo al lado de la tabla.
          */}
          {resultado?.mensaje && resultado?.convergio && (
            <p className="text-slate-500 text-xs mt-4 italic">{resultado.mensaje}</p>
          )}
        </div>
      </>
    );
  }

  return null;
}

export default JobResult;