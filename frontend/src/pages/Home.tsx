// src/pages/Home.tsx
// Pagina principal. El nav superior y el footer vienen del Layout.tsx;
// aqui solo va el contenido: hero, modulos principales, herramientas y quote.

import { Link } from 'react-router-dom';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import {
  Activity,
  Grid3X3,
  History,
  GitCompareArrows,
  BarChart3,
  Zap,
  ArrowRight,
} from 'lucide-react';

const MAIN_MODULES = [
  {
    path: '/raices',
    icon: Activity,
    title: 'Búsqueda de raíces',
    math: 'f(x) = 0',
    desc: 'Encuentra soluciones para f(x) = 0 utilizando Newton-Raphson, Secante y Müller.',
  },
  {
    path: '/sistemas',
    icon: Grid3X3,
    title: 'Sistemas lineales',
    math: 'Ax = b',
    desc: 'Resuelve sistemas Ax = b mediante los métodos de Gauss, Gauss-Jordan y Gauss-Seidel.',
  },
  {
    path: '/historial',
    icon: History,
    title: 'Historial de jobs',
    math: null,
    desc: 'Monitorea en tiempo real el estado y los resultados de tus cálculos asíncronos.',
  },
];

const TOOLS = [
  {
    path: '/comparar',
    icon: GitCompareArrows,
    title: 'Comparar métodos',
    desc: 'Ejecuta los 3 métodos sobre la misma f(x) y compara sus curvas de convergencia.',
  },
  {
    path: '/stats',
    icon: BarChart3,
    title: 'Estadísticas',
    desc: 'Visión agregada — iteraciones, tiempos y tasa de convergencia por método.',
  },
  {
    path: '/estres',
    icon: Zap,
    title: 'Pruebas de estrés',
    desc: 'Lanza lotes masivos de jobs y mide throughput del solver.',
  },
];

export default function Home() {
  return (
    <div className="relative">
      {/* Backdrop: formulas matematicas tenues */}
      <div
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
        style={{ opacity: 0.07, color: 'var(--ink)', zIndex: 0 }}
      >
        <div className="absolute left-8 top-16 text-xl font-serif">
          <InlineMath math="f(x) = 0" />
        </div>
        <div className="absolute right-12 top-24 text-lg font-serif">
          <InlineMath math="x_{n+1} = x_n - \dfrac{f(x_n)}{f'(x_n)}" />
        </div>
        <div className="absolute bottom-40 left-12 font-serif">
          <InlineMath math="\sum_{k=1}^{n} \frac{k(k+1)}{2}" />
        </div>
        <div className="absolute bottom-32 right-16 font-serif">
          <InlineMath math="\int_{a}^{b} f(x)\,dx" />
        </div>
      </div>

      {/* Contenido */}
      <div className="relative z-10 py-12">
        {/* Hero */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p
            className="mb-2 text-sm font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-soft)' }}
          >
            Bienvenido a
          </p>
          <h1
            className="mb-4 font-serif text-5xl font-bold md:text-6xl"
            style={{ color: 'var(--ink)' }}
          >
            Métodos numéricos
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Resuelve ecuaciones y sistemas lineales de forma precisa y eficiente —
            con paso a paso completo y gráficas de convergencia.
          </p>
        </div>

        {/* Modulos principales */}
        <div className="mx-auto mb-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {MAIN_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.path}
                to={mod.path}
                className="group flex flex-col items-center rounded-3xl p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                }}
              >
                {/* icono */}
                <div
                  className="mb-5 grid h-16 w-16 place-items-center rounded-2xl"
                  style={{ background: 'var(--surface-2)', color: 'var(--nav)' }}
                >
                  <Icon size={32} strokeWidth={1.5} />
                </div>

                <h3 className="mb-2 font-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                  {mod.title}
                </h3>

                {mod.math && (
                  <span className="mb-3 font-serif text-sm italic" style={{ color: 'var(--ink-soft)' }}>
                    <InlineMath math={mod.math} />
                  </span>
                )}

                <p className="mb-6 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  {mod.desc}
                </p>

                <span
                  className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2"
                  style={{ color: 'var(--accent)' }}
                >
                  Abrir módulo <ArrowRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Herramientas */}
        <div className="mx-auto max-w-5xl">
          <h2
            className="mb-5 border-b pb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-soft)', borderColor: 'var(--border)' }}
          >
            Herramientas
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.path}
                  to={tool.path}
                  className="flex items-start gap-4 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                  }}
                >
                  <div
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold" style={{ color: 'var(--ink)' }}>
                      {tool.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                      {tool.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quote */}
        <div className="mt-16 text-center">
          <p className="font-serif text-lg italic" style={{ color: 'var(--ink-soft)' }}>
            <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>"</span>
            {' '}Los números no son solo símbolos,{' '}
            <br className="hidden sm:block" />
            son respuestas esperando ser descubiertas.{' '}
            <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>"</span>
          </p>
        </div>
      </div>
    </div>
  );
}
