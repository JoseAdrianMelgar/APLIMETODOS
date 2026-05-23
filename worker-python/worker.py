import time
import json
import traceback

from config import POLL_INTERVAL
from database import DatabaseManager
from redis_client import RedisQueue
from metodos_numericos import MetodosNumericos


class NumericWorker:

    # Los 6 métodos ahora implementados
    METODOS_IMPLEMENTADOS = {
        'newton_raphson', 'secante', 'muller',
        'gauss_seidel', 'gauss', 'gauss_jordan'
    }
    METODOS_PENDIENTES = set()  # ninguno pendiente

    def __init__(self):
        self.db = DatabaseManager()
        self.redis = RedisQueue()
        self.metodos = MetodosNumericos()
        self.running = True

    def start(self):
        print("=" * 60)
        print("WORKER NUMERICO - Metodos Numericos (6/6 implementados)")
        print("=" * 60)

        self.db.connect()

        if not self.redis.ping():
            print("ERROR: No se pudo conectar a Redis")
            return

        print("Conexiones establecidas")
        print(f"Esperando jobs en cola: {self.redis.queue_name}")
        print("-" * 60)

        while self.running:
            try:
                job_id = self.redis.pop_job()
                if job_id is None:
                    time.sleep(POLL_INTERVAL)
                    continue
                self.process_job(job_id)

            except KeyboardInterrupt:
                print("\nWorker detenido por usuario")
                break
            except Exception as e:
                print(f"Error inesperado en el loop: {e}")
                traceback.print_exc()
                try:
                    self.db.ensure_connection()
                except Exception as recon_err:
                    print(f"No se pudo reconectar a BD: {recon_err}")
                time.sleep(5)

        self.db.close()

    def process_job(self, job_id: int):
        print(f"\nProcesando Job ID: {job_id}")
        self.db.ensure_connection()

        job = self.db.get_job(job_id)
        if not job:
            print(f"ERROR: Job {job_id} no encontrado en BD")
            return

        estado_actual = (job.get('estado') or '').strip().upper()
        if estado_actual not in ('PENDING', ''):
            print(f"  Job {job_id} ya esta en estado '{estado_actual}'. Se omite (idempotencia).")
            return

        self.db.update_job_status(job_id, 'RUNNING')
        start_time = time.time()

        try:
            params = job['parametros'].copy() if job['parametros'] else {}
            metodo_original = job['metodo']
            metodo = self._normalizar_metodo(metodo_original)

            print(f"  Metodo: '{metodo_original}' -> '{metodo}'")
            print(f"  Parametros: {params}")
            resultado = self._ejecutar_metodo(metodo, params)
            self._guardar_iteraciones(job_id, resultado, metodo_original)

            elapsed_ms = int((time.time() - start_time) * 1000)

            # Deteccion de fallo matematico (seccion 5.2 del enunciado):
            # si el metodo no produjo resultado valido (matriz singular,
            # division por cero, diagonal con ceros, expresion invalida),
            # tanto 'raiz' como 'solucion' vienen en None -> el job es FAILED.
            es_fallo = resultado.get('raiz') is None and resultado.get('solucion') is None

            if es_fallo:
                error_msg = resultado.get('mensaje', 'El metodo no produjo un resultado valido.')
                self.db.save_failed_job(job_id, error_msg)
                print(f"FAILED Job {job_id} en {elapsed_ms}ms: {error_msg}")
            else:
                self.db.save_result(job_id, resultado, elapsed_ms)
                valor_final = resultado.get('raiz', resultado.get('solucion', 'N/A'))
                print(f"OK Job {job_id} completado en {elapsed_ms}ms")
                print(f"   Convergio: {resultado.get('convergio')}")
                print(f"   Resultado: {valor_final}")
                print(f"   Total pasos: {resultado.get('total_iteraciones', 0)}")


        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            print(f"ERROR Job {job_id} fallo: {error_msg}")
            traceback.print_exc()
            try:
                self.db.ensure_connection()
                self.db.save_failed_job(job_id, error_msg)
            except Exception as save_err:
                print(f"No se pudo marcar el job {job_id} como FAILED: {save_err}")

    @staticmethod
    def _normalizar_metodo(nombre: str) -> str:
        if not nombre:
            return ''
        nombre_limpio = nombre.replace('ü', 'u').replace('Ü', 'U')
        return nombre_limpio.strip().lower().replace('-', '_').replace(' ', '_')

    def _ejecutar_metodo(self, metodo: str, params: dict) -> dict:
        if metodo == 'newton_raphson':  return self.metodos.newton_raphson(**params)
        if metodo == 'secante':         return self.metodos.secante(**params)
        if metodo == 'muller':          return self.metodos.muller(**params)
        if metodo == 'gauss_seidel':    return self.metodos.gauss_seidel(**params)
        if metodo == 'gauss':           return self.metodos.gauss(**params)
        if metodo == 'gauss_jordan':    return self.metodos.gauss_jordan(**params)

        if metodo in self.METODOS_PENDIENTES:
            raise NotImplementedError(f"Metodo '{metodo}' aun no implementado.")

        raise ValueError(
            f"Metodo desconocido: '{metodo}'. "
            f"Disponibles: {', '.join(sorted(self.METODOS_IMPLEMENTADOS))}"
        )

    def _guardar_iteraciones(self, job_id: int, resultado: dict, metodo_original: str):
        iteraciones = resultado.get('iteraciones', [])
        if not iteraciones:
            print("  (Sin iteraciones para guardar)")
            return

        for it in iteraciones:
            xi_valor  = it.get('xi_nuevo', it.get('x_nuevo'))
            error_valor = it.get('error', it.get('error_maximo', 0))

            if isinstance(xi_valor, list):
                xi_str = json.dumps(xi_valor)
            elif xi_valor is None:
                xi_str = None
            else:
                xi_str = str(xi_valor)

            self.db.save_iteration(
                job_id=job_id,
                iteracion=it['iteracion'],
                xi=xi_str,
                error=error_valor,
                datos_adicionales={**it, 'metodo': metodo_original}
            )

            try:
                err_fmt = f"{float(error_valor):.4f}"
            except (TypeError, ValueError):
                err_fmt = str(error_valor)
            print(f"  Paso {it['iteracion']} [{it.get('tipo','?')}]: {it.get('descripcion', '')} | err={err_fmt}")


if __name__ == "__main__":
    worker = NumericWorker()
    worker.start()