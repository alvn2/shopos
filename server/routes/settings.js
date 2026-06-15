const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../services/prisma');
const cache = require('../services/cache');
const { authenticateSession, requireAdmin } = require('../middleware/auth');
const { validatePasswordStrength } = require('../middleware/validation');

const router = express.Router();

const SETTINGS_CACHE_TTL = 60000;

router.use(authenticateSession);

/**
 * GET /api/settings
 */
router.get('/', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const cacheKey = `settings:${shop_id}`;
        
        const cached = cache.get(cacheKey);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const settingsRows = await prisma.setting.findMany({ where: { shop_id } });

        const settings = {};
        settingsRows.forEach(row => {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch {
                settings[row.key] = row.value;
            }
        });

        const result = {
            aed_rate: parseFloat(settings.aed_rate || settings.aed_exchange_rate || 36.5),
            conversion_percent: parseFloat(settings.conversion_percent || 13),
            default_min_stock: parseInt(settings.default_min_stock || 5)
        };

        cache.set(cacheKey, result, SETTINGS_CACHE_TTL);
        res.set('X-Cache', 'MISS');
        res.json(result);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/settings
 */
router.put('/', requireAdmin, async (req, res) => {
    try {
        const { shop_id, username } = req.user;
        const updates = req.body;

        await prisma.$transaction(async (tx) => {
            for (const [key, value] of Object.entries(updates)) {
                const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                
                await tx.setting.upsert({
                    where: { shop_id_key: { shop_id, key } },
                    update: { value: valueStr, updated_by: username },
                    create: { shop_id, key, value: valueStr, updated_by: username }
                });
            }

            await tx.auditLog.create({
                data: {
                    shop_id,
                    user: username,
                    action: 'SETTINGS_UPDATED',
                    details: JSON.stringify({ entityType: 'SETTINGS', newValue: updates }),
                    ip_address: req.ip || 'unknown'
                }
            });
        });

        cache.invalidate(`settings:${shop_id}`);

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

router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { shop_id } = req.user;
        const users = await prisma.user.findMany({ where: { shop_id } });

        const sanitized = users.map(u => ({
            uuid: u.uuid,
            username: u.username,
            role: u.role,
            full_name: u.full_name,
            created_at: u.created_at,
            last_login: u.last_login,
            is_active: u.is_active
        }));

        res.json(sanitized);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.post('/users', requireAdmin, async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { username, password_hash, full_name, role } = req.body;

        if (!username || !password_hash || !full_name) {
            return res.status(400).json({ error: 'Username, password, and full name required' });
        }

        if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
            return res.status(400).json({ error: 'Username must be 3-50 characters containing only letters, numbers, and underscores' });
        }

        const passwordCheck = validatePasswordStrength(password_hash);
        if (!passwordCheck.valid) {
            return res.status(400).json({ error: 'Password does not meet requirements', details: passwordCheck.errors });
        }

        const existing = await prisma.user.findUnique({
            where: { shop_id_username: { shop_id, username: username.toLowerCase() } }
        });

        if (existing) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password_hash, 10);

        const newUser = await prisma.user.create({
            data: {
                shop_id,
                username: username.toLowerCase().trim(),
                password_hash: hashedPassword,
                role: role || 'counter',
                full_name: full_name.trim(),
                is_active: true
            }
        });

        await logAudit(shop_id, req.user.username, 'USER_CREATED', 'USER', newUser.uuid, null, { role, full_name }, req);

        res.status(201).json({
            uuid: newUser.uuid,
            username: newUser.username,
            role: newUser.role,
            full_name: newUser.full_name,
            created_at: newUser.created_at,
            is_active: newUser.is_active
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.put('/users/:uuid', requireAdmin, async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { uuid } = req.params;
        const updates = req.body;

        const existing = await prisma.user.findFirst({ where: { uuid, shop_id } });
        if (!existing) {
            return res.status(404).json({ error: 'User not found' });
        }

        const data = {};
        if (updates.full_name) data.full_name = updates.full_name;
        if (updates.role) data.role = updates.role;
        if (updates.is_active !== undefined) data.is_active = updates.is_active;

        if (updates.password_hash) {
            const passwordCheck = validatePasswordStrength(updates.password_hash);
            if (!passwordCheck.valid) {
                return res.status(400).json({ error: 'Password does not meet requirements', details: passwordCheck.errors });
            }
            data.password_hash = await bcrypt.hash(updates.password_hash, 10);
        }

        if (Object.keys(data).length > 0) {
            const updated = await prisma.user.update({
                where: { uuid },
                data
            });
            await logAudit(shop_id, req.user.username, 'USER_UPDATED', 'USER', uuid, null, Object.keys(updates), req);
        }

        res.json({
            uuid,
            username: existing.username,
            role: updates.role || existing.role,
            full_name: updates.full_name || existing.full_name,
            is_active: updates.is_active !== undefined ? updates.is_active : existing.is_active
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/users/:uuid', requireAdmin, async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { uuid } = req.params;

        if (uuid === req.user.uuid) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const existing = await prisma.user.findFirst({ where: { uuid, shop_id } });
        if (!existing) return res.status(404).json({ error: 'User not found' });
        if (existing.username === 'admin') {
            return res.status(400).json({ error: 'Cannot delete admin user' });
        }

        await prisma.user.delete({ where: { uuid } });
        await logAudit(shop_id, req.user.username, 'USER_DELETED', 'USER', uuid, null, null, req);

        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

async function logAudit(shop_id, user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
        await prisma.auditLog.create({
            data: {
                shop_id,
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

module.exports = router;
