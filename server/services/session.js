const { v4: uuidv4 } = require('uuid');
const sheets = require('./sheets');

const TABS = sheets.TABS;

/**
 * Create a new session for a user
 */
const sessionCache = new Map(); // sessionId -> sessionData

/**
 * Create a new session for a user
 */
async function createSession(username, deviceInfo, ipAddress) {
    const sessionId = `sess_${uuidv4()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const sessionData = {
        Session_ID: sessionId,
        Username: username,
        Device_Info: deviceInfo,
        IP_Address: ipAddress,
        Created_At: now.toISOString(),
        Last_Active: now.toISOString(),
        Expires_At: expiresAt.toISOString()
    };

    // Cache immediately
    sessionCache.set(sessionId, sessionData);

    // Enforce max 5 sessions per user
    const allSessions = await sheets.getAllRows(TABS.SESSIONS);
    const userSessions = allSessions.filter(s => s.Username === username);

    if (userSessions.length >= 5) {
        // Delete oldest session
        userSessions.sort((a, b) => new Date(a.Created_At) - new Date(b.Created_At));
        await deleteSession(userSessions[0].Session_ID);
    }

    await sheets.addRow(TABS.SESSIONS, sessionData);
    return sessionId;
}

/**
 * Validate a session and return user info
 */
async function validateSession(sessionId) {
    if (!sessionId) return null;

    let session = sessionCache.get(sessionId);

    // If not in cache, try Sheets
    if (!session) {
        session = await sheets.findRow(TABS.SESSIONS, { Session_ID: sessionId });
        if (session) {
            sessionCache.set(sessionId, session);
        }
    }

    if (!session) return null;

    const now = new Date();
    const expiresAt = new Date(session.Expires_At);

    // Check if expired
    if (now > expiresAt) {
        await deleteSession(sessionId);
        return null;
    }

    // Update last active if more than 1 hour old (Debounced)
    const lastActive = new Date(session.Last_Active);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (lastActive < hourAgo) {
        session.Last_Active = now.toISOString();
        sessionCache.set(sessionId, session); // Update cache

        // Update sheets asynchronously to not block
        sheets.updateRow(TABS.SESSIONS,
            { Session_ID: sessionId },
            { Last_Active: now.toISOString() }
        ).catch(e => console.error('Failed to update session activity', e));
    }

    // Get user info (Cache this too?)
    // For now, let's look up user from sheets to be safe about Role changes
    const user = await sheets.findRow(TABS.USERS, { Username: session.Username });
    if (!user || user.Is_Active !== 'TRUE') {
        return null;
    }

    return {
        session,
        user: {
            username: user.Username,
            role: user.Role,
            full_name: user.Full_Name
        }
    };
}

/**
 * Delete a specific session
 */
async function deleteSession(sessionId) {
    sessionCache.delete(sessionId);
    try {
        return await sheets.deleteRow(TABS.SESSIONS, { Session_ID: sessionId });
    } catch (e) {
        // Ignore if already deleted in sheets
        return false;
    }
}

/**
 * Delete all sessions for a user
 */
async function deleteAllUserSessions(username) {
    const allSessions = await sheets.getAllRows(TABS.SESSIONS);
    const userSessions = allSessions.filter(s => s.Username === username);

    // Clear from cache
    for (const [sid, session] of sessionCache.entries()) {
        if (session.Username === username) {
            sessionCache.delete(sid);
        }
    }

    for (const session of userSessions) {
        try {
            await sheets.deleteRow(TABS.SESSIONS, { Session_ID: session.Session_ID });
        } catch (e) { /* ignore */ }
    }

    return userSessions.length;
}

/**
 * Get all sessions for a user
 */
async function getUserSessions(username) {
    // Always fetch from source of truth for listing
    const allSessions = await sheets.getAllRows(TABS.SESSIONS);

    // Refresh cache with fresh data (optional strategy)
    allSessions.forEach(s => {
        sessionCache.set(s.Session_ID, s);
    });

    const now = new Date();

    return allSessions
        .filter(s => s.Username === username && new Date(s.Expires_At) > now)
        .sort((a, b) => new Date(b.Last_Active) - new Date(a.Last_Active))
        .map(s => ({
            session_id: s.Session_ID,
            device_info: s.Device_Info,
            ip_address: s.IP_Address,
            created_at: s.Created_At,
            last_active: s.Last_Active,
            expires_at: s.Expires_At
        }));
}

/**
 * Cleanup expired sessions (called by cron job)
 */
async function cleanupExpiredSessions() {
    const allSessions = await sheets.getAllRows(TABS.SESSIONS);
    const now = new Date();

    let count = 0;
    for (const session of allSessions) {
        if (new Date(session.Expires_At) < now) {
            sessionCache.delete(session.Session_ID);
            try {
                await sheets.deleteRow(TABS.SESSIONS, { Session_ID: session.Session_ID });
                count++;
            } catch (e) { /* ignore */ }
        }
    }

    console.log(`[Session Cleanup] Removed ${count} expired sessions`);
    return count;
}

module.exports = {
    createSession,
    validateSession,
    deleteSession,
    deleteAllUserSessions,
    getUserSessions,
    cleanupExpiredSessions
};
