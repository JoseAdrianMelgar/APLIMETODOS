import { useState, useEffect } from 'react';
import axios from 'axios';
import { useJobPolling } from '../hooks/useJobPolling';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle,
  Grid3x3, ArrowRight, Hash, Clock, Activity
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Metodo = 'gauss' | 'gauss-seidel' | 'gauss-jordan';

interface PasoMatriz {
  iteracion: number;
  tipo: 'pivoteo' | 'eliminacion' | 'normalizacion' | 'sustitucion_regresiva' | 'solucion';
  descripcion: string;
  matriz_antes?: number[][];
  matriz_despues?: number[][];
  fila_cambiada?: number;
  filas_cambiadas?: number[];
  x_nuevo?: number[];
  solucion_parcial?: number[];
}

interface PasoSeidel {
  iteracion: number;
  x_nuevo?: number[];
  error_maximo?: number;
}

interface ResultadoSistema {
  solucion?: number[];
  iteraciones?: (PasoMatriz | PasoSeidel)[];
  total_iteraciones?: number;
  convergio?: boolean;
  mensaje?: string;
  matriz_aumentada_inicial?: number[][];
  matriz_aumentada_final?: number[][];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseNum = (s: string) => parseFloat(s.trim().replace(',', '.'));
const esValido = (s: string) => Number.isFinite(parseNum(s));
const makeMatrix = (r: number, c: number) =>
  Array.from({ length: r }, () => Array<string>(c).fill('0'));

const TIPO_COLOR: Record<string, string> = {
  pivoteo:              'text-purple-300 bg-purple-900/30',
  normalizacion:        'text-blue-300   bg-blue-900/30',
  eliminacion:          'text-cyan-300   bg-cyan-900/30',
  sustitucion_regresiva:'text-amber-300  bg-amber-900/30',
  solucion:             'text-green-300  bg-green-900/30',
};

// ─── Sub-componente: Visualizador de Matriz Aumentada ─────────────────────────

function MatrizAumentada({
  M, n, filaDestacada,
}: { M: number[][]; n: number; filaDestacada?: number | number[] }) {
  const destacadas = new Set(
    Array.isArray(filaDestacada) ? filaDestacada : filaDestacada != null ? [filaDestacada] : []
  );
  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono border-collapse">
        <tbody>
          {M.map((fila, i) => (
            <tr
              key={i}
              className={destacadas.has(i) ? 'bg-amber-900/40' : ''}
            >
              <td className="pr-1 text-slate-500 select-none">F{i + 1}</td>
              <td className="px-1 text-slate-400 select-none">[</td>
              {fila.slice(0, n).map((v, j) => (
                <td key={j} className="px-2 py-0.5 text-slate-200 text-right min-w-[64px]">
                  {v.toFixed(4)}
                </td>
              ))}
              <td className="px-2 text-slate-500 select-none">|</td>
              <td className="px-2 py-0.5 text-cyan-300 text-right min-w-[64px]">
                {fila[n].toFixed(4)}
              </td>
              <td className="pl-1 text-slate-400 select-none">]</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-componente: Pasos de Gauss / Gauss-Jordan ────────────────────────────

function PasosMatriz({ resultado, n }: { resultado: ResultadoSistema; n: number }) {
  const [abierto, setAbierto] = useState<number | null>(null);

  if (!resultado.iteraciones?.length) return null;

  const pasos = resultado.iteraciones as PasoMatriz[];

  return (
    <div className="mt-4">
      <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
        <Activity size={14} className="text-cyan-400" />
        Paso a paso ({pasos.length} operaciones elementales)
      </h3>
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {pasos.map((paso) => {
          const colorClass = TIPO_COLOR[paso.tipo] ?? 'text-slate-300 bg-slate-800';
          const isOpen = abierto === paso.iteracion;
          const filaDestacada = paso.fila_cambiada != null
            ? paso.fila_cambiada
            : paso.filas_cambiadas;

          return (
            <div key={paso.iteracion} className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setAbierto(isOpen ? null : paso.iteracion)}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-slate-700/50 transition-colors"
              >
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${colorClass}`}>
                  {paso.tipo.replace('_', ' ')}
                </span>
                <span className="text-sm text-slate-300 flex-1">{paso.descripcion}</span>
                <span className="text-slate-500 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && paso.matriz_despues && (
                <div className="p-3 bg-slate-900/60 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2">Matriz después de la operación:</p>
                  <MatrizAumentada
                    M={paso.matriz_despues}
                    n={n}
                    filaDestacada={filaDestacada}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-componente: Tabla e iteraciones de Gauss-Seidel ─────────────────────

function PasosSeidel({ resultado }: { resultado: ResultadoSistema }) {
  if (!resultado.iteraciones?.length) return null;
  const pasos = resultado.iteraciones as PasoSeidel[];

  const chartData = pasos.map((p) => ({
    iter: p.iteracion,
    error: typeof p.error_maximo === 'number' ? Number(p.error_maximo.toFixed(6)) : 0,
  }));

  return (
    <div className="mt-4 space-y-4">
      {/* Gráfica */}
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Error máximo vs. Iteración</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="iter" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              labelFormatter={(l) => `Iteración ${l}`}
              formatter={(v) => [`${v}%`, 'Error máx.']}
            />
            <Line type="monotone" dataKey="error" stroke="#22d3ee" strokeWidth={2}
              dot={{ fill: '#22d3ee', r: 3 }} animationDuration={600} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden max-h-56 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead className="bg-slate-800 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-slate-300">i</th>
              <th className="px-3 py-2 text-left text-slate-300">Vector x</th>
              <th className="px-3 py-2 text-left text-slate-300">Error máx. %</th>
            </tr>
          </thead>
          <tbody>
            {pasos.map((p) => (
              <tr key={p.iteracion} className="border-t border-slate-800 hover:bg-slate-800/50">
                <td className="px-3 py-1.5 text-slate-400">{p.iteracion}</td>
                <td className="px-3 py-1.5 text-slate-200">
                  [{(p.x_nuevo ?? []).map((v) => v.toFixed(4)).join(', ')}]
                </td>
                <td className="px-3 py-1.5 text-cyan-300">
                  {typeof p.error_maximo === 'number' ? p.error_maximo.toFixed(4) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-componente: Panel de resultado ──────────────────────────────────────

function ResultadoSistemaPanel({
  jobId, method, n,
}: { jobId: number; method: Metodo; n: number }) {
  const { job, error } = useJobPolling(jobId);

  if (error) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-red-700 shadow-xl">
        <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-2">
          <XCircle size={18} /> Error de conexión
        </h2>
        <p className="text-slate-300 text-sm">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  const estado = job.estado.toLowerCase();

  if (estado === 'pending' || estado === 'running') {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-cyan-700 shadow-xl flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-cyan-400 mb-3" size={40} />
        <p className="text-cyan-400 font-bold">Procesando Job #{job.id}</p>
        <p className="text-slate-500 text-sm mt-1 animate-pulse">
          Estado: {job.estado} — polling cada 5 s...
        </p>
      </div>
    );
  }

  if (estado === 'failed') {
    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-red-700 shadow-xl">
        <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
          <XCircle size={18} /> Job #{job.id} falló
        </h2>
        {job.errorMessage && (
          <pre className="bg-slate-900 p-3 rounded text-sm text-red-300 whitespace-pre-wrap border border-red-900/50">
            {job.errorMessage}
          </pre>
        )}
      </div>
    );
  }

  if (estado === 'done') {
    let resultado: ResultadoSistema | null = null;
    try { resultado = job.resultado ? JSON.parse(job.resultado) : null; } catch { resultado = null; }

    const esSistemaDirecto = method === 'gauss' || method === 'gauss-jordan';

    return (
      <div className="bg-slate-800 p-6 rounded-xl border border-green-700 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
            <CheckCircle2 size={18} /> Job #{job.id} completado
          </h2>
          <span className="text-xs bg-green-700 text-white px-2 py-1 rounded font-mono">
            {job.estado}
          </span>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="bg-slate-900 p-2 rounded-lg">
            <p className="text-slate-500 flex items-center gap-1"><Hash size={10} /> Método</p>
            <p className="text-slate-200 font-mono">{job.metodo}</p>
          </div>
          <div className="bg-slate-900 p-2 rounded-lg">
            <p className="text-slate-500 flex items-center gap-1"><Clock size={10} /> Tiempo</p>
            <p className="text-slate-200">{job.tiempoEjecucionMs} ms</p>
          </div>
          <div className="bg-slate-900 p-2 rounded-lg">
            <p className="text-slate-500">Pasos</p>
            <p className="text-slate-200">{resultado?.total_iteraciones ?? '—'}</p>
          </div>
        </div>

        {/* No convergió */}
        {resultado?.convergio === false && (
          <div className="bg-amber-900/30 border border-amber-700/60 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-300 text-sm font-semibold">El método no convergió.</p>
              {resultado.mensaje && (
                <p className="text-amber-200/80 text-xs mt-1">{resultado.mensaje}</p>
              )}
            </div>
          </div>
        )}

        {/* Vector solución */}
        {resultado?.solucion && (
          <div className="bg-slate-900 p-4 rounded-lg border border-cyan-700 mb-4">
            <p className="text-slate-500 text-xs mb-2">Vector solución x</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
              {resultado.solucion.map((val, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-400">x{i + 1} =</span>
                  <span className="text-cyan-400 font-bold">{val.toFixed(8)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pasos según el método */}
        {resultado && esSistemaDirecto && (
          <PasosMatriz resultado={resultado} n={n} />
        )}
        {resultado && method === 'gauss-seidel' && (
          <PasosSeidel resultado={resultado} />
        )}

        {/* Mensaje final (solo si convergió) */}
        {resultado?.convergio && resultado?.mensaje && (
          <p className="text-slate-500 text-xs mt-4 italic">{resultado.mensaje}</p>
        )}
      </div>
    );
  }

  return null;
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Sistemas() {
  const [method, setMethod]   = useState<Metodo>('gauss');
  const [n, setN]             = useState(3);
  const [matrizA, setMatrizA] = useState<string[][]>(makeMatrix(3, 3));
  const [vectorB, setVectorB] = useState<string[]>(Array(3).fill('0'));
  const [tol, setTol]         = useState('0.001');
  const [maxIter, setMaxIter] = useState('50');
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [jobId, setJobId]     = useState<number | null>(null);

  // Redimensionar matrices al cambiar n
  useEffect(() => {
    setMatrizA((prev) => {
      const nuevo = makeMatrix(n, n);
      for (let i = 0; i < Math.min(prev.length, n); i++)
        for (let j = 0; j < Math.min(prev[0]?.length ?? 0, n); j++)
          nuevo[i][j] = prev[i][j];
      return nuevo;
    });
    setVectorB((prev) => {
      const nuevo = Array(n).fill('0');
      for (let i = 0; i < Math.min(prev.length, n); i++) nuevo[i] = prev[i];
      return nuevo;
    });
  }, [n]);

  const setA = (i: number, j: number, v: string) =>
    setMatrizA((p) => { const c = p.map((r) => [...r]); c[i][j] = v; return c; });

  const setB = (i: number, v: string) =>
    setVectorB((p) => { const c = [...p]; c[i] = v; return c; });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);

    const A = matrizA.map((row) => row.map(parseNum));
    const b = vectorB.map(parseNum);

    if (A.some((row) => row.some((v) => !Number.isFinite(v))) || b.some((v) => !Number.isFinite(v))) {
      setErrorForm('Todos los valores de la matriz y el vector b deben ser números válidos.');
      return;
    }

    if (method === 'gauss-seidel') {
      if (!esValido(tol) || parseNum(tol) <= 0) { setErrorForm('Tolerancia inválida.'); return; }
      const mi = parseInt(maxIter, 10);
      if (!Number.isInteger(mi) || mi < 1 || mi > 1000) { setErrorForm('Iteraciones: entero entre 1 y 1000.'); return; }
    }

    const parametros: Record<string, unknown> = { A, b };
    if (method === 'gauss-seidel') {
      parametros.tol      = parseNum(tol);
      parametros.max_iter = parseInt(maxIter, 10);
    }

    setEnviando(true);
    try {
      const resp = await axios.post('http://localhost:5000/api/jobs', {
        Metodo: method,
        Parametros: parametros,
      });
      setJobId(resp.data.id);
    } catch (err) {
      let msg = 'Error al crear el job.';
      if (axios.isAxiosError(err)) {
        msg = err.code === 'ERR_NETWORK'
          ? 'No se pudo conectar a la API.'
          : (err.response?.data?.error || err.message);
      }
      setErrorForm(msg);
    } finally {
      setEnviando(false);
    }
  };

  const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-center font-mono text-sm outline-none focus:border-cyan-500 text-slate-200';

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-cyan-400 mb-1 flex items-center gap-2">
          <Grid3x3 size={24} /> Sistemas Lineales  Ax = b
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Gauss, Gauss-Seidel y Gauss-Jordan — ejecución asíncrona con paso a paso.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── FORMULARIO ─────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl space-y-5 text-slate-300"
          >
            <h2 className="text-lg font-bold text-cyan-400">Configuración</h2>

            {/* Método */}
            <div>
              <label className="block text-sm mb-1">Método</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as Metodo)}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
              >
                <option value="gauss">Gauss (eliminación con pivoteo parcial)</option>
                <option value="gauss-seidel">Gauss-Seidel (iterativo)</option>
                <option value="gauss-jordan">Gauss-Jordan (RREF)</option>
              </select>
            </div>

            {/* Tamaño n */}
            <div>
              <label className="block text-sm mb-1">Tamaño de la matriz (n × n)</label>
              <select
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
              >
                {[2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>{v} × {v}</option>
                ))}
              </select>
            </div>

            {/* Matriz aumentada [A | b] */}
            <div>
              <label className="block text-sm mb-2">
                Matriz aumentada{' '}
                <span className="text-slate-500">[A | b] — última columna es el vector b</span>
              </label>
              <div className="overflow-x-auto">
                <table className="border-collapse w-full">
                  <tbody>
                    {Array.from({ length: n }).map((_, i) => (
                      <tr key={i}>
                        <td className="pr-2 text-slate-500 text-xs font-mono whitespace-nowrap">
                          F{i + 1}
                        </td>
                        {Array.from({ length: n }).map((_, j) => (
                          <td key={j} className="p-0.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={matrizA[i]?.[j] ?? '0'}
                              onChange={(e) => setA(i, j, e.target.value)}
                              className={inputCls}
                            />
                          </td>
                        ))}
                        {/* Separador visual */}
                        <td className="px-2 text-slate-500 text-sm font-bold">|</td>
                        <td className="p-0.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={vectorB[i] ?? '0'}
                            onChange={(e) => setB(i, e.target.value)}
                            className={`${inputCls} border-cyan-800 text-cyan-300`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Usá punto o coma decimal. Las celdas en cyan son el vector b.
              </p>
            </div>

            {/* Tolerancia + maxIter (solo Gauss-Seidel) */}
            {method === 'gauss-seidel' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Tolerancia (%)</label>
                  <input
                    type="text" inputMode="decimal" value={tol}
                    onChange={(e) => setTol(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Máx. iteraciones</label>
                  <input
                    type="number" min="1" max="1000" step="1" value={maxIter}
                    onChange={(e) => setMaxIter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* Error inline */}
            {errorForm && (
              <div className="bg-red-900/30 border border-red-700/60 rounded-lg p-3 flex items-start gap-2">
                <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{errorForm}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {enviando ? (
                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              ) : (
                <><ArrowRight size={16} /> Resolver sistema</>
              )}
            </button>
          </form>

          {/* ── RESULTADO ──────────────────────────────────────── */}
          {jobId ? (
            <ResultadoSistemaPanel jobId={jobId} method={method} n={n} />
          ) : (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <Grid3x3 className="text-slate-600 mx-auto mb-3" size={36} />
                <p className="text-slate-500 italic">
                  Aquí se mostrará la solución y el paso a paso matricial...
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}