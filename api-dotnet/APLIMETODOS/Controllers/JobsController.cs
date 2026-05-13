using APLIMETODOS.Data;
using APLIMETODOS.Models;
using APLIMETODOS.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace APLIMETODOS.Controllers;

[ApiController]
[Route("api/jobs")]
public class JobsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RedisService _redis;
    private readonly ILogger<JobsController> _logger;

    public JobsController(
        AppDbContext db,
        RedisService redis,
        ILogger<JobsController> logger)
    {
        _db = db;
        _redis = redis;
        _logger = logger;
    }

    // POST /jobs
    [HttpPost]
    public async Task<IActionResult> CreateJob([FromBody] CreateJobRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Metodo))
            return BadRequest(new { error = "El campo 'metodo' es requerido." });

        var allowedMethods = new[]
        {
            "newton-raphson", "secante", "muller",
            "gauss", "gauss-seidel", "gauss-jordan"
        };

        // Normalizar el nombre del metodo: minusculas, y unificar
        // guiones bajos, espacios y guiones medios -> guion medio.
        // Asi "Newton-Raphson", "newton_raphson" y "Gauss Seidel" funcionan igual.
        var metodoNormalizado = request.Metodo
            .Trim()
            .ToLower()
            .Replace('_', '-')
            .Replace(' ', '-');

        if (!allowedMethods.Contains(metodoNormalizado))
            return BadRequest(new
            {
                error = $"Metodo invalido. Use uno de: {string.Join(", ", allowedMethods)}"
            });

        // Convertir los parametros (objeto JSON) a string para guardarlos en SQL.
        // Si vienen null, guardamos "{}" para evitar nulls en el worker.
        var parametrosJson = request.Parametros.HasValue
            ? request.Parametros.Value.GetRawText()
            : "{}";

        // Crear el job y guardarlo en SQL como Pending
        var job = new Job
        {
            Metodo = metodoNormalizado,
            Parametros = parametrosJson,
            Estado = "Pending"
        };

        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();

        // Aqui job.Id ya tiene el valor que SQL le asigno (auto-increment)
        // Encolar SOLO el ID en Redis para el worker Python.
        // El worker hace BLPOP y espera leer un entero, no un objeto JSON.
        await _redis.EnqueueJobAsync(job.Id);

        _logger.LogInformation("Job {JobId} creado con metodo {Metodo}", job.Id, job.Metodo);

        return CreatedAtAction(nameof(GetJob), new { id = job.Id }, job);
    }

    // GET /jobs
    [HttpGet]
    public async Task<IActionResult> ListJobs(
        [FromQuery] string? estado = null,
        [FromQuery] string? metodo = null)
    {
        var query = _db.Jobs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(estado))
            query = query.Where(j => j.Estado == estado);

        if (!string.IsNullOrWhiteSpace(metodo))
            query = query.Where(j => j.Metodo == metodo.ToLower());

        var jobs = await query
            .OrderByDescending(j => j.FechaCreacion)
            .ToListAsync();

        return Ok(jobs);
    }

    // GET /jobs/{id} - este es el endpoint que pollea el frontend cada 5s
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetJob(int id)
    {
        var job = await _db.Jobs.FindAsync(id);

        if (job == null)
            return NotFound(new { error = $"Job {id} no encontrado." });

        return Ok(job);
    }

    // GET /jobs/{id}/iterations - historial completo de iteraciones del job.
    // Endpoint Core requerido por la rubrica del proyecto. Devuelve un DTO
    // limpio con DatosAdicionales ya parseado a JSON (no string escapeado).
    [HttpGet("{id:int}/iterations")]
    public async Task<IActionResult> GetJobIterations(int id)
    {
        var job = await _db.Jobs.FindAsync(id);

        if (job == null)
            return NotFound(new { error = $"Job {id} no encontrado." });

        var iteraciones = await _db.JobIterations
            .Where(it => it.JobId == id)
            .OrderBy(it => it.Iteracion)
            .ToListAsync();

        // Mapear a DTO y parsear DatosAdicionales de string JSON -> objeto JSON
        // para que el frontend lo reciba ya estructurado.
        var dtos = iteraciones.Select(it => new JobIterationDto(
            Id: it.Id,
            JobId: it.JobId,
            Iteracion: it.Iteracion,
            Xi: it.Xi,
            Error: it.Error,
            DatosAdicionales: ParseJsonOrNull(it.DatosAdicionales),
            Fecha: it.Fecha
        )).ToList();

        var response = new JobIterationsResponse(
            JobId: id,
            Metodo: job.Metodo,
            Estado: job.Estado,
            TotalIteraciones: dtos.Count,
            Iteraciones: dtos
        );

        return Ok(response);
    }

    // Helper privado: convierte un string JSON a JsonElement, o devuelve null
    // si esta vacio o si falla el parseo (no rompe el endpoint).
    private static object? ParseJsonOrNull(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            return JsonSerializer.Deserialize<JsonElement>(json);
        }
        catch
        {
            // Si no se puede parsear, devolver el string crudo
            return json;
        }
    }
}

// =========================================================================
// DTOs
// =========================================================================

// DTO para el body del POST /jobs.
// Parametros usa JsonElement para que el frontend pueda mandar un objeto
// JSON directamente (no un string escapeado).
public record CreateJobRequest(string Metodo, JsonElement? Parametros);

// DTO de una iteracion individual en la respuesta de GET /jobs/{id}/iterations.
public record JobIterationDto(
    int Id,
    int JobId,
    int Iteracion,
    string? Xi,
    double? Error,
    object? DatosAdicionales,
    DateTime? Fecha
);

// DTO contenedor de la respuesta del endpoint de iteraciones.
public record JobIterationsResponse(
    int JobId,
    string Metodo,
    string Estado,
    int TotalIteraciones,
    IReadOnlyList<JobIterationDto> Iteraciones
);