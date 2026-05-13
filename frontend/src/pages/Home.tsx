import { 
  Home as HomeIcon, 
  LineChart, 
  Grid3X3, 
  Users, 
  User, 
  Headset, 
  Phone, 
  Hexagon 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

function Home() {
  return (
    <div className="min-h-screen flex font-sans text-slate-800">
      
      {/* ============================== */}
      {/* LADO IZQUIERDO: CONTENIDO PRINCIPAL */}
      {/* ============================== */}
      <div className="flex-1 bg-[#F5EFE6] relative flex flex-col p-10">
        
        {/* ============================== */}
        {/* FONDO: MARCAS DE AGUA MATEMÁTICAS */}
        {/* ============================== */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 text-[#3B4C63] select-none z-0">
          
          {/* Superior Izquierda */}
          <div className="absolute top-24 left-12 text-2xl font-serif">
            <InlineMath math="f(x) = 0" />
          </div>
          
          {/* Medio Izquierda (Sumatoria) */}
          <div className="absolute top-[45%] left-10 flex items-center gap-2 font-serif">
             <InlineMath math="\sum_{k=1}^{n} \frac{n(n+1)}{2}" />
          </div>
          
          {/* Inferior Izquierda (Integral) */}
          <div className="absolute bottom-16 left-12 flex items-center font-serif">
            <InlineMath math="\int_{a}^{b} f(x) \, dx" />
          </div>

          {/* Superior Derecha (Gráfica) */}
          <div className="absolute top-16 right-32">
            <div className="w-24 h-24 border-l-2 border-b-2 border-current relative">
              <span className="absolute -top-6 -left-2 italic font-serif">y</span>
              <span className="absolute -bottom-6 -right-4 italic font-serif">x</span>
              <svg className="absolute bottom-0 left-0 w-24 h-24" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M0,100 Q50,70 100,0" />
                <line x1="50" y1="0" x2="50" y2="100" strokeDasharray="4" opacity="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" strokeDasharray="4" opacity="0.5" />
              </svg>
            </div>
          </div>

          {/* Medio Derecha (Fórmula Newton-Raphson) */}
          <div className="absolute top-[42%] right-20 text-lg font-serif">
            <InlineMath math="x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}" />
          </div>

          {/* Inferior Derecha (Curva) */}
          <div className="absolute bottom-16 right-24 text-xl font-serif flex items-end gap-2">
            <svg className="w-20 h-12 mb-1" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M0,50 Q30,-10 60,30 T100,10" />
            </svg>
            <InlineMath math="P_n(x)" />
          </div>
        </div>
        
        {/* Header / Logo */}
        <div className="flex items-center gap-2 mb-16 relative z-10">
          <div className="relative flex items-center justify-center text-[#214383]">
            <Hexagon size={48} strokeWidth={1} />
            <span className="absolute font-serif italic font-bold text-xl">fx</span>
          </div>
          <span className="text-xl font-bold tracking-wide">Métodos numéricos</span>
        </div>

        {/* Títulos Centrales */}
        <div className="text-center mt-8 mb-12 flex flex-col items-center relative z-10">
          <h2 className="text-2xl font-bold mb-1">Bienvenido a</h2>
          <h1 className="text-6xl font-bold text-[#214383] mb-6">Métodos numéricos</h1>
          <p className="text-lg font-medium max-w-md">
            Resuelve ecuaciones y próximas funciones de forma precisa y eficiente
          </p>
        </div>

        {/* Tarjetas (Cards) */}
        <div className="flex flex-wrap justify-center gap-6 mb-auto relative z-10">
          
          {/* Tarjeta 1 */}
          <div className="bg-[#FCFAF6] w-64 rounded-2xl p-6 shadow-lg border border-[#E8DCCB] flex flex-col items-center text-center">
            <div className="text-[#214383] mb-4">
              <HomeIcon size={64} fill="currentColor" strokeWidth={1} />
            </div>
            <h3 className="font-bold text-lg mb-2">Historial de Jobs</h3>
            <p className="text-sm">
              Monitorea en tiempo real el estado y los resultados de tus cálculos asíncronos.
            </p>
          </div>

           {/* Tarjeta 2 */}
<Link 
  to="/raices" 
  className="bg-[#FCFAF6] w-64 rounded-2xl p-6 shadow-lg border border-[#E8DCCB] flex flex-col items-center text-center cursor-pointer hover:-translate-y-2 hover:shadow-xl transition-all duration-300 relative z-10 text-slate-800"
>
  <div className="text-[#214383] mb-4">
    <LineChart size={64} strokeWidth={1.5} />
  </div>
  <h3 className="font-bold text-lg mb-2 text-slate-800">Búsqueda de Raíces</h3>
  <p className="text-sm text-slate-600">
    Encuentra soluciones para <br/> 
    <InlineMath math="f(x) = 0" /> utilizando Newton-Raphson, Secante y Müller.
  </p>
</Link>

          {/* Tarjeta 3 */}
          <div className="bg-[#FCFAF6] w-64 rounded-2xl p-6 shadow-lg border border-[#E8DCCB] flex flex-col items-center text-center">
            <div className="text-[#214383] mb-4">
              <Grid3X3 size={64} strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-lg mb-2">Sistemas Lineales</h3>
            <p className="text-sm">
              Resuelve sistemas <InlineMath math="Ax = b" /> mediante los métodos de Gauss, Gauss-Jordan y Gauss-Seidel.
            </p>
          </div>

        </div>

        {/* Frase inferior */}
        <div className="text-center mt-12 mb-4 relative z-10">
          <p className="text-lg font-medium italic">
            <span className="text-[#214383] text-2xl font-serif font-bold mr-2">“</span>
            Los números no son solo símbolos, <br/> son respuestas esperando ser descubiertas.
            <span className="text-[#214383] text-2xl font-serif font-bold ml-2">”</span>
          </p>
        </div>
      </div>

      {/* ============================== */}
      {/* LADO DERECHO: BARRA LATERAL */}
      {/* ============================== */}
      <div className="w-80 bg-[#3B4C63] text-white p-8 flex flex-col relative z-10">
        
        {/* Integrantes */}
        <div className="mb-8">
          <div className="flex items-center gap-4 border-b border-slate-500 pb-4 mb-4">
            <div className="bg-[#F5EFE6] text-[#3B4C63] p-2 rounded-full">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-medium">Integrantes</h3>
          </div>
          
          <ul className="flex flex-col gap-4">
            {[
              "Adrián Monterroso", 
              "César García", 
              "Nathalie Carbajal", 
              "Leonel Monzon", 
              "Esaú Morales", 
              "Enrique Vides"
            ].map((nombre, index) => (
              <li key={index} className="flex items-center gap-4 border-b border-slate-500/50 pb-2">
                <User size={18} />
                <span className="text-sm tracking-wide">{nombre}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Soporte Técnico */}
        <div className="mt-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-[#F5EFE6] text-[#3B4C63] p-2 rounded-full">
              <Headset size={24} />
            </div>
            <h3 className="text-xl font-medium">Soporte técnico</h3>
          </div>
          
          <div className="flex items-center gap-4 border-t border-slate-500 pt-4">
            <div className="bg-[#214383] p-2 rounded-full">
              <Phone size={20} />
            </div>
            <span className="text-lg">+502 5879 6722</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Home;