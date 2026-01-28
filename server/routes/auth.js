const express = require('express');
const bcrypt = require('bcryptjs');
const sheets = require('../services/sheets');
const sessionService = require('../services/session');
const { authenticateSession } = require('../middleware/auth');

const router = express.Router();
const TABS = sheets.TABS;

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
    try {
        let { username, password, device_info } = req.body;

        if (username) {
            username = username.toLowerCase().trim();
        }

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        console.log(`[Auth] Login attempt for: ${username}`);
        const user = await sheets.findRow(TABS.USERS, { Username: username });
        console.log(`[Auth] User found: ${!!user} (Role: ${user ? user.Role : 'N/A'})`);

        if (!user) {
            // Log failed attempt
            await logAudit(null, 'LOGIN_FAILED', 'AUTH', username, null, { reason: 'User not found' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if active
        if (user.Is_Active !== 'TRUE') {
            await logAudit(username, 'LOGIN_FAILED', 'AUTH', username, null, { reason: 'Account disabled' }, req);
            return res.status(403).json({ error: 'Account disabled. Contact administrator.' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.Password_Hash);
        console.log(`[Auth] Password valid: ${isValid}`);
        if (!isValid) {
            await logAudit(username, 'LOGIN_FAILED', 'AUTH', username, null, { reason: 'Wrong password' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get IP and device info
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const deviceInfo = device_info || req.headers['user-agent'] || 'Unknown Device';

        // Create session
        const sessionId = await sessionService.createSession(username, deviceInfo, ipAddress);

        // Update last login
        await sheets.updateRow(TABS.USERS, { Username: username }, { Last_Login: new Date().toISOString() });

        // Log success
        await logAudit(username, 'LOGIN', 'AUTH', sessionId, null, { device_info: deviceInfo }, req);

        res.json({
            session_id: sessionId,
            user: {
                username: user.Username,
                role: user.Role,
                full_name: user.Full_Name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

/**
 * POST /api/auth/logout
 * Logout current session
 */
router.post('/logout', authenticateSession, async (req, res) => {
    try {
        await sessionService.deleteSession(req.sessionId);
        await logAudit(req.user.username, 'LOGOUT', 'AUTH', req.sessionId, null, null, req);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticateSession, async (req, res) => {
    try {
        const count = await sessionService.deleteAllUserSessions(req.user.username);
        await logAudit(req.user.username, 'LOGOUT_ALL_DEVICES', 'AUTH', req.user.username, null, { count }, req);
        res.json({ message: `Logged out from ${count} devices`, count });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({ error: 'Failed to logout from all devices' });
    }
});

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
 */
router.get('/sessions', authenticateSession, async (req, res) => {
    try {
        const sessions = await sessionService.getUserSessions(req.user.username);
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
 * Delete a specific session
 */
router.delete('/session/:session_id', authenticateSession, async (req, res) => {
    try {
        const targetSessionId = req.params.session_id;

        // Only allow admin or own session
        if (req.user.role !== 'admin') {
            const userSessions = await sessionService.getUserSessions(req.user.username);
            const isOwnSession = userSessions.some(s => s.session_id === targetSessionId);
            if (!isOwnSession) {
                return res.status(403).json({ error: 'Cannot delete other users\' sessions' });
            }
        }

        await sessionService.deleteSession(targetSessionId);
        await logAudit(req.user.username, 'SESSION_TERMINATED', 'AUTH', targetSessionId, null, null, req);

        res.json({ message: 'Session terminated' });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

/**
 * GET /api/auth/verify
 * Verify current session is valid
 */
router.get('/verify', authenticateSession, async (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

/**
 * Helper: Log to audit trail
 */
async function logAudit(user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
        const deviceInfo = req?.headers?.['user-agent'] || 'Unknown';

        await sheets.addRow(TABS.AUDIT_LOG, {
            Timestamp: new Date().toISOString(),
            User: user || 'anonymous',
            Action: action,
            Entity_Type: entityType,
            Entity_ID: entityId || '',
            Old_Value: oldValue ? JSON.stringify(oldValue) : '',
            New_Value: newValue ? JSON.stringify(newValue) : '',
            IP_Address: ipAddress,
            Device_Info: deviceInfo.substring(0, 200) // Limit length
        });
    } catch (error) {
        console.error('Audit log error:', error);
        // Don't throw - audit logging shouldn't break the main operation
    }
}

module.exports = router;
