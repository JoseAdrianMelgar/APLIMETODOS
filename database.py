import pyodbc
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
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
        """Guarda el resultado final del job"""
        cursor = self.conn.cursor()
        
        # Extraer datos del resultado
        converged = resultado.get('convergio', False)
        raiz = resultado.get('raiz')
        
        # Para sistemas lineales, la raíz es el vector solución
        if 'solucion' in resultado:
            resultado_para_guardar = {
                'solucion': resultado['solucion'],
                'convergio': converged,
                'total_iteraciones': resultado.get('total_iteraciones', 0)
            }
        else:
            resultado_para_guardar = {
                'raiz': raiz,
                'convergio': converged,
                'total_iteraciones': resultado.get('total_iteraciones', 0),
                'funcion': resultado.get('funcion'),
                'derivada': resultado.get('derivada')
            }
        
        cursor.execute("""
            UPDATE Jobs 
            SET Estado = 'DONE', 
                Resultado = ?,
                Converged = ?,
                TiempoEjecucionMs = ?,
                FechaFin = GETDATE()
            WHERE Id = ?
        """, json.dumps(resultado_para_guardar), converged, tiempo_ms, job_id)
        
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
        """Guarda una iteración en la base de datos"""
        cursor = self.conn.cursor()
        
        # Convertir xi a string si es necesario
        xi_str = str(xi) if xi is not None else None
        
        cursor.execute("""
            INSERT INTO JobIterations (JobId, Iteracion, Xi, Error, DatosAdicionales)
            VALUES (?, ?, ?, ?, ?)
        """, job_id, iteracion, xi_str, error, json.dumps(datos_adicionales))
        
        self.conn.commit()