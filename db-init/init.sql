USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'MetodosNumericosDB')
BEGIN
    CREATE DATABASE MetodosNumericosDB;
END
GO

USE MetodosNumericosDB;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Jobs')
BEGIN
    CREATE TABLE Jobs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Metodo NVARCHAR(50) NOT NULL,
        Parametros NVARCHAR(MAX) NOT NULL,
        Estado NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        Resultado NVARCHAR(MAX) NULL,
        Converged BIT NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        TiempoEjecucionMs INT NULL,
        FechaCreacion DATETIME2 NULL DEFAULT GETDATE(),
        FechaInicio DATETIME2 NULL,
        FechaFin DATETIME2 NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'JobIterations')
BEGIN
    CREATE TABLE JobIterations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        JobId INT NOT NULL,
        Iteracion INT NOT NULL,
        Xi NVARCHAR(MAX) NULL,
        Error FLOAT NULL,
        DatosAdicionales NVARCHAR(MAX) NULL,
        Fecha DATETIME2 NULL DEFAULT GETDATE(),
        CONSTRAINT FK_JobIterations_Jobs FOREIGN KEY (JobId)
            REFERENCES Jobs(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_JobIterations_JobId ON JobIterations(JobId);
END
GO

PRINT 'Base MetodosNumericosDB inicializada correctamente.';
GO
