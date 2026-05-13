import os

# Configuración desde variables de entorno (para Docker)
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_QUEUE = 'job_queue'

SQL_SERVER = os.getenv('SQL_SERVER', 'localhost')
SQL_DATABASE = os.getenv('SQL_DATABASE', 'MetodosNumericosDB')
SQL_USERNAME = os.getenv('SQL_USERNAME', 'sa')
SQL_PASSWORD = os.getenv('SQL_PASSWORD', 'Metodos2026!')

# Connection string para SQL Server
SQL_CONNECTION_STRING = (
    f'DRIVER={{ODBC Driver 18 for SQL Server}};'
    f'SERVER={SQL_SERVER};'
    f'DATABASE={SQL_DATABASE};'
    f'UID={SQL_USERNAME};'
    f'PWD={SQL_PASSWORD};'
    f'TrustServerCertificate=yes;'
)

# Configuración del worker
POLL_INTERVAL = 1  # segundos entre intentos de obtener job