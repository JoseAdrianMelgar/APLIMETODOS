// src/theme/ThemeContext.tsx
// Proveedor de tema claro/oscuro. Alterna la clase `dark` en <html>
// y persiste la eleccion en localStorage. Las variables CSS viven en index.css.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('mn-theme') as Theme | null;
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('mn-theme', theme);
  }, [theme]);

  const toggle = () => {
    // Agrega clase temporal para que todos los elementos transicionen suavemente
    document.documentElement.classList.add('theme-transitioning');
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 500);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
