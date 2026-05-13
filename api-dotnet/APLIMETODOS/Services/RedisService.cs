using StackExchange.Redis;

namespace APLIMETODOS.Services;

public class RedisService
{
    private readonly IConnectionMultiplexer _redis;
    private const string QueueName = "job_queue";

    public RedisService(IConfiguration config)
    {
        _redis = ConnectionMultiplexer.Connect(
            config.GetConnectionString("RedisConnection")!
        );
    }

    /// <summary>
    /// Empuja un job ID a la cola de Redis con RPUSH job_queue {id}.
    /// El worker Python hace BLPOP y espera leer solo un entero (como string)
    /// para luego buscar los parametros del job en SQL Server.
    /// </summary>
    public async Task EnqueueJobAsync(int jobId)
    {
        var db = _redis.GetDatabase();
        await db.ListRightPushAsync(QueueName, jobId);
    }
}