using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APLIMETODOS.Models;

/// <summary>
/// Mapea la tabla JobIterations de SQL Server. Cada fila representa una
/// iteracion individual del calculo numerico ejecutado por el worker Python.
/// La tabla ya existe en la BD (no necesita migracion).
/// </summary>
public class JobIteration
{
    [Key]
    public int Id { get; set; }

    public int JobId { get; set; }

    // Navigation property: relacion N:1 con Job (un Job tiene muchas iteraciones).
    [ForeignKey(nameof(JobId))]
    public Job? Job { get; set; }

    public int Iteracion { get; set; }

    // Xi se guarda como string porque para metodos escalares es un numero
    // (ej. "1.5213797"), para Gauss-Seidel es un vector JSON (ej. "[1.0, 2.0]"),
    // y para Muller puede ser un complejo (ej. "(1+2j)").
    public string? Xi { get; set; }

    public double? Error { get; set; }

    // JSON serializado con el paso a paso completo de la iteracion
    // (formula, sustitucion, calculo, etc. segun el metodo).
    public string? DatosAdicionales { get; set; }

    public DateTime? Fecha { get; set; }
}