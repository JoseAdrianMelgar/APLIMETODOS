using APLIMETODOS.Models;
using Microsoft.EntityFrameworkCore;

namespace APLIMETODOS.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Job> Jobs { get; set; }
    public DbSet<JobIteration> JobIterations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuracion explicita de la entidad JobIteration.
        // La tabla ya existe en SQL Server con la FK FK__JobIterat__JobId__3C69FB99,
        // aqui solo le decimos a EF Core como mapearla.
        modelBuilder.Entity<JobIteration>(entity =>
        {
            entity.ToTable("JobIterations");

            entity.HasKey(it => it.Id);

            entity.HasOne(it => it.Job)
                  .WithMany()
                  .HasForeignKey(it => it.JobId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}