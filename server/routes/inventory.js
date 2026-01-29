const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sheets = require('../services/sheets');
const cache = require('../services/cache');
const { authenticateSession, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const TABS = sheets.TABS;
const CACHE_KEY = 'inventory:all';
const CACHE_TTL = 30000; // 30 seconds

// All inventory routes require authentication
router.use(authenticateSession);

/**
 * GET /api/inventory
 * Get all inventory items (with caching)
 */
router.get('/', async (req, res) => {
    try {
        // Check cache first
        const cached = cache.get(CACHE_KEY);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const items = await sheets.getAllRows(TABS.INVENTORY);

        // Filter out soft-deleted items
        const activeItems = items.filter(item => item.Is_Deleted !== 'TRUE');

        // Transform to camelCase for frontend
        const transformed = activeItems.map(item => ({
            uuid: item.UUID,
            part_number: item.Part_Number,
            name: item.Name,
            tags: item.Tags || '',
            aed_buying_price: parseFloat(item.AED_Buying_Price) || 0,
            selling_price: parseFloat(item.Selling_Price) || 0,
            stock_qty: parseInt(item.Stock_Qty) || 0,
            min_stock: parseInt(item.Min_Stock) || 5,
            last_updated: item.Last_Updated,
            updated_by: item.Updated_By
        }));

        // Cache the result
        cache.set(CACHE_KEY, transformed, CACHE_TTL);
        res.set('X-Cache', 'MISS');
        res.json(transformed);
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

/**
 * POST /api/inventory
 * Add a new inventory item (admin only)
 */
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { part_number, name, tags, aed_buying_price, selling_price, stock_qty, min_stock } = req.body;

        if (!part_number || !name) {
            return res.status(400).json({ error: 'Part number and name are required' });
        }

        const now = new Date().toISOString();
        const newItem = {
            UUID: uuidv4(),
            Part_Number: part_number,
            Name: name,
            Tags: tags || '',
            AED_Buying_Price: aed_buying_price || 0,
            Selling_Price: selling_price || 0,
            Stock_Qty: stock_qty || 0,
            Min_Stock: min_stock || 5,
            Last_Updated: now,
            Updated_By: req.user.username
        };

        await sheets.addRow(TABS.INVENTORY, newItem);

        // Invalidate cache
        cache.invalidate(CACHE_KEY);

        // Audit log
        await logAudit(req.user.username, 'INVENTORY_CREATE', 'INVENTORY', newItem.UUID, null, newItem, req);

        res.status(201).json({
            uuid: newItem.UUID,
            part_number: newItem.Part_Number,
            name: newItem.Name,
            tags: newItem.Tags,
            aed_buying_price: newItem.AED_Buying_Price,
            selling_price: newItem.Selling_Price,
            stock_qty: newItem.Stock_Qty,
            min_stock: newItem.Min_Stock,
            last_updated: newItem.Last_Updated,
            updated_by: newItem.Updated_By
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
        if (updates.aed_buying_price !== undefined) sheetUpdates.AED_Buying_Price = updates.aed_buying_price;
        if (updates.selling_price !== undefined) sheetUpdates.Selling_Price = updates.selling_price;
        if (updates.stock_qty !== undefined) sheetUpdates.Stock_Qty = updates.stock_qty;
        if (updates.min_stock !== undefined) sheetUpdates.Min_Stock = updates.min_stock;

        await sheets.updateRow(TABS.INVENTORY, { UUID: uuid }, sheetUpdates);

        // Invalidate cache
        cache.invalidate(CACHE_KEY);

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
        cache.invalidate(CACHE_KEY);

        res.json({ message: `Updated ${successCount} items`, count: successCount, success: true });
    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({ error: 'Batch update failed' });
    }
};

// Register routes (Batch first to avoid collision with :uuid)
router.patch('/batch-update', batchUpdate);
router.put('/batch-update', batchUpdate);
router.put('/batch', batchUpdate);

router.patch('/:uuid', updateSingleItem);
router.put('/:uuid', updateSingleItem);



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
        cache.invalidate(CACHE_KEY);

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

module.exports = router;
