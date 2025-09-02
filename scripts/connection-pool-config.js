// Connection Pool Configuration for High Availability
// Use with your Node.js application for optimal database connections

const { Pool } = require('pg');

// Production connection pool configuration
const createConnectionPool = (config = {}) => {
  return new Pool({
    // Connection settings
    connectionString: process.env.DATABASE_URL,
    
    // Pool size settings
    min: config.minConnections || 2,
    max: config.maxConnections || 20,
    
    // Connection timeout settings
    connectionTimeoutMillis: config.connectionTimeout || 5000,
    idleTimeoutMillis: config.idleTimeout || 30000,
    
    // Query timeout
    query_timeout: config.queryTimeout || 30000,
    
    // Retry and error handling
    acquireTimeoutMillis: config.acquireTimeout || 10000,
    
    // Keep alive settings for long-lived connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    
    // Statement timeout
    statement_timeout: config.statementTimeout || 60000,
    
    // Application name for monitoring
    application_name: config.appName || 'medical-scheduler',
    
    // Connection validation
    allowExitOnIdle: true,
  });
};

// Connection pool monitoring
const monitorPool = (pool) => {
  // Log pool statistics every minute
  setInterval(() => {
    console.log('Pool Stats:', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });
  }, 60000);
  
  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
    // Implement your error reporting here (e.g., Sentry, Datadog)
  });
  
  pool.on('connect', () => {
    console.log('New client connected to database');
  });
  
  pool.on('remove', () => {
    console.log('Client removed from database pool');
  });
};

// Health check function
const checkPoolHealth = async (pool) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    return {
      status: 'healthy',
      timestamp: result.rows[0].now,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  }
};

// Graceful shutdown
const gracefulShutdown = async (pool) => {
  console.log('Gracefully shutting down database pool...');
  await pool.end();
  console.log('Database pool closed');
};

// Circuit breaker pattern for database resilience
class DatabaseCircuitBreaker {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(queryFn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await queryFn(this.pool);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure(error) {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
    
    console.error(`Database operation failed (${this.failures}/${this.failureThreshold}):`, error.message);
  }
}

// Usage example
const setupDatabase = () => {
  const pool = createConnectionPool({
    minConnections: 5,
    maxConnections: 25,
    connectionTimeout: 10000,
    queryTimeout: 30000,
    appName: 'medical-scheduler-prod'
  });
  
  monitorPool(pool);
  
  const circuitBreaker = new DatabaseCircuitBreaker(pool);
  
  // Handle process termination
  process.on('SIGINT', () => gracefulShutdown(pool));
  process.on('SIGTERM', () => gracefulShutdown(pool));
  
  return { pool, circuitBreaker, healthCheck: () => checkPoolHealth(pool) };
};

module.exports = {
  createConnectionPool,
  monitorPool,
  checkPoolHealth,
  gracefulShutdown,
  DatabaseCircuitBreaker,
  setupDatabase
};