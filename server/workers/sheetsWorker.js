const sheets = require('../services/sheets');
const redisCache = require('../services/redisCache');

const TABS = sheets.TABS;

/**
 * Audit Log Helper for Worker
 */
async function logAuditWorker(user, action, entityType, entityId, oldValue, newValue, ip, userAgent) {
    try {
        await sheets.addRow(TABS.AUDIT_LOG, {
            Timestamp: new Date().toISOString(),
            User: user || 'System (Worker)',
            Action: action,
            Entity_Type: entityType,
            Entity_ID: entityId,
            Old_Value: oldValue ? JSON.stringify(oldValue) : '',
            New_Value: newValue ? JSON.stringify(newValue) : '',
            IP_Address: ip || '',
            Device_Info: (userAgent || '').substring(0, 200)
        });
    } catch (error) {
        console.error('[Worker] Audit log error:', error);
    }
}

/**
 * Process a job from the queue
 * @param {Object} job
 */
async function processJob(job) {
    const { name, data } = job;
    console.log(`[Worker] Started processing job (${name})`);

    try {
        if (name === 'record-sale') {
            const { saleRecord, itemsData, reqInfo } = data;

            // 1. Write the sale to Sales tab
            await sheets.addRow(TABS.SALES, saleRecord);

            // 2. Deduct inventory for each item
            if (itemsData && itemsData.length > 0) {
                for (const item of itemsData) {
                    try {
                        const inventoryItem = await sheets.findRow(TABS.INVENTORY, { UUID: item.uuid });
                        if (inventoryItem) {
                            const currentStock = parseInt(inventoryItem.Stock_Qty) || 0;
                            const MathMaxStock = Math.max(0, currentStock - item.qty);

                            await sheets.updateRow(TABS.INVENTORY, { UUID: item.uuid }, {
                                Stock_Qty: MathMaxStock,
                                Last_Updated: new Date().toISOString(),
                                Updated_By: saleRecord.Sold_By
                            });

                            // Audit inventory change
                            await logAuditWorker(
                                saleRecord.Sold_By,
                                'SALE_STOCK_DEDUCTION',
                                'INVENTORY',
                                item.uuid,
                                { stock_qty: currentStock },
                                { stock_qty: MathMaxStock, sale_batch: saleRecord.Batch_ID },
                                reqInfo.ip,
                                reqInfo.userAgent
                            );
                        }
                    } catch (err) {
                        console.error(`[Worker] Failed to deduct stock for ${item.uuid}:`, err);
                        // We continue with other items even if one fails
                    }
                }
            }

            // 3. Audit sale
            await logAuditWorker(
                saleRecord.Sold_By,
                'SALE_RECORDED',
                'SALES',
                saleRecord.Batch_ID,
                null,
                saleRecord,
                reqInfo.ip,
                reqInfo.userAgent
            );

            // 4. Clear Sales Cache and Inventory Cache
            // We use wildcard invalidation if supported, or targeted keys
            await redisCache.invalidatePattern('inventory:*');

            console.log(`[Worker] Job completed (record-sale) for batch ${saleRecord.Batch_ID}`);
            return { success: true, batchId: saleRecord.Batch_ID };

        } else if (name === 'update-inventory') {
            await redisCache.invalidatePattern('inventory:*');
            return { success: true };
        } else {
            throw new Error(`Unknown job type: ${name}`);
        }
    } catch (error) {
        console.error(`[Worker] Job failed:`, error.message);
        throw error;
    }
}

module.exports = {
    processJob,
    close: async () => {} // Dummy method to satisfy graceful shutdown logic in index.js
};
