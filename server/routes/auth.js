const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../services/prisma');
const sessionService = require('../services/session');
const { authenticateSession } = require('../middleware/auth');
const { bruteForceProtection } = require('../middleware/security');
const { validate } = require('../middleware/validation');
const { logAudit } = require('../services/audit');

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with username, password, and shop_id
 */
router.post('/login', bruteForceProtection, async (req, res) => {
    try {
        let { shop_id, username, password, device_info } = req.body;

        if (username) username = username.toLowerCase().trim();
        if (shop_id) shop_id = shop_id.toUpperCase().trim();

        if (!shop_id || !username || !password) {
            return res.status(400).json({ error: 'Shop, username, and password required' });
        }

        console.log(`[Auth] Login attempt for: ${username} at ${shop_id}`);
        const user = await prisma.user.findUnique({
            where: { shop_id_username: { shop_id, username } }
        });

        if (!user) {
            if (req.trackLoginFailure) req.trackLoginFailure();
            await logAudit(shop_id, null, 'LOGIN_FAILED', 'AUTH', username, null, { reason: 'User not found' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            if (req.trackLoginFailure) req.trackLoginFailure();
            await logAudit(shop_id, username, 'LOGIN_FAILED', 'AUTH', username, null, { reason: 'Account disabled' }, req);
            return res.status(403).json({ error: 'Account disabled. Contact administrator.' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            if (req.trackLoginFailure) req.trackLoginFailure();
            await logAudit(shop_id, username, 'LOGIN_FAILED', 'AUTH', username, null, { reason: 'Wrong password' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (req.trackLoginSuccess) req.trackLoginSuccess();

        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const deviceInfo = device_info || req.headers['user-agent'] || 'Unknown Device';

        const sessionId = await sessionService.createSession(shop_id, username, deviceInfo, ipAddress);

        await prisma.user.update({
            where: { uuid: user.uuid },
            data: { last_login: new Date() }
        });

        await logAudit(shop_id, username, 'LOGIN', 'AUTH', sessionId, null, { device_info: deviceInfo }, req);

        res.json({
            session_id: sessionId,
            user: {
                uuid: user.uuid,
                shop_id: user.shop_id,
                username: user.username,
                role: user.role,
                full_name: user.full_name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateSession, async (req, res) => {
    try {
        await sessionService.deleteSession(req.sessionId);
        await logAudit(req.user.shop_id, req.user.username, 'LOGOUT', 'AUTH', req.sessionId, null, null, req);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * POST /api/auth/logout-all
 */
router.post('/logout-all', authenticateSession, async (req, res) => {
    try {
        const count = await sessionService.deleteAllUserSessions(req.user.uuid);
        await logAudit(req.user.shop_id, req.user.username, 'LOGOUT_ALL_DEVICES', 'AUTH', req.user.username, null, { count }, req);
        res.json({ message: `Logged out from ${count} devices`, count });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({ error: 'Failed to logout from all devices' });
    }
});

/**
 * GET /api/auth/sessions
 */
router.get('/sessions', authenticateSession, async (req, res) => {
    try {
        const sessions = await sessionService.getUserSessions(req.user.uuid);
        const sessionsWithCurrent = sessions.map(s => ({
            ...s,
            is_current: s.session_id === req.sessionId
        }));
        res.json({ sessions: sessionsWithCurrent });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

/**
 * DELETE /api/auth/session/:session_id
 */
router.delete('/session/:session_id', authenticateSession, async (req, res) => {
    try {
        const targetSessionId = req.params.session_id;

        if (req.user.role !== 'admin') {
            const userSessions = await sessionService.getUserSessions(req.user.uuid);
            const isOwnSession = userSessions.some(s => s.session_id === targetSessionId);
            if (!isOwnSession) {
                return res.status(403).json({ error: 'Cannot delete other users\' sessions' });
            }
        }

        await sessionService.deleteSession(targetSessionId);
        await logAudit(req.user.shop_id, req.user.username, 'SESSION_TERMINATED', 'AUTH', targetSessionId, null, null, req);

        res.json({ message: 'Session terminated' });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

/**
 * GET /api/auth/verify
 */
router.get('/verify', authenticateSession, async (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

module.exports = router;
