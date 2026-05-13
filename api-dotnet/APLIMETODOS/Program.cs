using Microsoft.AspNetCore.OpenApi;
using Scalar.AspNetCore;
using Microsoft.EntityFrameworkCore;
using APLIMETODOS.Data;      // Namespace de tu carpeta Data
using APLIMETODOS.Services; // Namespace de tu carpeta Services

var builder = WebApplication.CreateBuilder(args);

// 1. Forzamos el puerto 5000 para el frontend de React
builder.WebHost.UseUrls("http://*:5000");

// 2. Agregamos los controladores
builder.Services.AddControllers();

// 3. CONFIGURACIÓN DE LA BASE DE DATOS (Entity Framework)
// Esto lee la "DefaultConnection" de tu appsettings.json
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 4. REGISTRO DE REDIS (Singleton para mantener una sola conexión)
// Esto lee la "RedisConnection" de tu appsettings.json
builder.Services.AddSingleton<RedisService>();

// 5. Configurar OpenAPI/Scalar para la documentación
builder.Services.AddOpenApi();

// --- AQUÍ AGREGAMOS LA REGLA DE CORS PARA REACT ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
// --------------------------------------------------

var app = builder.Build();

// --- AQUÍ ENCENDEMOS EL CORS --- (Debe ir antes de app.UseAuthorization)
app.UseCors("PermitirFrontend");
// -------------------------------

// Configurar el pipeline de HTTP
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // Interfaz de Scalar en http://localhost:5000/scalar/v1
    app.MapScalarApiReference();
}

app.UseAuthorization();
app.MapControllers();

app.Run();