// src/components/Layout.tsx
// Envoltura para las paginas internas (Raices, Sistemas, Historial, etc.):
// barra de navegacion superior con toggle de tema + footer con el equipo.
// El Home queda aparte (mantiene su diseno con barra lateral).

import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Grid3X3,
  GitCompareArrows,
  History,
  BarChart3,
  Zap,
  Sun,
  Moon,
  Mail,
  Phone,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

const NAV = [
  { to: '/raices', label: 'Raíces', icon: Activity },
  { to: '/sistemas', label: 'Sistemas', icon: Grid3X3 },
  { to: '/comparar', label: 'Comparar', icon: GitCompareArrows },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { to: '/estres', label: 'Estrés', icon: Zap },
];

const INTEGRANTES = [
  'Adrián Monterroso',
  'César García',
  'Nathalie Carbajal',
  'Leonel Monzón',
  'Esaú Morales',
  'Enrique Vides',
];

function TopNav() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"
        style={{ color: 'var(--ink)' }}
      >
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <span
            className="grid h-9 w-9 place-items-center rounded-lg font-serif text-sm font-bold"
            style={{ background: 'var(--nav)', color: 'var(--nav-ink)' }}
          >
            fx
          </span>
          <span className="font-serif text-lg font-semibold">Métodos numéricos</span>
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-full px-2 py-1 md:flex"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200"
              style={({ isActive }) => ({
                background: isActive ? 'var(--nav)' : 'transparent',
                color: isActive ? 'var(--nav-ink)' : 'var(--ink-soft)',
              })}
            >
              <Icon size={15} className="transition-transform group-hover:scale-110" />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={toggle}
          aria-label="Cambiar tema"
          className="grid h-10 w-10 place-items-center rounded-full transition-all duration-300 hover:scale-105"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      {/* Nav compacta en mobile */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all"
            style={({ isActive }) => ({
              background: isActive ? 'var(--nav)' : 'var(--surface)',
              color: isActive ? 'var(--nav-ink)' : 'var(--ink-soft)',
              border: '1px solid var(--border)',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <span
              className="grid h-8 w-8 place-items-center rounded-lg font-serif text-xs font-bold"
              style={{ background: 'var(--nav)', color: 'var(--nav-ink)' }}
            >
              fx
            </span>
            <span className="font-serif text-base font-semibold">Métodos numéricos</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Plataforma asíncrona para resolver ecuaciones y sistemas lineales con
            paso a paso completo, gráficas de convergencia y análisis comparativo.
          </p>
        </div>

        <div>
          <h4
            className="mb-4 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent)' }}
          >
            Integrantes
          </h4>
          <ul className="grid grid-cols-2 gap-y-2 text-sm" style={{ color: 'var(--ink)' }}>
            {INTEGRANTES.map((n) => {
              const initials = n
                .split(' ')
                .map((p) => p[0])
                .join('');
              return (
                <li key={n} className="flex items-center gap-2">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {initials}
                  </span>
                  {n}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4
            className="mb-4 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent)' }}
          >
            Soporte
          </h4>
          <ul className="space-y-3 text-sm" style={{ color: 'var(--ink)' }}>
            <li className="flex items-center gap-3">
              <Mail size={16} style={{ color: 'var(--ink-soft)' }} />
              soporte@metodosnumericos.dev
            </li>
            <li className="flex items-center gap-3">
              <Phone size={16} style={{ color: 'var(--ink-soft)' }} />
              +502 5879 6722
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const location = useLocation();
  return (
    <div className="relative min-h-screen font-sans" style={{ background: 'var(--bg)' }}>
      {/* Backdrop: formulas matematicas muy tenues en todas las paginas */}
      <div
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
        style={{ opacity: 0.05, color: 'var(--ink)', zIndex: 0, fontFamily: 'Georgia, serif' }}
      >
        <div className="absolute left-6 top-28 text-xl italic">f(x) = 0</div>
        <div className="absolute right-14 top-16 text-base italic">x* = 2.0945…</div>
        <div className="absolute bottom-72 left-10 text-lg italic">Ax = b</div>
        <div className="absolute bottom-56 right-16 text-base italic">∑ f(xᵢ) / f′(xᵢ)</div>
        <div className="absolute right-8 top-1/2 text-sm italic">xₙ₊₁ = xₙ − f/f′</div>
      </div>

      <TopNav />
      <main key={location.pathname} className="page-content relative z-10 mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
