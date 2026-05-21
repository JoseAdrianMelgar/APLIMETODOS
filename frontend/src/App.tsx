import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Raices from './pages/Raices'; // Crearemos este archivo ahora
import Sistemas from './pages/Sistemas';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sistemas" element={<Sistemas />} />
        {/* Página principal (Menú de tarjetas) */}
        <Route path="/" element={<Home />} />
        
        {/* Página de métodos de raíces */}
        <Route path="/raices" element={<Raices />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;