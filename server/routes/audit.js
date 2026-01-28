const express = require('express');
const sheets = require('../services/sheets');
const { authenticateSession, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const TABS = sheets.TABS;

// All audit routes require admin access
router.use(authenticateSession);
router.use(requireAdmin);

/**
 * GET /api/audit
 * Get audit logs with filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        const { user, action, from, to, search, page = 1, limit = 50 } = req.query;

        let logs = await sheets.getAllRows(TABS.AUDIT_LOG);

        // Filter by user
        if (user && user !== 'All') {
            logs = logs.filter(l => l.User === user);
        }

        // Filter by action
        if (action && action !== 'All') {
            logs = logs.filter(l => l.Action === action);
        }

        // Filter by date range
        if (from) {
            const fromDate = new Date(from);
            logs = logs.filter(l => new Date(l.Timestamp) >= fromDate);
        }
        if (to) {
            const toDate = new Date(to);
            logs = logs.filter(l => new Date(l.Timestamp) <= toDate);
        }

        // Search
        if (search) {
            const searchLower = search.toLowerCase();
            logs = logs.filter(l =>
                (l.Entity_ID || '').toLowerCase().includes(searchLower) ||
                (l.Old_Value || '').toLowerCase().includes(searchLower) ||
                (l.New_Value || '').toLowerCase().includes(searchLower) ||
                (l.User || '').toLowerCase().includes(searchLower) ||
                (l.Action || '').toLowerCase().includes(searchLower)
            );
        }

        // Sort by timestamp descending
        logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

        // Pagination
        const total = logs.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        logs = logs.slice(offset, offset + limitNum);

        // Transform for frontend
        const transformed = logs.map(l => ({
            timestamp: l.Timestamp,
            user: l.User,
            action: l.Action,
            entity_type: l.Entity_Type,
            entity_id: l.Entity_ID,
            old_value: l.Old_Value,
            new_value: l.New_Value,
            ip_address: l.IP_Address,
            device_info: l.Device_Info
        }));

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
        const logs = await sheets.getAllRows(TABS.AUDIT_LOG);
        const users = [...new Set(logs.map(l => l.User).filter(Boolean))];
        res.json({ users });
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
        const logs = await sheets.getAllRows(TABS.AUDIT_LOG);
        const actions = [...new Set(logs.map(l => l.Action).filter(Boolean))];
        res.json({ actions });
    } catch (error) {
        console.error('Get audit actions error:', error);
        res.status(500).json({ error: 'Failed to fetch actions' });
    }
});

module.exports = router;
