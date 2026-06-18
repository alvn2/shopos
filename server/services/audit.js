const { prisma } = require('./prisma');

/**
 * Log an audit entry to the database
 * @param {string} shop_id - Shop identifier
 * @param {string} user - Username performing the action
 * @param {string} action - Action type (e.g., 'INVENTORY_CREATE', 'LOGIN')
 * @param {string} entityType - Entity being acted upon (e.g., 'INVENTORY', 'AUTH')
 * @param {string} entityId - ID of the entity
 * @param {any} oldValue - Previous state (for updates)
 * @param {any} newValue - New state (for creates/updates)
 * @param {object} req - Express request object (for IP extraction)
 */
async function logAudit(shop_id, user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
        await prisma.auditLog.create({
            data: {
                shop_id: shop_id || 'STEPMOTORS',
                user: user || 'anonymous',
                action,
                details: JSON.stringify({ entityType, entityId, oldValue, newValue }),
                ip_address: ipAddress
            }
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

module.exports = { logAudit };
