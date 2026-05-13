import pyodbc
import json
from typing import Dict, Any, Optional
from config import SQL_CONNECTION_STRING


class DatabaseManager:
    def __init__(self):
        self.conn = None

    def connect(self):
        """Establece conexión con SQL Server"""
        try:
            self.conn = pyodbc.connect(SQL_CONNECTION_STRING)
            print("✅ Conexión a SQL Server establecida")
        except Exception as e:
            print(f"❌ Error conectando a SQL Server: {e}")
            raise

    def close(self):
        """Cierra la conexión"""
        if self.conn:
            self.conn.close()

    def get_job(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Obtiene un job por su ID"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT Id, Metodo, Parametros, Estado
            FROM Jobs
            WHERE Id = ?
        """, job_id)

        row = cursor.fetchone()
        if not row:
            return None

        return {
            'id': row.Id,
            'metodo': row.Metodo,
            'parametros': json.loads(row.Parametros),
            'estado': row.Estado
        }

    def update_job_status(self, job_id: int, status: str,
                          error_message: str = None):
        """Actualiza el estado del job"""
        cursor = self.conn.cursor()

        if status == 'RUNNING':
            cursor.execute("""
                UPDATE Jobs
                SET Estado = ?, FechaInicio = GETDATE()
                WHERE Id = ?
            """, status, job_id)
        elif status in ('DONE', 'FAILED'):
            cursor.execute("""
                UPDATE Jobs
                SET Estado = ?, FechaFin = GETDATE()
                WHERE Id = ?
            """, status, job_id)
        else:
            cursor.execute("""
                UPDATE Jobs SET Estado = ? WHERE Id = ?
            """, status, job_id)

        if error_message:
            cursor.execute("""
                UPDATE Jobs SET ErrorMessage = ? WHERE Id = ?
            """, error_message, job_id)

        self.conn.commit()

    def save_result(self, job_id: int, resultado: Dict[str, Any],
                    tiempo_ms: int):
        """
        Guarda el resultado final del job.

        CAMBIO IMPORTANTE: ahora se guarda el resultado COMPLETO (incluyendo
        el array de iteraciones, mensaje, tolerancia, raiz_es_compleja, etc.)
        para que el frontend pueda renderizar la grafica de convergencia y
        la tabla de iteraciones desde el campo Resultado directamente.

        Las iteraciones tambien se guardan en la tabla JobIterations (eso
        sigue intacto), pero el frontend lee de aqui por practicidad.
        """
        cursor = self.conn.cursor()

        converged = resultado.get('convergio', False)

        # Serializar TODO el resultado tal como viene del metodo numerico.
        # default=str es un cinturon de seguridad por si aparece algun tipo
        # no serializable directamente (ej. expresiones sympy o numeros complejos).
        resultado_json = json.dumps(resultado, default=str, ensure_ascii=False)

        cursor.execute("""
            UPDATE Jobs
            SET Estado = 'DONE',
                Resultado = ?,
                Converged = ?,
                TiempoEjecucionMs = ?,
                FechaFin = GETDATE()
            WHERE Id = ?
        """, resultado_json, converged, tiempo_ms, job_id)

        self.conn.commit()

    def save_failed_job(self, job_id: int, error_message: str):
        """Guarda un job fallido"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE Jobs
            SET Estado = 'FAILED',
                ErrorMessage = ?,
                FechaFin = GETDATE()
            WHERE Id = ?
        """, error_message, job_id)
        self.conn.commit()

    def save_iteration(self, job_id: int, iteracion: int,
                       xi: Any, error: float,
                       datos_adicionales: Dict[str, Any]):
        """Guarda una iteración en la tabla JobIterations"""
        cursor = self.conn.cursor()

        # Convertir xi a string si es necesario
        xi_str = str(xi) if xi is not None else None

        cursor.execute("""
            INSERT INTO JobIterations (JobId, Iteracion, Xi, Error, DatosAdicionales)
            VALUES (?, ?, ?, ?, ?)
        """, job_id, iteracion, xi_str, error, json.dumps(datos_adicionales, default=str, ensure_ascii=False))

        self.conn.commit()