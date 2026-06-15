const { v4: uuidv4 } = require('uuid');
const { prisma } = require('./prisma');

/**
 * Create a new session for a user
 */
async function createSession(shop_id, username, deviceInfo, ipAddress) {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Find the user first to link the session
    const user = await prisma.user.findUnique({
        where: { shop_id_username: { shop_id, username } }
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Enforce max 5 sessions per user
    const userSessions = await prisma.session.findMany({
        where: { user_uuid: user.uuid },
        orderBy: { created_at: 'asc' }
    });

    if (userSessions.length >= 5) {
        // Delete oldest session
        await prisma.session.delete({
            where: { session_id: userSessions[0].session_id }
        });
    }

    const session = await prisma.session.create({
        data: {
            session_id: sessionId,
            shop_id: shop_id,
            user_uuid: user.uuid,
            device_info: deviceInfo || 'Unknown',
            ip_address: ipAddress || 'unknown',
            created_at: now,
            last_active: now,
            expires_at: expiresAt
        }
    });

    return session.session_id;
}

/**
 * Validate a session and return user info
 */
async function validateSession(sessionId) {
    if (!sessionId) return null;

    let session;
    try {
        session = await prisma.session.findUnique({
            where: { session_id: sessionId },
            include: { user: true }
        });
    } catch (e) {
        return null;
    }

    if (!session) return null;

    const now = new Date();

    // Check if expired
    if (now > session.expires_at) {
        await deleteSession(sessionId);
        return null;
    }

    // Check if user is active
    if (!session.user || !session.user.is_active) {
        return null;
    }

    // Update last active if more than 1 hour old (Debounced)
    const lastActive = new Date(session.last_active);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (lastActive < hourAgo) {
        await prisma.session.update({
            where: { session_id: sessionId },
            data: { last_active: now }
        }).catch(e => console.error('Failed to update session activity', e));
    }

    return {
        session,
        user: {
            uuid: session.user.uuid,
            username: session.user.username,
            shop_id: session.user.shop_id,
            role: session.user.role,
            full_name: session.user.full_name
        }
    };
}

/**
 * Delete a specific session
 */
async function deleteSession(sessionId) {
    try {
        await prisma.session.delete({
            where: { session_id: sessionId }
        });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Delete all sessions for a user
 */
async function deleteAllUserSessions(user_uuid) {
    try {
        const result = await prisma.session.deleteMany({
            where: { user_uuid: user_uuid }
        });
        return result.count;
    } catch (e) {
        return 0;
    }
}

/**
 * Get all sessions for a user
 */
async function getUserSessions(user_uuid) {
    const now = new Date();

    const sessions = await prisma.session.findMany({
        where: {
            user_uuid: user_uuid,
            expires_at: { gt: now }
        },
        orderBy: { last_active: 'desc' }
    });

    return sessions.map(s => ({
        session_id: s.session_id,
        device_info: s.device_info,
        ip_address: s.ip_address,
        created_at: s.created_at,
        last_active: s.last_active,
        expires_at: s.expires_at
    }));
}

/**
 * Cleanup expired sessions (called by cron job)
 */
async function cleanupExpiredSessions() {
    const now = new Date();
    try {
        const result = await prisma.session.deleteMany({
            where: { expires_at: { lt: now } }
        });
        console.log(`[Session Cleanup] Removed ${result.count} expired sessions`);
        return result.count;
    } catch (e) {
        console.error('[Session Cleanup] Failed:', e);
        return 0;
    }
}

module.exports = {
    createSession,
    validateSession,
    deleteSession,
    deleteAllUserSessions,
    getUserSessions,
    cleanupExpiredSessions
};
