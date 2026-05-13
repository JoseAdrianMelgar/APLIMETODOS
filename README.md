# APLIMETODOS

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

## Detener el sistema

```bash
# Detener los contenedores (preserva los datos en SQL Server)
docker compose down

# Detener y borrar todo incluyendo volúmenes (la base de datos se reinicia)
docker compose down -v
```

---

## Autor

**José Adrián Monterroso Melgar**
Estudiante de Ingeniería en Sistemas
Universidad Mariano Gálvez de Guatemala

GitHub: [@JoseAdrianMelgar](https://github.com/JoseAdrianMelgar)

---

## Licencia

Proyecto académico — Curso 021 Métodos Numéricos, UMG 2026.
