# APLIMETODOS.

**Plataforma de Ejecución, Trazabilidad y Comparación de Métodos Numéricos con Arquitectura Híbrida**

Proyecto Final — Curso 021 Métodos Numéricos
Ingeniería en Sistemas | Universidad Mariano Gálvez de Guatemala
Catedrático: Ing. MA. Carmelo Estuardo Mayén Monterroso

---

## Descripción

APLIMETODOS es una plataforma distribuida que ejecuta métodos numéricos de forma **100% asíncrona**, separando la interfaz, la lógica de API y el cómputo numérico en servicios independientes coordinados mediante una cola Redis. Cada job se persiste en SQL Server con su paso a paso iteración por iteración, permitiendo análisis completo de convergencia.

---

## Arquitectura

El sistema se compone de **5 servicios dockerizados** que se comunican mediante red interna:

```
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ Frontend │ HTTP→ │ API .NET │ RPUSH→ │  Redis   │
  │  React   │       │   10     │        │    7     │
  └──────────┘       └────┬─────┘        └────┬─────┘
                          │ SQL                │ BLPOP
                          ↓                    ↓
                    ┌──────────┐        ┌──────────┐
                    │SQL Server│←──────│  Worker  │
                    │   2022   │ INSERT│  Python  │
                    └──────────┘       └──────────┘
```

**Flujo:** El frontend envía un POST a la API → la API persiste el job en SQL con estado PENDING y hace RPUSH en Redis → el worker hace BLPOP, lee parámetros de SQL, ejecuta iteración por iteración, inserta cada iteración en `JobIterations` y actualiza el estado a DONE → el frontend hace polling cada 5s a GET `/api/jobs/{id}` y obtiene el resultado final.

---

## Stack Tecnológico

| Servicio | Tecnología |
|---|---|
| Frontend | React 19 · TypeScript · Vite 6 · Tailwind · Recharts · KaTeX |
| API | .NET 10 · EF Core 9 · StackExchange.Redis · Scalar |
| Worker | Python 3.12 · SymPy · NumPy · pyodbc · redis-py |
| Cola | Redis 7 |
| Base de datos | SQL Server 2022 |
| Orquestación | Docker Compose |

---

## Requisitos previos

Lo único que se necesita es:

- [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado y corriendo

No hace falta instalar .NET, Node, Python ni SQL Server. Todo corre dentro de contenedores.

---

## Inicio rápido
> ⚠️ **Importante**: el archivo `.env` no está en el repositorio (contiene credenciales). Asegurate de copiar `.env.example` → `.env` antes de levantar Docker. Si te salteás este paso, SQL Server arranca con password vacío y la API tira error 500.


```bash
# 1. Clonar el repositorio
git clone https://github.com/JoseAdrianMelgar/APLIMETODOS.git
cd APLIMETODOS

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar el sistema completo (los 5 servicios)
docker compose up --build
```

La primera ejecución descarga imágenes y compila los 3 servicios propios — puede tardar entre 5 y 15 minutos. Las siguientes corridas son cuestión de segundos gracias al caché.

---

## URLs de acceso

Una vez levantado:

| Servicio | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| API REST | http://localhost:5000/api/jobs |
| Documentación API (Scalar) | http://localhost:5000/scalar/v1 |
| SQL Server | localhost,1433 |
| Redis | localhost:6379 |

---

## Estructura del repositorio

```
APLIMETODOS/
├── api-dotnet/           # API .NET 10 + Dockerfile
│   ├── APLIMETODOS.sln
│   └── APLIMETODOS/
│       ├── Controllers/
│       ├── Models/
│       ├── Data/
│       └── Services/
├── worker-python/        # Worker Python + Dockerfile
│   ├── worker.py
│   ├── metodos_numericos.py
│   ├── database.py
│   ├── redis_client.py
│   └── config.py
├── frontend/             # SPA React + Dockerfile + nginx.conf
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       └── types/
├── db-init/              # Script de inicialización SQL
│   └── init.sql
├── docs/                 # Manuales, informe, video demo
├── docker-compose.yml    # Orquestación de los 5 servicios
├── .env.example          # Plantilla de variables de entorno
└── .gitignore
```

---

## Métodos numéricos disponibles

### Raíces de ecuaciones

| Método | Parámetros | Estado |
|---|---|---|
| Newton-Raphson | `funcion_str`, `x0`, `tol`, `max_iter` | ✅ |
| Secante | `funcion_str`, `x0`, `x1`, `tol`, `max_iter` | ✅ |
| Müller | `funcion_str`, `x0`, `x1`, `x2`, `tol`, `max_iter` (soporta raíces complejas) | ✅ |

### Sistemas de ecuaciones lineales

| Método | Parámetros | Estado |
|---|---|---|
| Gauss | `A`, `b` | 🔄 En desarrollo |
| Gauss-Seidel | `A`, `b`, `x_inicial`, `tol`, `max_iter` | ✅ |
| Gauss-Jordan | `A`, `b` | 🔄 En desarrollo |

Cada método retorna el paso a paso iteración por iteración con fórmula general, sustitución de valores y resultado.

---

## Endpoints REST

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/jobs` | Crear un nuevo job con un método y sus parámetros |
| `GET` | `/api/jobs` | Listar todos los jobs |
| `GET` | `/api/jobs/{id}` | Obtener un job específico (usado para polling) |
| `GET` | `/api/jobs/{id}/iterations` | Obtener todas las iteraciones del job |

### Ejemplo de creación de job

```bash
curl -X POST http://localhost:5000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "metodo": "newton-raphson",
    "parametros": {
      "funcion_str": "x**2 - 2",
      "x0": 1.0,
      "tol": 0.001,
      "max_iter": 50
    }
  }'
```

---

## Estados de un Job

```
PENDING  →  RUNNING  →  DONE
                     ↘  FAILED
```

- **PENDING**: encolado en Redis, esperando worker.
- **RUNNING**: el worker está ejecutando el método.
- **DONE**: ejecución terminada exitosamente, resultado disponible.
- **FAILED**: ocurrió un error (división por cero, no convergencia, etc.).

---

## Polling asíncrono

Como la ejecución numérica es 100% asíncrona, el frontend implementa **polling automático cada 5 segundos** al endpoint `GET /api/jobs/{id}` después de crear un job. Esto permite detectar el cambio de estado sin necesidad de WebSockets ni que el usuario refresque la página.

### Flujo de polling

```
[Usuario crea job]
        ↓
[POST /api/jobs] → respuesta inmediata { id, estado: "Pending" }
        ↓
[Hook useJobPolling arranca el intervalo]
        ↓
   ┌─── cada 5s ───────────────────────┐
   │   GET /api/jobs/{id}              │
   │   ¿Estado === "DONE" o "FAILED"?  │
   │      NO → seguir polleando        │
   │      SI → detener intervalo       │
   └───────────────────────────────────┘
        ↓
[GET /api/jobs/{id}/iterations] → renderiza gráfica + tabla
```

### Implementación

El polling vive en `frontend/src/hooks/useJobPolling.ts`. Características clave:

- **Intervalo**: 5000 ms (constante `POLL_INTERVAL`).
- **Auto-detención**: se detiene automáticamente cuando el estado pasa a `DONE` o `FAILED` (comparación case-insensitive porque la API inserta `Pending` y el worker actualiza a `DONE`/`FAILED` en mayúsculas).
- **Cleanup**: el `useEffect` limpia el intervalo cuando el componente se desmonta o cambia el `jobId`, evitando memory leaks.
- **Carga de iteraciones diferida**: las iteraciones se piden solo una vez al detectar `DONE`, no en cada poll.

### Ejemplo simplificado del hook

```typescript
useEffect(() => {
    if (!jobId) return;

    const intervalo = setInterval(async () => {
        const response = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
        const job = await response.json();
        setJob(job);

        const estado = job.estado?.toUpperCase();
        if (estado === "DONE" || estado === "FAILED") {
            clearInterval(intervalo);
        }
    }, 5000);

    return () => clearInterval(intervalo);
}, [jobId]);
```

### ¿Por qué polling y no WebSockets?

El enunciado del proyecto solicita explícitamente polling cada 5 segundos por:

1. **Simplicidad de la arquitectura**: no requiere un canal persistente bidireccional.
2. **Compatibilidad con stateless REST**: la API .NET no necesita mantener conexiones abiertas.
3. **Tolerancia a fallos**: si una petición de polling falla (red, reinicio del servicio), la siguiente reintentará automáticamente.
4. **Carga predecible**: 1 request cada 5s por usuario activo es trivial para el servidor.

---


## Detener el sistema

```bash
# Detener los contenedores (preserva los datos en SQL Server)
docker compose down

# Detener y borrar todo incluyendo volúmenes (la base de datos se reinicia)
docker compose down -v
```

---

## Autores

Proyecto desarrollado por estudiantes de Ingeniería en Sistemas de la Universidad Mariano Gálvez de Guatemala:

| Carnet | Nombre |
|---|---|
| 1790-24-14368 | José Adrián Monterroso Melgar |
| 1790-24-26001 | Luis Enrique Escobar Vides |
| 1790-24-26929 | Bayrón Esau Morales Mazariegos |
| 1790-24-20456 | César Gustavo Castillo García |
| 1790-24-15648 | Nathalie María Amalia Carbajal García |

GitHub del proyecto: [JoseAdrianMelgar/APLIMETODOS](https://github.com/JoseAdrianMelgar/APLIMETODOS)

---


## Licencia

Proyecto académico — Curso 021 Métodos Numéricos, UMG 2026.
