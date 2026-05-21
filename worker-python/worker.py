import time
import json
import traceback

from config import POLL_INTERVAL
from database import DatabaseManager
from redis_client import RedisQueue
from metodos_numericos import MetodosNumericos


class NumericWorker:
    """
    Worker que escucha la cola de Redis, toma jobs y los procesa con la
    clase MetodosNumericos. Soporta los 4 metodos ya implementados:
    Newton-Raphson, Secante, Muller y Gauss-Seidel. Los 2 restantes
    (Gauss y Gauss-Jordan) estan listados pero pendientes de implementacion.

    RESILIENCIA: ningun job individual (ni un fallo de BD) debe tumbar el
    worker. Si la conexion a SQL se cae, se reconecta. Los jobs que ya no
    estan en PENDING se omiten (idempotencia) para evitar reprocesos por spam.
    """

    METODOS_IMPLEMENTADOS = {'newton_raphson', 'secante', 'muller', 'gauss_seidel'}
    METODOS_PENDIENTES = {'gauss', 'gauss_jordan'}

    def __init__(self):
        self.db = DatabaseManager()
        self.redis = RedisQueue()
        self.metodos = MetodosNumericos()
        self.running = True

    # ---------------------------------------------------------------------
    # CICLO PRINCIPAL
    # ---------------------------------------------------------------------
    def start(self):
        """Inicia el worker en modo escucha continua."""
        print("=" * 60)
        print("WORKER NUMERICO - Metodos Numericos")
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
                # Cualquier error inesperado: NO matamos el worker. Intentamos
                # recuperar la conexion a BD (causa #1 de jobs colgados) y seguimos.
                print(f"Error inesperado en el loop principal: {e}")
                traceback.print_exc()
                try:
                    self.db.ensure_connection()
                except Exception as recon_err:
                    print(f"No se pudo reconectar a BD: {recon_err}")
                time.sleep(5)

        self.db.close()

    # ---------------------------------------------------------------------
    # PROCESAMIENTO DE UN JOB
    # ---------------------------------------------------------------------
    def process_job(self, job_id: int):
        """Procesa un job especifico: lo ejecuta y guarda iteraciones + resultado."""
        print(f"\nProcesando Job ID: {job_id}")

        # Asegurar conexion viva antes de tocar la BD (recupera de colapsos previos)
        self.db.ensure_connection()

        job = self.db.get_job(job_id)
        if not job:
            print(f"ERROR: Job {job_id} no encontrado en BD")
            return

        # ----- IDEMPOTENCIA: no re-ejecutar jobs que ya no estan PENDING -----
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
            self.db.save_result(job_id, resultado, elapsed_ms)

            valor_final = resultado.get('raiz', resultado.get('solucion', 'N/A'))
            print(f"OK Job {job_id} completado en {elapsed_ms}ms")
            print(f"   Convergio: {resultado.get('convergio')}")
            print(f"   Resultado: {valor_final}")
            print(f"   Total iteraciones: {resultado.get('total_iteraciones', 0)}")

        except Exception as e:
            # El job fallo, pero el worker SIGUE VIVO. Marcamos FAILED para que
            # nunca quede en Pending/Running para siempre.
            error_msg = f"{type(e).__name__}: {str(e)}"
            print(f"ERROR Job {job_id} fallo: {error_msg}")
            traceback.print_exc()
            try:
                self.db.ensure_connection()
                self.db.save_failed_job(job_id, error_msg)
            except Exception as save_err:
                print(f"No se pudo marcar el job {job_id} como FAILED: {save_err}")

    # ---------------------------------------------------------------------
    # DISPATCHER DE METODOS
    # ---------------------------------------------------------------------
    @staticmethod
    def _normalizar_metodo(nombre: str) -> str:
        if not nombre:
            return ''
        nombre_limpio = nombre.replace('ü', 'u').replace('Ü', 'U')
        return nombre_limpio.strip().lower().replace('-', '_').replace(' ', '_')

    def _ejecutar_metodo(self, metodo: str, params: dict) -> dict:
        if metodo == 'newton_raphson':
            return self.metodos.newton_raphson(**params)

        if metodo == 'secante':
            return self.metodos.secante(**params)

        if metodo == 'muller':
            return self.metodos.muller(**params)

        if metodo == 'gauss_seidel':
            return self.metodos.gauss_seidel(**params)

        if metodo in self.METODOS_PENDIENTES:
            raise NotImplementedError(
                f"El metodo '{metodo}' aun no esta implementado en el worker. "
                f"Pendientes: {', '.join(sorted(self.METODOS_PENDIENTES))}"
            )

        raise ValueError(
            f"Metodo desconocido: '{metodo}'. "
            f"Disponibles: {', '.join(sorted(self.METODOS_IMPLEMENTADOS))}"
        )

    # ---------------------------------------------------------------------
    # PERSISTENCIA DE ITERACIONES
    # ---------------------------------------------------------------------
    def _guardar_iteraciones(self, job_id: int, resultado: dict, metodo_original: str):
        iteraciones = resultado.get('iteraciones', [])
        if not iteraciones:
            print("  (Sin iteraciones para guardar)")
            return

        for it in iteraciones:
            xi_valor = it.get('xi_nuevo', it.get('x_nuevo'))
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
                datos_adicionales={
                    **it,
                    'metodo': metodo_original
                }
            )

            # Print defensivo: si el error no es numerico, no tumbamos el loop.
            try:
                err_fmt = f"{float(error_valor):.4f}"
            except (TypeError, ValueError):
                err_fmt = str(error_valor)
            print(f"  Iteracion {it['iteracion']}: xi={xi_str}, error={err_fmt}%")


if __name__ == "__main__":
    worker = NumericWorker()
    worker.start()