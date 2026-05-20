import { useState } from 'react';
import axios from 'axios';

type Method = 'newton-raphson' | 'secante' | 'muller';

interface JobFormProps {
  // El padre (Raices.tsx) recibe el ID del job recien creado
  // para empezar a hacer polling y mostrar el resultado.
  onJobCreated: (jobId: number) => void;
}

// Errores de validacion por campo. Si una clave existe, ese campo es invalido.
interface Errores {
  funcion?: string;
  x0?: string;
  x1?: string;
  x2?: string;
  tol?: string;
  maxIter?: string;
}

// Funciones matematicas conocidas que SymPy entiende. Se quitan antes de
// validar caracteres para no marcar 'sin', 'cos', etc. como invalidos.
const FUNCIONES_CONOCIDAS = /\b(sqrt|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|exp|log|ln|abs|pi)\b/gi;

/**
 * Parsea un numero soportando:
 *   - coma decimal (Windows en espanol): "0,001" -> 0.001
 *   - notacion cientifica nativa: "1e-6" -> 0.000001
 *   - notacion de potencia: "10^-6" o "10**-6" -> 0.000001
 * Devuelve NaN si no es parseable.
 */
const parseNumero = (s: string): number => {
  const limpio = s.trim().replace(',', '.');
  // Detectar "base^exp" o "base**exp" (ej. 10^-6)
  const potencia = limpio.match(/^(-?\d+(?:\.\d+)?)\s*(?:\^|\*\*)\s*(-?\d+(?:\.\d+)?)$/);
  if (potencia) {
    return Math.pow(parseFloat(potencia[1]), parseFloat(potencia[2]));
  }
  return parseFloat(limpio);
};

const esNumeroValido = (s: string): boolean => Number.isFinite(parseNumero(s));

function JobForm({ onJobCreated }: JobFormProps) {
  const [method, setMethod] = useState<Method>('newton-raphson');
  const [funcion, setFuncion] = useState('');
  const [x0, setX0] = useState('1');
  const [x1, setX1] = useState('2');
  const [x2, setX2] = useState('3');
  const [tol, setTol] = useState('0.001');
  const [maxIter, setMaxIter] = useState('50');
  const [enviando, setEnviando] = useState(false);

  // Control de cuando mostrar cada error: tras tocar el campo (blur) o tras
  // intentar enviar. Asi no llenamos de rojo el formulario apenas se abre.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [intentoSubmit, setIntentoSubmit] = useState(false);

  // Helpers de visibilidad: cada metodo necesita distintos valores iniciales.
  const necesitaX1 = method === 'secante' || method === 'muller';
  const necesitaX2 = method === 'muller';

  // ----- VALIDACION (pura, en funcion del estado actual) -----
  const validar = (): Errores => {
    const e: Errores = {};

    // Funcion f(x)
    const f = funcion.trim();
    if (!f) {
      e.funcion = 'Ingresá una función.';
    } else if (!/x/i.test(f)) {
      e.funcion = 'La función debe depender de x (ej. x^2 - 4).';
    } else {
      const resto = f.replace(FUNCIONES_CONOCIDAS, '');
      if (!/^[0-9xXeE+\-*/^().,\s]*$/.test(resto)) {
        e.funcion = 'La función contiene caracteres no válidos.';
      }
    }

    // x0
    if (!esNumeroValido(x0)) e.x0 = 'Debe ser un número válido (ej. 1.5).';

    // x1 (Secante y Müller)
    if (necesitaX1) {
      if (!esNumeroValido(x1)) {
        e.x1 = 'Debe ser un número válido.';
      } else if (esNumeroValido(x0) && parseNumero(x1) === parseNumero(x0)) {
        e.x1 = 'x₁ debe ser distinto de x₀.';
      }
    }

    // x2 (solo Müller)
    if (necesitaX2) {
      if (!esNumeroValido(x2)) {
        e.x2 = 'Debe ser un número válido.';
      } else if (
        (esNumeroValido(x0) && parseNumero(x2) === parseNumero(x0)) ||
        (esNumeroValido(x1) && parseNumero(x2) === parseNumero(x1))
      ) {
        e.x2 = 'x₂ debe ser distinto de x₀ y x₁.';
      }
    }

    // Tolerancia
    if (!esNumeroValido(tol)) {
      e.tol = 'Tolerancia inválida (ej. 0.001, 1e-6 o 10^-6).';
    } else if (parseNumero(tol) <= 0) {
      e.tol = 'La tolerancia debe ser mayor que 0.';
    }

    // Max iteraciones
    const mi = parseInt(maxIter, 10);
    if (!Number.isInteger(mi) || mi < 1) {
      e.maxIter = 'Debe ser un entero mayor o igual a 1.';
    }

    return e;
  };

  const errores = validar();
  // Mostrar el error de un campo solo si fue tocado o ya se intento enviar.
  const mostrar = (campo: keyof Errores): boolean =>
    (touched[campo] || intentoSubmit) && !!errores[campo];

  const marcarTocado = (campo: string) =>
    setTouched((prev) => ({ ...prev, [campo]: true }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setIntentoSubmit(true);

    // Si hay errores, NO se crea el job (esto era lo que pedía QA).
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);

    const funcionSympy = funcion.replace(/\^/g, '**');

    const parametros: Record<string, unknown> = {
      funcion_str: funcionSympy,
      x0: parseNumero(x0),
      tol: parseNumero(tol),
      max_iter: parseInt(maxIter, 10),
    };

    if (necesitaX1) {
      parametros.x1 = parseNumero(x1);
    }
    if (necesitaX2) {
      parametros.x2 = parseNumero(x2);
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

  // className del input segun tenga error visible o no
  const inputClass = (hayError: boolean) =>
    `w-full bg-slate-900 border rounded p-2 outline-none ${
      hayError
        ? 'border-red-500 focus:border-red-400'
        : 'border-slate-600 focus:border-cyan-500'
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
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
            onBlur={() => marcarTocado('funcion')}
            placeholder="ej. x^2 - 4"
            className={`${inputClass(mostrar('funcion'))} font-mono`}
          />
          {mostrar('funcion') ? (
            <p className="text-xs text-red-400 mt-1">{errores.funcion}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              Usá <code>^</code> para potencias. Funciones: <code>exp(x)</code>, <code>sin(x)</code>, <code>cos(x)</code>, <code>log(x)</code>. También <code>e^x</code>.
            </p>
          )}
        </div>

        {/* x0 */}
        <div>
          <label className="block text-sm mb-1">Valor inicial x₀</label>
          <input
            type="text"
            inputMode="decimal"
            value={x0}
            onChange={(e) => setX0(e.target.value)}
            onBlur={() => marcarTocado('x0')}
            className={inputClass(mostrar('x0'))}
          />
          {mostrar('x0') && <p className="text-xs text-red-400 mt-1">{errores.x0}</p>}
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
              onBlur={() => marcarTocado('x1')}
              className={inputClass(mostrar('x1'))}
            />
            {mostrar('x1') && <p className="text-xs text-red-400 mt-1">{errores.x1}</p>}
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
              onBlur={() => marcarTocado('x2')}
              className={inputClass(mostrar('x2'))}
            />
            {mostrar('x2') && <p className="text-xs text-red-400 mt-1">{errores.x2}</p>}
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
            onBlur={() => marcarTocado('tol')}
            className={inputClass(mostrar('tol'))}
          />
          {mostrar('tol') ? (
            <p className="text-xs text-red-400 mt-1">{errores.tol}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              Acepta <code>0.001</code>, <code>1e-6</code> o <code>10^-6</code>.
            </p>
          )}
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
            onBlur={() => marcarTocado('maxIter')}
            className={inputClass(mostrar('maxIter'))}
          />
          {mostrar('maxIter') && <p className="text-xs text-red-400 mt-1">{errores.maxIter}</p>}
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