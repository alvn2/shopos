const sheetsWorker = require('../workers/sheetsWorker');

// In-Memory Queue State
const queue = [];
let isProcessing = false;

/**
 * Process the next item in the queue.
 */
async function processQueue() {
    // If we're already processing or queue is empty, do nothing
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    while (queue.length > 0) {
        const job = queue[0];
        try {
            console.log(`[Queue] Processing job: ${job.name}`);
            await sheetsWorker.processJob(job);
        } catch (error) {
            console.error(`[Queue] Job failed: ${job.name}`, error);
            // Job failed, but we must continue to the next one to avoid hanging
        } finally {
            queue.shift(); // Remove the processed task from the front
        }
    }

    isProcessing = false;
}

/**
 * Add an inventory update job to the queue
 * @param {Object} data - Update data
 */
async function addInventoryUpdateToQueue(data) {
    queue.push({ name: 'update-inventory', data });
    processQueue(); // trigger processing asynchronously
}

/**
 * Add a sales record job to the queue
 * @param {Object} data - Sales data
 */
async function addSaleToQueue(data) {
    queue.push({ name: 'record-sale', data });
    processQueue(); 
}

module.exports = {
    addInventoryUpdateToQueue,
    addSaleToQueue
};
