using System.ComponentModel.DataAnnotations;

namespace APLIMETODOS.Models;

public class Job
{
    [Key]
    public int Id { get; set; }  // auto-increment, lo asigna SQL Server

    public string Metodo { get; set; } = string.Empty;
    public string Parametros { get; set; } = string.Empty;
    public string Estado { get; set; } = "Pending";
    public string? Resultado { get; set; }
    public bool? Converged { get; set; }
    public string? ErrorMessage { get; set; }
    public int? TiempoEjecucionMs { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFin { get; set; }
}