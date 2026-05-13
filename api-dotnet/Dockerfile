# === Stage 1: Build con SDK de .NET 10 ===
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY APLIMETODOS/APLIMETODOS.csproj APLIMETODOS/
RUN dotnet restore APLIMETODOS/APLIMETODOS.csproj

COPY APLIMETODOS/ APLIMETODOS/
RUN dotnet publish APLIMETODOS/APLIMETODOS.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# === Stage 2: Runtime con ASP.NET 10 ===
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 5000

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "APLIMETODOS.dll"]
