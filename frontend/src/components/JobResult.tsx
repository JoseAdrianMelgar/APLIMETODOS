import { Loader2, CheckCircle2, XCircle, Hash, Clock, Activity, TrendingDown, Sigma } from 'lucide-react';
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

/**
 * Animaciones reutilizables. Las inyectamos una sola vez via <style> al montar
 * el componente para no depender de plugins extra de Tailwind.
 */
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

function JobResult({ jobId }: JobResultProps) {
  const { job, error } = useJobPolling(jobId);

  // ----- ESTADO 1: aun no se ha creado ningun job -----
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

  // ----- ESTADO 2: cargando primera respuesta -----
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

  // ----- ESTADO 3: error de red -----
  if (error) {
    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-red-700 shadow-xl min-h-[500px] fade-in">
          <h2 className="text-xl font-bold mb-2 text-red-400 flex items-center gap-2">
            <XCircle size={20} /> Error de conexión
          </h2>
          <p className="text-slate-300">{error}</p>
          <p className="text-slate-500 text-sm mt-2">
            Verificá que la API esté corriendo en localhost:5000.
          </p>
        </div>
      </>
    );
  }

  if (!job) return null;
  const estado = job.estado.toLowerCase();

  // ----- ESTADO 4: pendiente o corriendo (polling activo) -----
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

  // ----- ESTADO 5: fallo -----
  if (estado === 'failed') {
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
            <pre className="bg-slate-900 p-3 rounded text-sm text-red-300 overflow-auto whitespace-pre-wrap border border-red-900/50">
              {job.errorMessage}
            </pre>
          )}
        </div>
      </>
    );
  }

  // ----- ESTADO 6: completado con exito -----
  if (estado === 'done') {
    let resultado: NumericResult | null = null;
    try {
      if (job.resultado) {
        resultado = JSON.parse(job.resultado);
      }
    } catch (e) {
      console.error('Error parseando resultado:', e);
    }

    // ----- Construir data para Recharts -----
    // Mapea cada iteracion a { iter, error } para el grafico de convergencia.
    const chartData = (resultado?.iteraciones ?? []).map((it) => {
      const errVal =
        typeof it.error === 'number'
          ? it.error
          : typeof it.error_maximo === 'number'
            ? it.error_maximo
            : 0;
      return {
        iter: it.iteracion,
        error: Number(errVal.toFixed(6)),
      };
    });

    const tolerancia = resultado?.tolerancia;

    // ----- Formateo de la raiz (soporta numeros y strings - complejo de Muller) -----
    const formatRaiz = (raiz: number | string | undefined): string => {
      if (raiz === undefined || raiz === null) return '—';
      if (typeof raiz === 'number') return raiz.toString();
      return raiz; // string como "1j" o "(1+2j)"
    };

    return (
      <>
        <style>{animationStyles}</style>
        <div className="bg-slate-800 p-6 rounded-xl border border-green-700 shadow-xl min-h-[500px] fade-in-up">

          {/* ----- HEADER ----- */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-green-400 flex items-center gap-2">
              <CheckCircle2 size={20} /> Job #{job.id} completado
            </h2>
            <span className="text-xs bg-green-700 text-white px-2 py-1 rounded font-mono badge-glow">
              {job.estado}
            </span>
          </div>

          {/* ----- METRICAS ----- */}
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

          {/* ----- RAIZ (resultado principal) ----- */}
          {resultado?.raiz !== undefined && (
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

          {/* ----- SOLUCION (vector, para Gauss-Seidel y similares) ----- */}
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

          {/* ----- GRAFICA DE CONVERGENCIA (RECHARTS) ----- */}
          {chartData.length > 0 && (
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
                  {/* Linea de tolerancia para visualizar el umbral de convergencia */}
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
          )}

          {/* ----- TABLA DE ITERACIONES ----- */}
          {resultado?.iteraciones && resultado.iteraciones.length > 0 && (
            <div className="fade-in-up stagger-4">
              <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                Tabla de iteraciones
              </h3>
              <div className="bg-slate-900 rounded-lg overflow-hidden max-h-72 overflow-y-auto border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-300 font-semibold">i</th>
                      <th className="px-3 py-2 text-left text-slate-300 font-semibold">xᵢ</th>
                      <th className="px-3 py-2 text-left text-slate-300 font-semibold">error %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.iteraciones.map((it) => {
                      // El xi puede venir como numero (escalar), string (Muller complejo) o array (Gauss-Seidel)
                      let xi: string = '—';
                      if (typeof it.xi_nuevo === 'number') {
                        xi = it.xi_nuevo.toFixed(6);
                      } else if (typeof it.xi_nuevo === 'string') {
                        xi = it.xi_nuevo;
                      } else if (Array.isArray(it.x_nuevo)) {
                        xi = `[${it.x_nuevo.map((v) => v.toFixed(4)).join(', ')}]`;
                      }

                      const err =
                        typeof it.error === 'number'
                          ? it.error.toFixed(4)
                          : typeof it.error_maximo === 'number'
                            ? it.error_maximo.toFixed(4)
                            : '—';

                      return (
                        <tr
                          key={it.iteracion}
                          className="border-t border-slate-800 transition-colors hover:bg-slate-800/60"
                        >
                          <td className="px-3 py-2 text-slate-400 font-mono">{it.iteracion}</td>
                          <td className="px-3 py-2 font-mono text-slate-200">{xi}</td>
                          <td className="px-3 py-2 font-mono text-cyan-300">{err}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----- MENSAJE FINAL ----- */}
          {resultado?.mensaje && (
            <p className="text-slate-500 text-xs mt-4 italic">{resultado.mensaje}</p>
          )}
        </div>
      </>
    );
  }

  return null;
}

export default JobResult;
