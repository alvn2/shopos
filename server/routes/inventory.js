const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../services/prisma');
const redisCache = require('../services/redisCache');
const { authenticateSession, requireAdmin, requireCounterOrAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { logAudit } = require('../services/audit');

const router = express.Router();
const CACHE_TTL = 30000; // 30 seconds

// All inventory routes require authentication
router.use(authenticateSession);

function getCacheKey(shopId, page, limit, search, sortBy, sortOrder, lowStock) {
    return `inventory:${shopId}:${page}:${limit}:${search || ''}:${sortBy || ''}:${sortOrder || ''}:${lowStock || ''}`;
}

/**
 * GET /api/inventory
 */
router.get('/', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { page, limit, search, sort_by, sort_order, low_stock } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        let limitNum = parseInt(limit);
        
        // Safety bounds for pagination
        if (isNaN(limitNum) || limitNum <= 0) limitNum = 50; // Default to 50
        if (limitNum > 1000) limitNum = 1000; // Cap at 1000

        const cacheKey = getCacheKey(shop_id, pageNum, limitNum, search, sort_by, sort_order, low_stock);

        const cached = await redisCache.getCache(cacheKey);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const where = { shop_id, is_deleted: false };
        const isLowStockFilter = low_stock === 'true';

        if (search) {
            where.OR = [
                { part_number: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { tags: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Low stock filter: Prisma doesn't support column-to-column comparison,
        // so we use raw SQL for this specific case
        if (isLowStockFilter) {
            const rawItems = await prisma.$queryRaw`
                SELECT * FROM "InventoryItem"
                WHERE shop_id = ${shop_id}::"ShopName"
                  AND is_deleted = false
                  AND stock_qty <= min_stock
                ORDER BY last_updated DESC
            `;

            const transformed = rawItems.map(item => ({
                uuid: item.uuid,
                part_number: item.part_number,
                name: item.name,
                tags: item.tags || '',
                make: item.make || 'Genuine',
                aed_buying_price: item.aed_buying_price,
                ksh_buying_price: item.ksh_buying_price,
                selling_price: item.selling_price,
                stock_qty: item.stock_qty,
                min_stock: item.min_stock,
                last_updated: item.last_updated,
                updated_by: item.updated_by
            }));

            res.set('X-Cache', 'MISS');
            return res.json(transformed);
        }

        const queryOpts = {
            where,
            orderBy: sort_by ? { [sort_by]: sort_order === 'desc' ? 'desc' : 'asc' } : { last_updated: 'desc' }
        };

        const total = await prisma.inventoryItem.count({ where });

        if (limitNum > 0) {
            queryOpts.skip = (pageNum - 1) * limitNum;
            queryOpts.take = limitNum;
        }

        const items = await prisma.inventoryItem.findMany(queryOpts);

        const transformed = items.map(item => ({
            uuid: item.uuid,
            part_number: item.part_number,
            name: item.name,
            tags: item.tags || '',
            make: item.make || 'Genuine',
            aed_buying_price: item.aed_buying_price,
            ksh_buying_price: item.ksh_buying_price,
            selling_price: item.selling_price,
            stock_qty: item.stock_qty,
            min_stock: item.min_stock,
            last_updated: item.last_updated,
            updated_by: item.updated_by
        }));

        if (limitNum > 0) {
            const result = {
                items: transformed,
                total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(total / limitNum)
            };
            await redisCache.setCache(cacheKey, result, CACHE_TTL);
            res.set('X-Cache', 'MISS');
            return res.json(result);
        }

        await redisCache.setCache(cacheKey, transformed, CACHE_TTL);
        res.set('X-Cache', 'MISS');
        res.json(transformed);
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

/**
 * POST /api/inventory
 */
router.post('/', requireAdmin, validate('inventoryItem', 'body'), async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { part_number, name, tags, make = 'Genuine', aed_buying_price, ksh_buying_price, selling_price, stock_qty, min_stock } = req.body;

        const partNumberUpper = part_number.trim().toUpperCase();

        const existingItem = await prisma.inventoryItem.findFirst({
            where: {
                shop_id,
                part_number: { equals: partNumberUpper, mode: 'insensitive' },
                make: { equals: make, mode: 'insensitive' },
                is_deleted: false
            }
        });

        if (existingItem) {
            const newStock = existingItem.stock_qty + (parseInt(stock_qty) || 0);

            const updated = await prisma.inventoryItem.update({
                where: { uuid: existingItem.uuid },
                data: {
                    stock_qty: newStock,
                    name: name || existingItem.name,
                    tags: tags !== undefined ? tags : existingItem.tags,
                    aed_buying_price: aed_buying_price > 0 ? aed_buying_price : existingItem.aed_buying_price,
                    ksh_buying_price: ksh_buying_price > 0 ? ksh_buying_price : existingItem.ksh_buying_price,
                    selling_price: selling_price > 0 ? selling_price : existingItem.selling_price,
                    min_stock: min_stock !== undefined ? min_stock : existingItem.min_stock,
                    updated_by: req.user.username
                }
            });

            await redisCache.invalidatePattern(`inventory:${shop_id}:*`);
            await logAudit(shop_id, req.user.username, 'INVENTORY_UPDATE', 'INVENTORY', existingItem.uuid, existingItem, updated, req);

            return res.status(200).json({ ...updated, upserted: true, previous_stock: existingItem.stock_qty, added_stock: parseInt(stock_qty) || 0 });
        }

        const newItem = await prisma.inventoryItem.create({
            data: {
                shop_id,
                part_number: partNumberUpper,
                name,
                tags: tags || '',
                make,
                aed_buying_price: aed_buying_price || 0,
                ksh_buying_price: ksh_buying_price || 0,
                selling_price: selling_price || 0,
                stock_qty: stock_qty || 0,
                min_stock: min_stock || 5,
                updated_by: req.user.username
            }
        });

        await redisCache.invalidatePattern(`inventory:${shop_id}:*`);
        await logAudit(shop_id, req.user.username, 'INVENTORY_CREATE', 'INVENTORY', newItem.uuid, null, newItem, req);

        res.status(201).json({ ...newItem, upserted: false });
    } catch (error) {
        console.error('Create inventory error:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

/**
 * PATCH/PUT /api/inventory/:uuid
 */
const updateSingleItem = async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { uuid } = req.params;
        const updates = req.body;

        const currentItem = await prisma.inventoryItem.findFirst({
            where: { uuid, shop_id }
        });

        if (!currentItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const data = { updated_by: req.user.username };
        if (updates.part_number !== undefined) data.part_number = updates.part_number;
        if (updates.name !== undefined) data.name = updates.name;
        if (updates.tags !== undefined) data.tags = updates.tags;
        if (updates.make !== undefined) data.make = updates.make;
        if (updates.aed_buying_price !== undefined) data.aed_buying_price = updates.aed_buying_price;
        if (updates.ksh_buying_price !== undefined) data.ksh_buying_price = updates.ksh_buying_price;
        if (updates.selling_price !== undefined) data.selling_price = updates.selling_price;
        if (updates.stock_qty !== undefined) data.stock_qty = updates.stock_qty;
        if (updates.min_stock !== undefined) data.min_stock = updates.min_stock;

        const updated = await prisma.inventoryItem.update({
            where: { uuid },
            data
        });

        await redisCache.invalidatePattern(`inventory:${shop_id}:*`);
        await logAudit(shop_id, req.user.username, 'INVENTORY_UPDATE', 'INVENTORY', uuid, currentItem, updated, req);

        res.json({ message: 'Item updated', uuid, success: true });
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};

const batchUpdate = async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Updates array required' });
        }

        let successCount = 0;

        for (const update of updates) {
            try {
                const currentItem = await prisma.inventoryItem.findFirst({
                    where: { uuid: update.uuid, shop_id }
                });
                
                if (!currentItem) continue;

                const qty = update.stock_qty !== undefined ? update.stock_qty : update.new_qty;
                
                await prisma.inventoryItem.update({
                    where: { uuid: update.uuid },
                    data: { stock_qty: qty, updated_by: req.user.username }
                });

                await logAudit(shop_id, req.user.username, 'STOCK_UPDATE', 'INVENTORY', update.uuid, { stock_qty: currentItem.stock_qty }, { stock_qty: qty }, req);
                successCount++;
            } catch (e) {
                console.error(`Failed to update item ${update.uuid}:`, e);
            }
        }

        await redisCache.invalidatePattern(`inventory:${shop_id}:*`);
        res.json({ message: `Updated ${successCount} items`, count: successCount, success: true });
    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({ error: 'Batch update failed' });
    }
};

router.patch('/batch-update', requireCounterOrAdmin, batchUpdate);
router.put('/batch-update', requireCounterOrAdmin, batchUpdate);
router.put('/batch', requireCounterOrAdmin, batchUpdate);
router.patch('/:uuid', requireCounterOrAdmin, updateSingleItem);
router.put('/:uuid', requireCounterOrAdmin, updateSingleItem);

/**
 * DELETE /api/inventory/:uuid
 */
router.delete('/:uuid', requireAdmin, async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { uuid } = req.params;

        const currentItem = await prisma.inventoryItem.findFirst({
            where: { uuid, shop_id }
        });

        if (!currentItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await prisma.inventoryItem.update({
            where: { uuid },
            data: {
                name: `[DELETED] ${currentItem.name}`,
                stock_qty: 0,
                is_deleted: true,
                deleted_at: new Date(),
                deleted_by: req.user.username
            }
        });

        await redisCache.invalidatePattern(`inventory:${shop_id}:*`);
        await logAudit(shop_id, req.user.username, 'INVENTORY_SOFT_DELETE', 'INVENTORY', uuid, currentItem, { deleted: true }, req);

        res.json({ message: 'Item marked as deleted', uuid });
    } catch (error) {
        console.error('Delete inventory error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

router.post('/bulk-import', requireAdmin, async (req, res) => {
    try {
        const { shop_id, username } = req.user;
        const items = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid items array' });
        }

        let successCount = 0;
        let updateCount = 0;

        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                if (!item.part_number || !item.name || !item.make) continue;

                const existing = await tx.inventoryItem.findUnique({
                    where: { shop_id_part_number: { shop_id, part_number: item.part_number } }
                });

                if (existing) {
                    await tx.inventoryItem.update({
                        where: { shop_id_part_number: { shop_id, part_number: item.part_number } },
                        data: {
                            name: item.name,
                            make: item.make,
                            tags: item.tags || existing.tags,
                            aed_buying_price: item.aed_buying_price !== undefined ? parseFloat(item.aed_buying_price) : existing.aed_buying_price,
                            ksh_buying_price: item.ksh_buying_price !== undefined ? parseFloat(item.ksh_buying_price) : existing.ksh_buying_price,
                            selling_price: item.selling_price !== undefined ? parseFloat(item.selling_price) : existing.selling_price,
                            stock_qty: item.stock_qty !== undefined ? parseInt(item.stock_qty) : existing.stock_qty,
                            min_stock: item.min_stock !== undefined ? parseInt(item.min_stock) : existing.min_stock,
                            updated_by: username,
                            is_deleted: false,
                            deleted_at: null,
                            deleted_by: null
                        }
                    });
                    updateCount++;
                } else {
                    await tx.inventoryItem.create({
                        data: {
                            shop_id,
                            part_number: item.part_number,
                            name: item.name,
                            make: item.make,
                            tags: item.tags || '',
                            aed_buying_price: item.aed_buying_price ? parseFloat(item.aed_buying_price) : 0,
                            ksh_buying_price: item.ksh_buying_price ? parseFloat(item.ksh_buying_price) : 0,
                            selling_price: item.selling_price ? parseFloat(item.selling_price) : 0,
                            stock_qty: item.stock_qty ? parseInt(item.stock_qty) : 0,
                            min_stock: item.min_stock ? parseInt(item.min_stock) : 5,
                            updated_by: username
                        }
                    });
                    successCount++;
                }
            }

            await tx.auditLog.create({
                data: {
                    shop_id,
                    user: username,
                    action: 'INVENTORY_BULK_IMPORT',
                    details: JSON.stringify({ entityType: 'INVENTORY', added: successCount, updated: updateCount }),
                    ip_address: req.ip || 'unknown'
                }
            });
        });

        await redisCache.invalidatePattern(`inventory:${shop_id}:*`);

        res.json({ message: 'Bulk import successful', added: successCount, updated: updateCount });
    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({ error: 'Failed to process bulk import' });
    }
});

module.exports = router;
