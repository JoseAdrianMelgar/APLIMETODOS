import { useState } from 'react';
import axios from 'axios';

type Method = 'newton-raphson' | 'secante' | 'muller';

interface JobFormProps {
  // El padre (Raices.tsx) recibe el ID del job recien creado
  // para empezar a hacer polling y mostrar el resultado.
  onJobCreated: (jobId: number) => void;
}

function JobForm({ onJobCreated }: JobFormProps) {
  const [method, setMethod] = useState<Method>('newton-raphson');
  const [funcion, setFuncion] = useState('');
  const [x0, setX0] = useState('1');
  const [x1, setX1] = useState('2');
  const [x2, setX2] = useState('3');
  const [tol, setTol] = useState('0.001');
  const [maxIter, setMaxIter] = useState('50');
  const [enviando, setEnviando] = useState(false);

  // parseFloat no entiende coma decimal (Windows en español pone coma).
  // Esta funcion la reemplaza por punto antes de parsear.
  const toNumber = (s: string) => parseFloat(s.replace(',', '.'));

  // Helpers de visibilidad: cada metodo necesita distintos valores iniciales.
  const necesitaX1 = method === 'secante' || method === 'muller';
  const necesitaX2 = method === 'muller';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    const funcionSympy = funcion.replace(/\^/g, '**');

    const parametros: Record<string, unknown> = {
      funcion_str: funcionSympy,
      x0: toNumber(x0),
      tol: toNumber(tol),
      max_iter: parseInt(maxIter, 10),
    };

    if (necesitaX1) {
      parametros.x1 = toNumber(x1);
    }
    if (necesitaX2) {
      parametros.x2 = toNumber(x2);
    }

    try {
      const respuesta = await axios.post('http://localhost:5000/api/jobs', {
        Metodo: method,
        Parametros: parametros,
      });

      // Notificar al padre con el ID generado por SQL Server
      onJobCreated(respuesta.data.id);
    } catch (error) {
      let mensaje = 'Error desconocido';
      if (axios.isAxiosError(error)) {
        mensaje = error.response?.data?.error || error.message;
      } else if (error instanceof Error) {
        mensaje = error.message;
      }
      console.error('Error al crear el Job:', error);
      alert(`Error al crear el Job:\n${mensaje}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl w-full"
    >
      <h2 className="text-xl font-bold mb-4 text-cyan-400">Configuración del Job</h2>
      <div className="space-y-4 text-slate-300">

        {/* Método */}
        <div>
          <label className="block text-sm mb-1">Método</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
          >
            <option value="newton-raphson">Newton-Raphson</option>
            <option value="secante">Secante</option>
            <option value="muller">Müller</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {method === 'newton-raphson' && 'Requiere f(x) y un valor inicial x₀.'}
            {method === 'secante' && 'Requiere f(x) y dos valores iniciales x₀, x₁.'}
            {method === 'muller' && 'Requiere f(x) y tres valores iniciales x₀, x₁, x₂. Soporta raíces complejas.'}
          </p>
        </div>

        {/* Función f(x) */}
        <div>
          <label className="block text-sm mb-1">Función f(x)</label>
          <input
            type="text"
            value={funcion}
            onChange={(e) => setFuncion(e.target.value)}
            placeholder="ej. x^2 - 4"
            required
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">
            Usá <code>^</code> para potencias. Funciones: <code>exp(x)</code>, <code>sin(x)</code>, <code>cos(x)</code>, <code>log(x)</code>.
          </p>
        </div>

        {/* x0 */}
        <div>
          <label className="block text-sm mb-1">Valor inicial x₀</label>
          <input
            type="text"
            inputMode="decimal"
            value={x0}
            onChange={(e) => setX0(e.target.value)}
            required
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
          />
        </div>

        {/* x1 - solo para Secante y Müller */}
        {necesitaX1 && (
          <div>
            <label className="block text-sm mb-1">Valor inicial x₁</label>
            <input
              type="text"
              inputMode="decimal"
              value={x1}
              onChange={(e) => setX1(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
            />
          </div>
        )}

        {/* x2 - solo para Müller */}
        {necesitaX2 && (
          <div>
            <label className="block text-sm mb-1">Valor inicial x₂</label>
            <input
              type="text"
              inputMode="decimal"
              value={x2}
              onChange={(e) => setX2(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
            />
          </div>
        )}

        {/* Tolerancia */}
        <div>
          <label className="block text-sm mb-1">Tolerancia (%)</label>
          <input
            type="text"
            inputMode="decimal"
            value={tol}
            onChange={(e) => setTol(e.target.value)}
            required
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
          />
        </div>

        {/* Max iteraciones */}
        <div>
          <label className="block text-sm mb-1">Máx. iteraciones</label>
          <input
            type="number"
            step="1"
            min="1"
            value={maxIter}
            onChange={(e) => setMaxIter(e.target.value)}
            required
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-cyan-500 outline-none"
          />
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors mt-4"
        >
          {enviando ? 'Enviando...' : 'Crear Nuevo Job'}
        </button>

      </div>
    </form>
  );
}

export default JobForm;
