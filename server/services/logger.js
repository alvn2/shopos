/**
 * Structured Logger Service for ShopOS
 * Provides JSON logging with request tracking and log levels
 */

const { v4: uuidv4 } = require('uuid');

// Log levels
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Current log level (configurable via env)
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

/**
 * Format log entry as JSON for structured logging
 */
function formatLogEntry(level, message, meta = {}) {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        service: 'shopos-api',
        ...meta
    });
}

/**
 * Logger functions
 */
const logger = {
    debug(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(formatLogEntry('DEBUG', message, meta));
        }
    },

    info(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(formatLogEntry('INFO', message, meta));
        }
    },

    warn(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(formatLogEntry('WARN', message, meta));
        }
    },

    error(message, meta = {}) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            // If error object passed, extract useful info
            if (meta.error instanceof Error) {
                meta.error = {
                    message: meta.error.message,
                    stack: meta.error.stack,
                    name: meta.error.name
                };
            }
            console.error(formatLogEntry('ERROR', message, meta));
        }
    },

    // Log HTTP request (for request logging middleware)
    request(req, res, duration) {
        const meta = {
            request_id: req.requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: duration,
            ip: req.ip,
            user: req.user?.username || 'anonymous'
        };

        // Log at appropriate level based on status
        if (res.statusCode >= 500) {
            this.error('Request failed', meta);
        } else if (res.statusCode >= 400) {
            this.warn('Request error', meta);
        } else {
            this.info('Request completed', meta);
        }
    }
};

/**
 * Request ID middleware - adds unique ID to each request
 */
function requestIdMiddleware(req, res, next) {
    req.requestId = req.headers['x-request-id'] || uuidv4().split('-')[0];
    res.setHeader('X-Request-ID', req.requestId);
    next();
}

/**
 * Request logging middleware
 * Logs all incoming requests with timing
 */
function requestLoggerMiddleware(req, res, next) {
    const startTime = Date.now();

    // Log request start
    logger.debug('Request started', {
        request_id: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip
    });

    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.request(req, res, duration);
    });

    next();
}

/**
 * Metrics tracking
 */
const metrics = {
    requestCount: 0,
    errorCount: 0,
    successCount: 0,
    totalResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    startTime: Date.now(),

    track(statusCode, responseTime) {
        this.requestCount++;
        this.totalResponseTime += responseTime;

        if (statusCode >= 400) {
            this.errorCount++;
        } else {
            this.successCount++;
        }
    },

    trackCache(hit) {
        if (hit) {
            this.cacheHits++;
        } else {
            this.cacheMisses++;
        }
    },

    getStats() {
        const uptime = Date.now() - this.startTime;
        return {
            uptime_seconds: Math.floor(uptime / 1000),
            requests: {
                total: this.requestCount,
                success: this.successCount,
                errors: this.errorCount,
                success_rate: this.requestCount > 0
                    ? ((this.successCount / this.requestCount) * 100).toFixed(2) + '%'
                    : '0%'
            },
            response_time: {
                average_ms: this.requestCount > 0
                    ? Math.round(this.totalResponseTime / this.requestCount)
                    : 0
            },
            cache: {
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hit_rate: (this.cacheHits + this.cacheMisses) > 0
                    ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2) + '%'
                    : '0%'
            }
        };
    },

    reset() {
        this.requestCount = 0;
        this.errorCount = 0;
        this.successCount = 0;
        this.totalResponseTime = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.startTime = Date.now();
    }
};

/**
 * Metrics tracking middleware
 */
function metricsMiddleware(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        metrics.track(res.statusCode, Date.now() - startTime);

        // Track cache hits/misses from X-Cache header
        const cacheHeader = res.getHeader('X-Cache');
        if (cacheHeader === 'HIT') {
            metrics.trackCache(true);
        } else if (cacheHeader === 'MISS') {
            metrics.trackCache(false);
        }
    });

    next();
}

module.exports = {
    logger,
    requestIdMiddleware,
    requestLoggerMiddleware,
    metrics,
    metricsMiddleware,
    LOG_LEVELS
};
