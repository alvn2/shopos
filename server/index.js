require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const sheets = require('./services/sheets');
const sessionService = require('./services/session');
const cache = require('./services/cache'); // Keeping for non-replaced route endpoints if any
const redisCache = require('./services/redisCache');
const sheetsWorker = require('./workers/sheetsWorker');
const { logger, requestIdMiddleware, requestLoggerMiddleware, metrics, metricsMiddleware } = require('./services/logger');
const { requestTimeout, additionalSecurityHeaders, getLockoutStats } = require('./middleware/security');
const { sanitizeBody } = require('./middleware/validation');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS configuration - MUST be before helmet
// Parse allowed origins from env
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

// Dynamic origin validation
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, same-origin)
        if (!origin) {
            return callback(null, true);
        }

        // In development, allow all
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // In production, check against allowed origins
        if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.vercel.app'))) {
            return callback(null, true);
        }

        logger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-Request-ID'],
    exposedHeaders: ['X-Cache', 'X-Request-ID'] // Allow frontend to see cache status and request ID
};

app.use(cors(corsOptions));

// Security middleware
app.use(helmet());
app.use(additionalSecurityHeaders);

// Request ID and logging middleware
app.use(requestIdMiddleware);
app.use(metricsMiddleware);

// Request timeout (30 seconds)
app.use(requestTimeout(30000));

// Body parsing with size limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Sanitize all incoming request bodies
app.use(sanitizeBody);

// Rate limiting - general
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', generalLimiter);

// Rate limiting - auth (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per 15 minutes
    message: { error: 'Too many login attempts, please try again later' }
});
app.use('/api/auth/login', authLimiter);

// Request logging
if (process.env.NODE_ENV !== 'production') {
    app.use(requestLoggerMiddleware);
} else {
    // In production, log only errors and important events
    app.use((req, res, next) => {
        const startTime = Date.now();
        res.on('finish', () => {
            if (res.statusCode >= 400) {
                logger.warn('Request error', {
                    request_id: req.requestId,
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration_ms: Date.now() - startTime
                });
            }
        });
        next();
    });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/customers', require('./routes/customers'));

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const sheetsStatus = await sheets.testConnection();
        const cacheStats = { type: 'redis', status: redisCache.redisClient ? redisCache.redisClient.status : 'disconnected' };

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            sheets: sheetsStatus.connected ? 'connected' : 'disconnected',
            sheets_title: sheetsStatus.title,
            available_tabs: sheetsStatus.sheets,
            cache: cacheStats
        });
    } catch (error) {
        logger.error('Health check failed', { error });
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Kubernetes-style readiness probe
app.get('/api/ready', async (req, res) => {
    try {
        const sheetsStatus = await sheets.testConnection();
        if (sheetsStatus.connected) {
            res.json({ ready: true });
        } else {
            res.status(503).json({ ready: false, reason: 'Google Sheets not connected' });
        }
    } catch (error) {
        res.status(503).json({ ready: false, reason: error.message });
    }
});

// Liveness probe (simple - just checks if server is responding)
app.get('/api/live', (req, res) => {
    res.json({ alive: true, timestamp: new Date().toISOString() });
});

// Metrics endpoint (for monitoring dashboards)
app.get('/api/metrics', (req, res) => {
    const metricsData = metrics.getStats();
    const lockoutStats = getLockoutStats();
    const cacheStats = { type: 'redis', status: redisCache.redisClient ? redisCache.redisClient.status : 'disconnected' };

    res.json({
        ...metricsData,
        security: {
            locked_ips: lockoutStats.lockedCount,
            tracked_ips: lockoutStats.totalTracked
        },
        cache: cacheStats,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled server error', {
        error: err,
        request_id: req.requestId,
        path: req.path
    });

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        request_id: req.requestId
    });
});

// Cron job: Clean up expired sessions every hour
cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled session cleanup');
    try {
        await sessionService.cleanupExpiredSessions();
        logger.info('Session cleanup completed');
    } catch (error) {
        logger.error('Session cleanup failed', { error });
    }
});

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    logger.info('ShopOS Backend started', { port: PORT, env: process.env.NODE_ENV || 'development' });

    console.log(`
╔════════════════════════════════════════════════════════╗
║                    ShopOS Backend                       ║
╠════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                           ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(20)}         ║
║                                                        ║
║  Endpoints:                                            ║
║    POST   /api/auth/login                              ║
║    POST   /api/auth/logout                             ║
║    GET    /api/inventory                               ║
║    POST   /api/sales                                   ║
║    GET    /api/reports/*                               ║
║    GET    /api/settings                                ║
║    GET    /api/audit                                   ║
║    GET    /api/health                                  ║
║    GET    /api/ready     (readiness probe)             ║
║    GET    /api/live      (liveness probe)              ║
║    GET    /api/metrics   (monitoring)                  ║
╚════════════════════════════════════════════════════════╝
  `);

    // Test Google Sheets connection on startup
    sheets.testConnection().then(result => {
        if (result.connected) {
            logger.info('Google Sheets connected', { title: result.title, sheets: result.sheets });
            console.log(`✅ Google Sheets connected: "${result.title}"`);
            console.log(`   Available tabs: ${result.sheets.join(', ')}`);
        } else {
            logger.error('Google Sheets connection failed', { error: result.error });
            console.log(`❌ Google Sheets not connected: ${result.error}`);
            console.log(`   Make sure your .env file is configured correctly`);
        }
    });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, starting graceful shutdown`);
    console.log(`\n${signal} received. Closing HTTP server...`);

    // Stop accepting new connections
    server.close((err) => {
        if (err) {
            logger.error('Error during server close', { error: err });
            console.error('Error during shutdown:', err);
            process.exit(1);
        }

        logger.info('HTTP server closed');
        console.log('HTTP server closed.');

        // Perform cleanup tasks
        Promise.all([
            // Clean up cache and worker
            new Promise(async (resolve) => {
                try {
                    if (sheetsWorker) await sheetsWorker.close();
                    if (redisCache.redisClient) redisCache.redisClient.disconnect();
                } catch (e) {
                    console.error('Error during Redis/Worker cleanup', e);
                }
                resolve();
            }),
            // Could add database connection cleanup here in future
        ]).then(() => {
            logger.info('Graceful shutdown completed');
            console.log('Cleanup complete. Exiting.');
            process.exit(0);
        }).catch((cleanupErr) => {
            logger.error('Error during cleanup', { error: cleanupErr });
            console.error('Cleanup error:', cleanupErr);
            process.exit(1);
        });
    });

    // Force exit after 30 seconds if graceful shutdown fails
    setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason, promise: String(promise) });
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
