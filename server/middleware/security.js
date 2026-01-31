/**
 * Security Middleware for ShopOS
 * Provides additional security layers beyond Helmet
 */

const rateLimit = require('express-rate-limit');

// Track failed login attempts per IP
const failedLoginAttempts = new Map();
const LOCKOUT_THRESHOLD = 5; // Lock after 5 failed attempts
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Brute-force protection for login attempts
 * Tracks failed attempts by IP and locks out after threshold
 */
function bruteForceProtection(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const attempt = failedLoginAttempts.get(ip);

    if (attempt) {
        const timeSinceLastAttempt = Date.now() - attempt.lastAttempt;

        // Check if still locked out
        if (attempt.count >= LOCKOUT_THRESHOLD) {
            if (timeSinceLastAttempt < LOCKOUT_DURATION) {
                const remainingTime = Math.ceil((LOCKOUT_DURATION - timeSinceLastAttempt) / 1000 / 60);
                return res.status(429).json({
                    error: `Too many failed login attempts. Please try again in ${remainingTime} minutes.`,
                    locked_until: new Date(attempt.lastAttempt + LOCKOUT_DURATION).toISOString()
                });
            } else {
                // Lockout expired, reset counter
                failedLoginAttempts.delete(ip);
            }
        }
    }

    // Attach methods to track success/failure
    req.trackLoginFailure = () => {
        const current = failedLoginAttempts.get(ip) || { count: 0 };
        failedLoginAttempts.set(ip, {
            count: current.count + 1,
            lastAttempt: Date.now()
        });
    };

    req.trackLoginSuccess = () => {
        failedLoginAttempts.delete(ip);
    };

    next();
}

/**
 * Request size limiter - additional protection beyond express.json limit
 */
function requestSizeLimiter(maxSize = 1024 * 1024) { // 1MB default
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        if (contentLength > maxSize) {
            return res.status(413).json({
                error: 'Request body too large',
                max_size: `${maxSize / 1024}KB`
            });
        }
        next();
    };
}

/**
 * HTTPS enforcement middleware (for production)
 */
function enforceHttps(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        // Check if request came through HTTPS
        if (req.headers['x-forwarded-proto'] !== 'https' && !req.secure) {
            return res.redirect(301, `https://${req.headers.host}${req.url}`);
        }
    }
    next();
}

/**
 * Request timeout middleware
 * Aborts requests that take too long
 */
function requestTimeout(timeout = 30000) { // 30 seconds default
    return (req, res, next) => {
        // Set a timeout on the request
        req.setTimeout(timeout, () => {
            if (!res.headersSent) {
                res.status(408).json({ error: 'Request timeout' });
            }
        });

        // Also set on response
        res.setTimeout(timeout);

        next();
    };
}

/**
 * IP-based rate limiting per user/session
 * More granular than general rate limiting
 */
function createUserRateLimiter(options = {}) {
    return rateLimit({
        windowMs: options.windowMs || 60 * 1000, // 1 minute
        max: options.max || 100, // 100 requests per minute
        keyGenerator: (req) => {
            // Use session ID if available, otherwise IP
            return req.sessionId || req.ip || req.headers['x-forwarded-for'] || 'unknown';
        },
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many requests. Please slow down.',
                retry_after: Math.ceil(options.windowMs / 1000)
            });
        },
        standardHeaders: true,
        legacyHeaders: false
    });
}

/**
 * Security headers middleware (extends Helmet)
 * Adds additional security headers
 */
function additionalSecurityHeaders(req, res, next) {
    // Prevent browsers from MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS Protection (legacy but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (restrict browser features)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
}

/**
 * Clean up expired lockouts periodically
 */
function startLockoutCleanup() {
    setInterval(() => {
        const now = Date.now();
        for (const [ip, attempt] of failedLoginAttempts.entries()) {
            if (now - attempt.lastAttempt > LOCKOUT_DURATION * 2) {
                failedLoginAttempts.delete(ip);
            }
        }
    }, 5 * 60 * 1000); // Clean every 5 minutes
}

// Start cleanup on module load
startLockoutCleanup();

/**
 * Get current lockout stats (for monitoring)
 */
function getLockoutStats() {
    let lockedCount = 0;
    let totalTracked = failedLoginAttempts.size;

    for (const attempt of failedLoginAttempts.values()) {
        if (attempt.count >= LOCKOUT_THRESHOLD) {
            lockedCount++;
        }
    }

    return { lockedCount, totalTracked };
}

module.exports = {
    bruteForceProtection,
    requestSizeLimiter,
    enforceHttps,
    requestTimeout,
    createUserRateLimiter,
    additionalSecurityHeaders,
    getLockoutStats,
    LOCKOUT_THRESHOLD,
    LOCKOUT_DURATION
};
