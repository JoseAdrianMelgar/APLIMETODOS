-- ========================================
-- BASE DE DATOS - VERSIÓN FINAL
-- ========================================
USE master;
GO

IF DB_ID('MetodosNumericosDB') IS NOT NULL
BEGIN
    ALTER DATABASE MetodosNumericosDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE MetodosNumericosDB;
END
GO

CREATE DATABASE MetodosNumericosDB;
GO

USE MetodosNumericosDB;
GO

-- TABLA PRINCIPAL: Jobs
CREATE TABLE Jobs (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Metodo NVARCHAR(50) NOT NULL,
    Parametros NVARCHAR(MAX) NOT NULL,
    Estado NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    Resultado NVARCHAR(MAX) NULL,
    Converged BIT NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    TiempoEjecucionMs INT NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaInicio DATETIME2 NULL,
    FechaFin DATETIME2 NULL
);
GO

-- TABLA DE ITERACIONES
CREATE TABLE JobIterations (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    JobId INT NOT NULL,
    Iteracion INT NOT NULL,
    Xi NVARCHAR(MAX) NULL,
    Error FLOAT NULL,
    DatosAdicionales NVARCHAR(MAX) NULL,
    Fecha DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (JobId) REFERENCES Jobs(Id) ON DELETE CASCADE
);
GO

-- ÍNDICES
CREATE INDEX IX_Jobs_Estado ON Jobs(Estado);
CREATE INDEX IX_Jobs_FechaCreacion ON Jobs(FechaCreacion);
CREATE INDEX IX_JobIterations_JobId ON JobIterations(JobId);
GO