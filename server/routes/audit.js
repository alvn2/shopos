const express = require('express');
const { prisma } = require('../services/prisma');
const { authenticateSession, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateSession);
router.use(requireAdmin);

/**
 * GET /api/audit
 * Get audit logs with filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { user, action, from, to, search, page = 1, limit = 50 } = req.query;

        const where = { shop_id };

        if (user && user !== 'All') {
            where.user = user;
        }

        if (action && action !== 'All') {
            where.action = action;
        }

        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp.gte = new Date(from);
            if (to) where.timestamp.lte = new Date(to);
        }

        if (search) {
            where.OR = [
                { user: { contains: search, mode: 'insensitive' } },
                { action: { contains: search, mode: 'insensitive' } },
                { details: { contains: search, mode: 'insensitive' } },
            ];
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip: offset,
                take: limitNum
            })
        ]);

        const transformed = logs.map(l => {
            let detailsObj = {};
            try {
                if (l.details) detailsObj = JSON.parse(l.details);
            } catch (e) {
                // ignore
            }

            return {
                timestamp: l.timestamp.toISOString(),
                user: l.user,
                action: l.action,
                entity_type: detailsObj.entityType || '',
                entity_id: detailsObj.entityId || '',
                old_value: detailsObj.oldValue ? JSON.stringify(detailsObj.oldValue) : '',
                new_value: detailsObj.newValue ? JSON.stringify(detailsObj.newValue) : '',
                ip_address: l.ip_address || '',
                device_info: detailsObj.deviceInfo || ''
            };
        });

        res.json({
            logs: transformed,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/audit/users
 * Get list of unique users from audit log
 */
router.get('/users', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const users = await prisma.auditLog.findMany({
            where: { shop_id },
            select: { user: true },
            distinct: ['user']
        });
        
        res.json({ users: users.map(u => u.user).filter(Boolean) });
    } catch (error) {
        console.error('Get audit users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/audit/actions
 * Get list of unique action types from audit log
 */
router.get('/actions', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const actions = await prisma.auditLog.findMany({
            where: { shop_id },
            select: { action: true },
            distinct: ['action']
        });
        
        res.json({ actions: actions.map(a => a.action).filter(Boolean) });
    } catch (error) {
        console.error('Get audit actions error:', error);
        res.status(500).json({ error: 'Failed to fetch actions' });
    }
});

module.exports = router;
