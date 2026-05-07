import time
import json
import traceback
from datetime import datetime

from config import POLL_INTERVAL
from database import DatabaseManager
from redis_client import RedisQueue
from metodos_numericos import MetodosNumericos

class NumericWorker:
    def __init__(self):
        self.db = DatabaseManager()
        self.redis = RedisQueue()
        self.metodos = MetodosNumericos()
        self.running = True
    
    def start(self):
        """Inicia el worker"""
        print("=" * 60)
        print("🔢 WORKER NUMÉRICO - Métodos Numéricos")
        print("=" * 60)
        
        # Conectar a servicios
        self.db.connect()
        
        if not self.redis.ping():
            print("❌ No se pudo conectar a Redis")
            return
        
        print("✅ Conexiones establecidas")
        print(f"📡 Esperando jobs en cola: {self.redis.queue_name}")
        print("-" * 60)
        
        while self.running:
            try:
                # Tomar job de Redis
                job_id = self.redis.pop_job()
                
                if job_id is None:
                    time.sleep(POLL_INTERVAL)
                    continue
                
                # Procesar job
                self.process_job(job_id)
                
            except KeyboardInterrupt:
                print("\n🛑 Worker detenido por usuario")
                break
            except Exception as e:
                print(f"❌ Error inesperado: {e}")
                traceback.print_exc()
                time.sleep(5)
        
        self.db.close()
    
    def process_job(self, job_id: int):
        """Procesa un job específico"""
        print(f"\n📋 Procesando Job ID: {job_id}")
        
        # Obtener job de BD
        job = self.db.get_job(job_id)
        if not job:
            print(f"❌ Job {job_id} no encontrado en BD")
            return
        
        # Marcar como RUNNING
        self.db.update_job_status(job_id, 'RUNNING')
        start_time = time.time()
        
        try:
            # Preparar parámetros
            params = job['parametros'].copy()
            
            # Agregar callback para guardar iteraciones en tiempo real
            def on_iteration(iteracion, xi, fxi, dfxi, error):
                self.db.save_iteration(
                    job_id=job_id,
                    iteracion=iteracion,
                    xi=xi,
                    error=error,
                    datos_adicionales={
                        'fxi': fxi,
                        'dfxi': dfxi,
                        'metodo': job['metodo']
                    }
                )
                print(f"  📝 Iteración {iteracion}: xi = {xi:.6f}, error = {error:.4f}%")
            
            # Ejecutar método según el tipo
            if job['metodo'] == 'newton-raphson':
                resultado = self.metodos.newton_raphson(
                    **params,
                    on_iteration=on_iteration
                )
            else:
                # TODO: Implementar otros métodos
                raise ValueError(f"Método no implementado: {job['metodo']}")
            
            # Calcular tiempo de ejecución
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # Guardar resultado
            self.db.save_result(job_id, resultado, elapsed_ms)
            
            print(f"✅ Job {job_id} completado en {elapsed_ms}ms")
            print(f"   Convergió: {resultado['convergio']}")
            print(f"   Resultado: {resultado.get('raiz', resultado.get('solucion', 'N/A'))}")
            
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            print(f"❌ Job {job_id} falló: {error_msg}")
            traceback.print_exc()
            self.db.save_failed_job(job_id, error_msg)


if __name__ == "__main__":
    worker = NumericWorker()
    worker.start()