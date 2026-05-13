import redis
import json
from typing import Optional
from config import REDIS_HOST, REDIS_PORT, REDIS_QUEUE

class RedisQueue:
    def __init__(self):
        self.client = redis.Redis(
            host=REDIS_HOST, 
            port=REDIS_PORT,
            decode_responses=True
        )
        self.queue_name = REDIS_QUEUE
    
    def pop_job(self) -> Optional[int]:
        """
        Toma un job de la cola (BLPOP - bloqueante)
        Retorna el job_id como int o None si hay error
        """
        try:
            # BLPOP espera hasta 5 segundos por un job
            result = self.client.blpop(self.queue_name, timeout=5)
            if result:
                _, job_id_str = result
                return int(job_id_str)
            return None
        except Exception as e:
            print(f" Error al tomar job de Redis: {e}")
            return None
    
    def ping(self) -> bool:
        """Verifica conexión con Redis"""
        try:
            return self.client.ping()
        except:
            return False