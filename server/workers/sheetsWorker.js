const { Worker } = require('bullmq');
const Redis = require('ioredis');
const sheets = require('../services/sheets');
const redisCache = require('../services/redisCache');

const TABS = sheets.TABS;

// Worker connection
const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

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

// Create the worker
const sheetsWorker = new Worker('sheets-writes', async (job) => {
    console.log(`[Worker] Started processing job ${job.id} (${job.name})`);
    const { name, data } = job;

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
            // Assuming we also add sales caching eventually

            console.log(`[Worker] Job ${job.id} completed (record-sale) for batch ${saleRecord.Batch_ID}`);
            return { success: true, batchId: saleRecord.Batch_ID };

        } else if (name === 'update-inventory') {
            // For general inventory updates handled asynchronously (if configured)
            // Currently implemented sync in route, but we leave hook here
            // ...

            await redisCache.invalidatePattern('inventory:*');
            return { success: true };
        } else {
            throw new Error(`Unknown job type: ${name}`);
        }
    } catch (error) {
        console.error(`[Worker] Job ${job.id} failed:`, error.message);
        throw error; // Let BullMQ handle retries
    }
}, {
    connection,
    concurrency: 1, // Crucial for Google Sheets API limits and preventing conflicts
});

sheetsWorker.on('completed', (job) => {
    // console.log(`[Worker] Job ${job.id} has completed!`);
});

sheetsWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} has failed with ${err.message}`);
});

module.exports = sheetsWorker;
