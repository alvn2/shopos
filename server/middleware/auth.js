const sessionService = require('../services/session');

/**
 * Authentication middleware - validates session on every request
 */
async function authenticateSession(req, res, next) {
    try {
        let sessionId = req.headers['x-session-id'];

        // Also check Authorization header (standard)
        if (!sessionId && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                sessionId = authHeader.split(' ')[1];
            }
        }

        if (!sessionId) {
            console.log('[AuthMiddleware] Verification failed: No session provided');
            return res.status(401).json({ error: 'No session provided' });
        }

        const result = await sessionService.validateSession(sessionId);

        if (!result) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Attach user and session to request
        req.user = result.user;
        req.session = result.session;
        req.sessionId = sessionId;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Admin-only middleware - must be used after authenticateSession
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { authenticateSession, requireAdmin };
