const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sheets = require('../services/sheets');
const redisCache = require('../services/redisCache');
const { authenticateSession, requireAdmin, requireCounterOrAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
const TABS = sheets.TABS;
const CACHE_KEY = 'inventory:all';
const CACHE_TTL = 30000; // 30 seconds

/**
 * Helper to parse prices from Google Sheets that may have currency suffixes and commas
 * Handles formats like: "2,000 KES", "2000", "2,000.50", "100 AED", etc.
 */
function parsePrice(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    // Remove currency suffixes (KES, AED, etc.), commas, and whitespace
    const cleaned = String(value)
        .replace(/\s*(KES|AED|KSH|USD|EUR)\s*/gi, '')
        .replace(/,/g, '')
        .trim();
    return parseFloat(cleaned) || 0;
}

// All inventory routes require authentication
router.use(authenticateSession);

/**
 * GET /api/inventory
 * Get inventory items with optional pagination, search, and filtering
 * Query params: page, limit, search, sort_by, sort_order, low_stock
 */
router.get('/', async (req, res) => {
    try {
        const { page, limit, search, sort_by, sort_order, low_stock } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 0; // 0 means no pagination (backward compatible)

        // Build cache key based on query params
        const cacheKey = limitNum > 0
            ? `${CACHE_KEY}:${pageNum}:${limitNum}:${search || ''}:${sort_by || ''}:${low_stock || ''}`
            : CACHE_KEY;

        // Check cache first (only for full list without filters)
        if (!search && !low_stock && limitNum === 0) {
            const cached = await redisCache.getCache(cacheKey);
            if (cached) {
                res.set('X-Cache', 'HIT');
                return res.json(cached);
            }
        }

        const items = await sheets.getAllRows(TABS.INVENTORY);

        // Filter out soft-deleted items
        let activeItems = items.filter(item => item.Is_Deleted !== 'TRUE');

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            activeItems = activeItems.filter(item =>
                (item.Part_Number || '').toLowerCase().includes(searchLower) ||
                (item.Name || '').toLowerCase().includes(searchLower) ||
                (item.Tags || '').toLowerCase().includes(searchLower)
            );
        }

        // Low stock filter
        if (low_stock === 'true') {
            activeItems = activeItems.filter(item => {
                const stock = parseInt(item.Stock_Qty) || 0;
                const minStock = parseInt(item.Min_Stock) || 5;
                return stock <= minStock;
            });
        }

        // Transform to camelCase for frontend
        let transformed = activeItems.map(item => ({
            uuid: item.UUID,
            part_number: item.Part_Number,
            name: item.Name,
            tags: item.Tags || '',
            make: item.Make || 'Genuine',
            aed_buying_price: parsePrice(item.AED_Buying_Price),
            ksh_buying_price: parsePrice(item.KSH_Buying_Price),
            selling_price: parsePrice(item.Selling_Price),
            stock_qty: parseInt(item.Stock_Qty) || 0,
            min_stock: parseInt(item.Min_Stock) || 5,
            last_updated: item.Last_Updated,
            updated_by: item.Updated_By
        }));

        // Sorting
        if (sort_by) {
            const order = sort_order === 'asc' ? 1 : -1;
            transformed.sort((a, b) => {
                const aVal = a[sort_by];
                const bVal = b[sort_by];
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return (aVal - bVal) * order;
                }
                return String(aVal || '').localeCompare(String(bVal || '')) * order;
            });
        }

        const total = transformed.length;

        // Pagination
        if (limitNum > 0) {
            const offset = (pageNum - 1) * limitNum;
            transformed = transformed.slice(offset, offset + limitNum);

            res.set('X-Cache', 'MISS');
            return res.json({
                items: transformed,
                total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(total / limitNum)
            });
        }

        // No pagination - cache and return full list (backward compatible)
        await redisCache.setCache(CACHE_KEY, transformed, CACHE_TTL);
        res.set('X-Cache', 'MISS');
        res.json(transformed);
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

/**
 * POST /api/inventory
 * Add a new inventory item or update existing (upsert by part_number + make)
 * If item with same part_number AND make exists:
 *   - Add stock_qty to existing
 *   - Update prices if provided
 * Otherwise create new item
 */
router.post('/', requireAdmin, validate('inventoryItem', 'body'), async (req, res) => {
    try {
        const { part_number, name, tags, make = 'Genuine', aed_buying_price, ksh_buying_price, selling_price, stock_qty, min_stock } = req.body;

        const now = new Date().toISOString();
        const partNumberUpper = part_number.trim().toUpperCase();

        // Check for existing item with same part_number AND make
        const items = await sheets.getAllRows(TABS.INVENTORY);
        const existingItem = items.find(item =>
            item.Is_Deleted !== 'TRUE' &&
            (item.Part_Number || '').toUpperCase() === partNumberUpper &&
            (item.Make || 'Genuine') === make
        );

        if (existingItem) {
            // UPSERT: Update existing item
            const currentStock = parseInt(existingItem.Stock_Qty) || 0;
            const newStock = currentStock + (parseInt(stock_qty) || 0);

            const sheetUpdates = {
                Stock_Qty: newStock,
                Last_Updated: now,
                Updated_By: req.user.username
            };

            // Update name if provided
            if (name) sheetUpdates.Name = name;
            // Update tags if provided
            if (tags !== undefined) sheetUpdates.Tags = tags;
            // Update prices if provided (don't overwrite with 0)
            if (aed_buying_price > 0) sheetUpdates.AED_Buying_Price = aed_buying_price;
            if (ksh_buying_price > 0) sheetUpdates.KSH_Buying_Price = ksh_buying_price;
            if (selling_price > 0) sheetUpdates.Selling_Price = selling_price;
            if (min_stock !== undefined) sheetUpdates.Min_Stock = min_stock;

            await sheets.updateRow(TABS.INVENTORY, { UUID: existingItem.UUID }, sheetUpdates);

            // Invalidate cache
            await redisCache.invalidatePattern('inventory:*');

            // Audit log
            await logAudit(req.user.username, 'INVENTORY_UPDATE', 'INVENTORY', existingItem.UUID, existingItem, sheetUpdates, req);

            return res.status(200).json({
                uuid: existingItem.UUID,
                part_number: partNumberUpper,
                name: sheetUpdates.Name || existingItem.Name,
                tags: sheetUpdates.Tags !== undefined ? sheetUpdates.Tags : existingItem.Tags,
                make: make,
                aed_buying_price: sheetUpdates.AED_Buying_Price || parsePrice(existingItem.AED_Buying_Price),
                ksh_buying_price: sheetUpdates.KSH_Buying_Price || parsePrice(existingItem.KSH_Buying_Price),
                selling_price: sheetUpdates.Selling_Price || parsePrice(existingItem.Selling_Price),
                stock_qty: newStock,
                min_stock: sheetUpdates.Min_Stock !== undefined ? sheetUpdates.Min_Stock : parseInt(existingItem.Min_Stock) || 5,
                last_updated: now,
                updated_by: req.user.username,
                upserted: true,
                previous_stock: currentStock,
                added_stock: parseInt(stock_qty) || 0
            });
        }

        // CREATE: New item
        const newItem = {
            UUID: uuidv4(),
            Part_Number: partNumberUpper,
            Name: name,
            Tags: tags || '',
            Make: make,
            AED_Buying_Price: aed_buying_price || 0,
            KSH_Buying_Price: ksh_buying_price || 0,
            Selling_Price: selling_price || 0,
            Stock_Qty: stock_qty || 0,
            Min_Stock: min_stock || 5,
            Last_Updated: now,
            Updated_By: req.user.username
        };

        await sheets.addRow(TABS.INVENTORY, newItem);

        // Invalidate cache
        await redisCache.invalidatePattern('inventory:*');

        // Audit log
        await logAudit(req.user.username, 'INVENTORY_CREATE', 'INVENTORY', newItem.UUID, null, newItem, req);

        res.status(201).json({
            uuid: newItem.UUID,
            part_number: newItem.Part_Number,
            name: newItem.Name,
            tags: newItem.Tags,
            make: newItem.Make,
            aed_buying_price: newItem.AED_Buying_Price,
            ksh_buying_price: newItem.KSH_Buying_Price,
            selling_price: newItem.Selling_Price,
            stock_qty: newItem.Stock_Qty,
            min_stock: newItem.Min_Stock,
            last_updated: newItem.Last_Updated,
            updated_by: newItem.Updated_By,
            upserted: false
        });
    } catch (error) {
        console.error('Create inventory error:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

/**
 * PATCH/PUT /api/inventory/:uuid
 * Update a single inventory item
 */
const updateSingleItem = async (req, res) => {
    try {
        const { uuid } = req.params;
        const updates = req.body;

        // Get current item for audit
        const currentItem = await sheets.findRow(TABS.INVENTORY, { UUID: uuid });
        if (!currentItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Prepare sheet updates (convert to PascalCase)
        const sheetUpdates = {
            Last_Updated: new Date().toISOString(),
            Updated_By: req.user.username
        };

        if (updates.part_number !== undefined) sheetUpdates.Part_Number = updates.part_number;
        if (updates.name !== undefined) sheetUpdates.Name = updates.name;
        if (updates.tags !== undefined) sheetUpdates.Tags = updates.tags;
        if (updates.make !== undefined) sheetUpdates.Make = updates.make;
        if (updates.aed_buying_price !== undefined) sheetUpdates.AED_Buying_Price = updates.aed_buying_price;
        if (updates.ksh_buying_price !== undefined) sheetUpdates.KSH_Buying_Price = updates.ksh_buying_price;
        if (updates.selling_price !== undefined) sheetUpdates.Selling_Price = updates.selling_price;
        if (updates.stock_qty !== undefined) sheetUpdates.Stock_Qty = updates.stock_qty;
        if (updates.min_stock !== undefined) sheetUpdates.Min_Stock = updates.min_stock;

        await sheets.updateRow(TABS.INVENTORY, { UUID: uuid }, sheetUpdates);

        // Invalidate cache
        await redisCache.invalidatePattern('inventory:*');

        // Audit log
        await logAudit(req.user.username, 'INVENTORY_UPDATE', 'INVENTORY', uuid, currentItem, sheetUpdates, req);

        res.json({ message: 'Item updated', uuid, success: true });
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};


// Batch updates must be defined BEFORE /:uuid parameter route to avoid name collision


/**
 * PATCH/PUT /api/inventory/batch-update or /api/inventory/batch
 * Update multiple items (for Morning Stock)
 */
const batchUpdate = async (req, res) => {
    try {
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Updates array required' });
        }

        const now = new Date().toISOString();
        let successCount = 0;

        for (const update of updates) {
            try {
                const currentItem = await sheets.findRow(TABS.INVENTORY, { UUID: update.uuid });
                if (!currentItem) continue;

                await sheets.updateRow(TABS.INVENTORY, { UUID: update.uuid }, {
                    Stock_Qty: update.stock_qty || update.new_qty,
                    Last_Updated: now,
                    Updated_By: req.user.username
                });

                // Audit each change
                await logAudit(req.user.username, 'STOCK_UPDATE', 'INVENTORY', update.uuid,
                    { stock_qty: currentItem.Stock_Qty },
                    { stock_qty: update.stock_qty || update.new_qty },
                    req
                );

                successCount++;
            } catch (itemError) {
                console.error(`Failed to update item ${update.uuid}:`, itemError);
            }
        }

        // Invalidate cache after batch update
        await redisCache.invalidatePattern('inventory:*');

        res.json({ message: `Updated ${successCount} items`, count: successCount, success: true });
    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({ error: 'Batch update failed' });
    }
};

// Register routes (Batch first to avoid collision with :uuid)
router.patch('/batch-update', requireCounterOrAdmin, batchUpdate);
router.put('/batch-update', requireCounterOrAdmin, batchUpdate);
router.put('/batch', requireCounterOrAdmin, batchUpdate);

router.patch('/:uuid', requireCounterOrAdmin, updateSingleItem);
router.put('/:uuid', requireCounterOrAdmin, updateSingleItem);



/**
 * DELETE /api/inventory/:uuid
 * Soft-delete an inventory item (admin only)
 * Item is marked as deleted but NOT permanently removed for data protection
 */
router.delete('/:uuid', requireAdmin, async (req, res) => {
    try {
        const { uuid } = req.params;

        const currentItem = await sheets.findRow(TABS.INVENTORY, { UUID: uuid });
        if (!currentItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Soft delete: Mark as deleted instead of permanent deletion
        // This preserves data history and allows recovery if needed
        await sheets.updateRow(TABS.INVENTORY, { UUID: uuid }, {
            Name: `[DELETED] ${currentItem.Name}`,
            Stock_Qty: 0,
            Is_Deleted: 'TRUE',
            Deleted_At: new Date().toISOString(),
            Deleted_By: req.user.username
        });

        // Invalidate cache
        await redisCache.invalidatePattern('inventory:*');

        // Audit log with full old data for recovery purposes
        await logAudit(req.user.username, 'INVENTORY_SOFT_DELETE', 'INVENTORY', uuid, currentItem, { deleted: true }, req);

        res.json({ message: 'Item marked as deleted (recoverable via Google Sheets)', uuid });
    } catch (error) {
        console.error('Delete inventory error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
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

/**
 * POST /api/inventory/bulk-import
 * Bulk import inventory items with upsert support
 * Body: { items: [...], update_existing: boolean }
 */
router.post('/bulk-import', requireAdmin, validate('bulkImport', 'body'), async (req, res) => {
    try {
        const { items, update_existing = true } = req.body;
        const now = new Date().toISOString();
        const username = req.user.username;

        // Get all existing items for duplicate checking
        const existingItems = await sheets.getAllRows(TABS.INVENTORY);
        const activeItems = existingItems.filter(item => item.Is_Deleted !== 'TRUE');

        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
            items: []
        };

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                const partNumberUpper = item.part_number.trim().toUpperCase();
                const make = item.make || 'Genuine';

                // Check for existing item with same part_number AND make
                const existingItem = activeItems.find(existing =>
                    (existing.Part_Number || '').toUpperCase() === partNumberUpper &&
                    (existing.Make || 'Genuine') === make
                );

                if (existingItem) {
                    if (update_existing) {
                        // UPSERT: Update existing
                        const currentStock = parseInt(existingItem.Stock_Qty) || 0;
                        const newStock = currentStock + (parseInt(item.stock_qty) || 0);

                        const sheetUpdates = {
                            Stock_Qty: newStock,
                            Last_Updated: now,
                            Updated_By: username
                        };

                        if (item.name) sheetUpdates.Name = item.name;
                        if (item.tags !== undefined) sheetUpdates.Tags = item.tags;
                        if (item.aed_buying_price > 0) sheetUpdates.AED_Buying_Price = item.aed_buying_price;
                        if (item.ksh_buying_price > 0) sheetUpdates.KSH_Buying_Price = item.ksh_buying_price;
                        if (item.selling_price > 0) sheetUpdates.Selling_Price = item.selling_price;
                        if (item.min_stock !== undefined) sheetUpdates.Min_Stock = item.min_stock;

                        await sheets.updateRow(TABS.INVENTORY, { UUID: existingItem.UUID }, sheetUpdates);

                        results.updated++;
                        results.items.push({
                            index: i,
                            status: 'updated',
                            part_number: partNumberUpper,
                            make: make,
                            previous_stock: currentStock,
                            new_stock: newStock
                        });
                    } else {
                        results.skipped++;
                        results.items.push({
                            index: i,
                            status: 'skipped',
                            part_number: partNumberUpper,
                            make: make,
                            reason: 'Item exists and update_existing is false'
                        });
                    }
                } else {
                    // CREATE: New item
                    const newItem = {
                        UUID: uuidv4(),
                        Part_Number: partNumberUpper,
                        Name: item.name,
                        Tags: item.tags || '',
                        Make: make,
                        AED_Buying_Price: item.aed_buying_price || 0,
                        KSH_Buying_Price: item.ksh_buying_price || 0,
                        Selling_Price: item.selling_price || 0,
                        Stock_Qty: item.stock_qty || 0,
                        Min_Stock: item.min_stock || 5,
                        Last_Updated: now,
                        Updated_By: username
                    };

                    await sheets.addRow(TABS.INVENTORY, newItem);

                    // Add to activeItems for duplicate checking of subsequent items
                    activeItems.push(newItem);

                    results.created++;
                    results.items.push({
                        index: i,
                        status: 'created',
                        part_number: partNumberUpper,
                        make: make,
                        uuid: newItem.UUID
                    });
                }
            } catch (itemError) {
                results.errors.push({
                    index: i,
                    part_number: item.part_number,
                    error: itemError.message
                });
            }
        }

        // Invalidate cache
        await redisCache.invalidatePattern('inventory:*');

        // Audit log
        await logAudit(username, 'INVENTORY_BULK_IMPORT', 'INVENTORY', null, null, {
            total_items: items.length,
            created: results.created,
            updated: results.updated,
            skipped: results.skipped,
            errors: results.errors.length
        }, req);

        res.json({
            success: true,
            message: `Processed ${items.length} items`,
            ...results
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({ error: 'Failed to process bulk import' });
    }
});

module.exports = router;
