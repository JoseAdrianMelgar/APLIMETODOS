import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import JobForm from '../components/JobForm';
import { useState } from 'react';
import JobResult from '../components/JobResult';

function Raices() {
  const [jobId, setJobId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">

        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-8 transition-colors">
          <ArrowLeft size={20} />
          <span>Volver al menú principal</span>
        </Link>

        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">Búsqueda de Raíces</h1>
          <p className="text-slate-400 font-mono">Newton-Raphson • Secante • Müller</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          <JobForm onJobCreated={setJobId} />
          <JobResult jobId={jobId} />
        </div>

      </div>
    </div>
  );
}

export default Raices;