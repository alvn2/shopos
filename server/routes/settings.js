const express = require('express');
const bcrypt = require('bcryptjs');
const sheets = require('../services/sheets');
const cache = require('../services/cache');
const { authenticateSession, requireAdmin } = require('../middleware/auth');
const { validatePasswordStrength } = require('../middleware/validation');

const router = express.Router();
const TABS = sheets.TABS;
const SETTINGS_CACHE_KEY = 'settings:all';
const SETTINGS_CACHE_TTL = 60000; // 60 seconds (settings change rarely)

router.use(authenticateSession);

/**
 * GET /api/settings
 * Get all settings as key-value object (cached)
 */
router.get('/', async (req, res) => {
    try {
        // Check cache first
        const cached = cache.get(SETTINGS_CACHE_KEY);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const settingsRows = await sheets.getAllRows(TABS.SETTINGS);

        const settings = {};
        settingsRows.forEach(row => {
            try {
                settings[row.Key] = JSON.parse(row.Value);
            } catch {
                settings[row.Key] = row.Value;
            }
        });

        // Map to frontend expected format
        const result = {
            aed_rate: parseFloat(settings.aed_rate || settings.aed_exchange_rate || 36.5),
            conversion_percent: parseFloat(settings.conversion_percent || 13),
            default_min_stock: parseInt(settings.default_min_stock || 5)
        };

        // Cache the result
        cache.set(SETTINGS_CACHE_KEY, result, SETTINGS_CACHE_TTL);
        res.set('X-Cache', 'MISS');
        res.json(result);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/settings
 * Update settings (admin only)
 */
router.put('/', requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        const now = new Date().toISOString();

        for (const [key, value] of Object.entries(updates)) {
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const existing = await sheets.findRow(TABS.SETTINGS, { Key: key });

            if (existing) {
                await sheets.updateRow(TABS.SETTINGS, { Key: key }, {
                    Value: valueStr,
                    Updated_At: now,
                    Updated_By: req.user.username
                });
            } else {
                await sheets.addRow(TABS.SETTINGS, {
                    Key: key,
                    Value: valueStr,
                    Updated_At: now,
                    Updated_By: req.user.username
                });
            }
        }

        // Invalidate settings cache
        cache.invalidate(SETTINGS_CACHE_KEY);

        await logAudit(req.user.username, 'SETTINGS_UPDATED', 'SETTINGS', 'all', null, updates, req);
        res.json({
            aed_rate: parseFloat(updates.aed_rate || 36.5),
            conversion_percent: parseFloat(updates.conversion_percent || 13),
            default_min_stock: parseInt(updates.default_min_stock || 5)
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// ============================================================================
// USER MANAGEMENT (Admin Only)
// ============================================================================

/**
 * GET /api/settings/users
 * Get all users
 */
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await sheets.getAllRows(TABS.USERS);

        // Don't send password hashes
        const sanitized = users.map(u => ({
            username: u.Username,
            role: u.Role,
            full_name: u.Full_Name,
            created_at: u.Created_At,
            last_login: u.Last_Login || null,
            is_active: u.Is_Active === 'TRUE'
        }));

        res.json(sanitized);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * POST /api/settings/users
 * Create new user
 */
router.post('/users', requireAdmin, async (req, res) => {
    try {
        const { username, password_hash, full_name, role } = req.body;

        // Validate required fields
        if (!username || !password_hash || !full_name) {
            return res.status(400).json({ error: 'Username, password, and full name required' });
        }

        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
            return res.status(400).json({
                error: 'Username must be 3-50 characters containing only letters, numbers, and underscores'
            });
        }

        // Validate password strength
        const passwordCheck = validatePasswordStrength(password_hash);
        if (!passwordCheck.valid) {
            return res.status(400).json({
                error: 'Password does not meet requirements',
                details: passwordCheck.errors
            });
        }

        // Check if user exists
        const existing = await sheets.findRow(TABS.USERS, { Username: username.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password_hash, 10);

        const newUser = {
            Username: username.toLowerCase().trim(),
            Password_Hash: hashedPassword,
            Role: role || 'counter',
            Full_Name: full_name.trim(),
            Created_At: new Date().toISOString(),
            Last_Login: '',
            Is_Active: 'TRUE'
        };

        await sheets.addRow(TABS.USERS, newUser);
        await logAudit(req.user.username, 'USER_CREATED', 'USER', username, null, { role, full_name }, req);

        res.status(201).json({
            username: newUser.Username,
            role: newUser.Role,
            full_name: newUser.Full_Name,
            created_at: newUser.Created_At,
            is_active: true
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/settings/users/:username
 * Update user
 */
router.put('/users/:username', requireAdmin, async (req, res) => {
    try {
        const { username } = req.params;
        const updates = req.body;

        // Get current user
        const existing = await sheets.findRow(TABS.USERS, { Username: username });
        if (!existing) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare updates
        const updateData = {};
        if (updates.full_name) updateData.Full_Name = updates.full_name;
        if (updates.role) updateData.Role = updates.role;
        if (updates.is_active !== undefined) updateData.Is_Active = updates.is_active ? 'TRUE' : 'FALSE';

        // Handle password change
        if (updates.password_hash) {
            updateData.Password_Hash = await bcrypt.hash(updates.password_hash, 10);
        }

        if (Object.keys(updateData).length > 0) {
            await sheets.updateRow(TABS.USERS, { Username: username }, updateData);
            await logAudit(req.user.username, 'USER_UPDATED', 'USER', username, null, Object.keys(updates), req);
        }

        res.json({
            username,
            role: updates.role || existing.Role,
            full_name: updates.full_name || existing.Full_Name,
            is_active: updates.is_active !== undefined ? updates.is_active : existing.Is_Active === 'TRUE'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * DELETE /api/settings/users/:username
 * Delete user
 */
router.delete('/users/:username', requireAdmin, async (req, res) => {
    try {
        const { username } = req.params;

        // Prevent deleting yourself
        if (username === req.user.username) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        // Prevent deleting admin
        if (username === 'admin') {
            return res.status(400).json({ error: 'Cannot delete admin user' });
        }

        await sheets.deleteRow(TABS.USERS, { Username: username });
        await logAudit(req.user.username, 'USER_DELETED', 'USER', username, null, null, req);

        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * Helper: Log to audit trail
 */
async function logAudit(user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        await sheets.addRow(TABS.AUDIT_LOG, {
            Timestamp: new Date().toISOString(),
            User: user,
            Action: action,
            Entity_Type: entityType,
            Entity_ID: entityId,
            Old_Value: oldValue ? JSON.stringify(oldValue) : '',
            New_Value: newValue ? JSON.stringify(newValue) : '',
            IP_Address: req?.ip || '',
            Device_Info: (req?.headers?.['user-agent'] || '').substring(0, 200)
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

module.exports = router;
