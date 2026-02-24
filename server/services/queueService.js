const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Ensure BullMQ doesn't block connecting if Redis isn't up right away
const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

const sheetsQueue = new Queue('sheets-writes', { connection });

/**
 * Add an inventory update job to the queue
 * @param {Object} data - Update data
 */
async function addInventoryUpdateToQueue(data) {
    return await sheetsQueue.add('update-inventory', data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    });
}

/**
 * Add a sales record job to the queue
 * @param {Object} data - Sales data
 */
async function addSaleToQueue(data) {
    return await sheetsQueue.add('record-sale', data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    });
}

module.exports = {
    sheetsQueue,
    addInventoryUpdateToQueue,
    addSaleToQueue
};
