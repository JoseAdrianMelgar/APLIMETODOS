// src/App.tsx
// Home ahora pasa por Layout para heredar el TopNav y Footer de forma consistente.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import Layout from './components/Layout';

import Home from './pages/Home';
import Raices from './pages/Raices';
import Sistemas from './pages/Sistemas';
import Comparar from './pages/Comparar';
import Historial from './pages/Historial';
import Stats from './pages/Stats';
import Estres from './pages/Estres';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Todas las paginas pasan por Layout (TopNav + Footer + tema) */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/raices" element={<Raices />} />
            <Route path="/sistemas" element={<Sistemas />} />
            <Route path="/comparar" element={<Comparar />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/estres" element={<Estres />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
