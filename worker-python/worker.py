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
    """

    # Mapeo de nombres normalizados a sus dispatchers internos.
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

        # Conectar a servicios
        self.db.connect()

        if not self.redis.ping():
            print("ERROR: No se pudo conectar a Redis")
            return

        print("Conexiones establecidas")
        print(f"Esperando jobs en cola: {self.redis.queue_name}")
        print("-" * 60)

        while self.running:
            try:
                # Tomar job de Redis (BLPOP)
                job_id = self.redis.pop_job()

                if job_id is None:
                    time.sleep(POLL_INTERVAL)
                    continue

                # Procesar job
                self.process_job(job_id)

            except KeyboardInterrupt:
                print("\nWorker detenido por usuario")
                break
            except Exception as e:
                print(f"Error inesperado: {e}")
                traceback.print_exc()
                time.sleep(5)

        self.db.close()

    # ---------------------------------------------------------------------
    # PROCESAMIENTO DE UN JOB
    # ---------------------------------------------------------------------
    def process_job(self, job_id: int):
        """Procesa un job especifico: lo ejecuta y guarda iteraciones + resultado."""
        print(f"\nProcesando Job ID: {job_id}")

        # Obtener job de BD
        job = self.db.get_job(job_id)
        if not job:
            print(f"ERROR: Job {job_id} no encontrado en BD")
            return

        # Marcar como RUNNING
        self.db.update_job_status(job_id, 'RUNNING')
        start_time = time.time()

        try:
            # Preparar parametros y normalizar el nombre del metodo
            params = job['parametros'].copy() if job['parametros'] else {}
            metodo_original = job['metodo']
            metodo = self._normalizar_metodo(metodo_original)

            print(f"  Metodo: '{metodo_original}' -> '{metodo}'")
            print(f"  Parametros: {params}")

            # Ejecutar el metodo correspondiente
            resultado = self._ejecutar_metodo(metodo, params)

            # Guardar todas las iteraciones en BD
            self._guardar_iteraciones(job_id, resultado, metodo_original)

            # Calcular tiempo de ejecucion y guardar resultado final
            elapsed_ms = int((time.time() - start_time) * 1000)
            self.db.save_result(job_id, resultado, elapsed_ms)

            valor_final = resultado.get('raiz', resultado.get('solucion', 'N/A'))
            print(f"OK Job {job_id} completado en {elapsed_ms}ms")
            print(f"   Convergio: {resultado.get('convergio')}")
            print(f"   Resultado: {valor_final}")
            print(f"   Total iteraciones: {resultado.get('total_iteraciones', 0)}")

        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            print(f"ERROR Job {job_id} fallo: {error_msg}")
            traceback.print_exc()
            self.db.save_failed_job(job_id, error_msg)

    # ---------------------------------------------------------------------
    # DISPATCHER DE METODOS
    # ---------------------------------------------------------------------
    @staticmethod
    def _normalizar_metodo(nombre: str) -> str:
        """
        Normaliza el nombre del metodo recibido desde la API a snake_case.

        Acepta variantes como:
          'Newton-Raphson', 'newton-raphson', 'Newton Raphson',
          'newton_raphson' -> todos quedan como 'newton_raphson'
          'Gauss-Seidel', 'Gauss Seidel' -> 'gauss_seidel'
          'Muller', 'muller', 'Müller' -> 'muller'
        """
        if not nombre:
            return ''
        # Normalizar la diéresis de Müller a u simple
        nombre_limpio = nombre.replace('ü', 'u').replace('Ü', 'U')
        return nombre_limpio.strip().lower().replace('-', '_').replace(' ', '_')

    def _ejecutar_metodo(self, metodo: str, params: dict) -> dict:
        """
        Llama al metodo numerico correspondiente segun el nombre normalizado.
        Lanza ValueError si el metodo no existe, NotImplementedError si esta
        listado pero aun no codificado.
        """
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
        """
        Recorre la lista de iteraciones del resultado y persiste cada una.

        Cada metodo guarda su valor 'xi' con un nombre y forma distinta:
          - Newton-Raphson, Secante y Muller: 'xi_nuevo' (escalar o str si es complejo)
          - Gauss-Seidel: 'x_nuevo' (lista de floats - vector solucion)

        Para mantener un esquema unico de la columna Xi en BD, los vectores
        se serializan a JSON string. Toda la informacion detallada del paso
        a paso queda en el campo datos_adicionales.
        """
        iteraciones = resultado.get('iteraciones', [])
        if not iteraciones:
            print("  (Sin iteraciones para guardar)")
            return

        for it in iteraciones:
            # Extraer xi y error segun el formato del metodo
            xi_valor = it.get('xi_nuevo', it.get('x_nuevo'))
            error_valor = it.get('error', it.get('error_maximo', 0))

            # Serializar el xi: si es lista (Gauss-Seidel) -> JSON; si no, str
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

            print(f"  Iteracion {it['iteracion']}: xi={xi_str}, error={error_valor:.4f}%")


if __name__ == "__main__":
    worker = NumericWorker()
    worker.start()
