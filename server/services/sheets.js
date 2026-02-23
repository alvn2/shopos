const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Cache for document and sheets
let docCache = null;
let cacheTime = null;
const CACHE_DURATION = 60000; // 1 minute

// Tab names as constants
const TABS = {
    INVENTORY: 'INVENTORY',
    SALES: 'SALES',
    AUDIT_LOG: 'AUDIT_LOG',
    USERS: 'USERS',
    SESSIONS: 'SESSIONS',
    SETTINGS: 'SETTINGS'
};

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000  // 10 seconds
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt) {
    const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
    );
    // Add jitter (±20%)
    return delay * (0.8 + Math.random() * 0.4);
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry(fn, context = 'operation') {
    let lastError;

    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (error.code === 'INVALID_CREDENTIALS' ||
                error.message?.includes('not found') ||
                error.status === 404) {
                throw error;
            }

            // Log retry attempt
            if (attempt < RETRY_CONFIG.maxRetries - 1) {
                const delay = getBackoffDelay(attempt);
                console.warn(`[Sheets] ${context} failed (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}), retrying in ${Math.round(delay)}ms:`, error.message);
                await sleep(delay);
            }
        }
    }

    console.error(`[Sheets] ${context} failed after ${RETRY_CONFIG.maxRetries} attempts`);
    throw lastError;
}

/**
 * Get authenticated Google Spreadsheet document
 */
async function getDocument() {
    const now = Date.now();
    if (docCache && cacheTime && (now - cacheTime < CACHE_DURATION)) {
        return docCache;
    }

    return withRetry(async () => {
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        docCache = doc;
        cacheTime = now;

        return doc;
    }, 'getDocument');
}

/**
 * Get a specific sheet by tab name
 */
async function getSheet(tabName) {
    const doc = await getDocument();
    const sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
        throw new Error(`Sheet "${tabName}" not found. Please create it in your spreadsheet.`);
    }
    return sheet;
}

/**
 * Get all rows from a sheet as objects
 */
async function getAllRows(tabName) {
    const sheet = await getSheet(tabName);
    const rows = await sheet.getRows();
    return rows.map(row => row.toObject());
}

/**
 * Add a new row to a sheet
 */
async function addRow(tabName, data) {
    const sheet = await getSheet(tabName);
    const row = await sheet.addRow(data);
    return row.toObject();
}

/**
 * Find and update a row by filter criteria
 */
async function updateRow(tabName, filter, updates) {
    const sheet = await getSheet(tabName);
    const rows = await sheet.getRows();

    const row = rows.find(r => {
        return Object.keys(filter).every(key => r.get(key) === String(filter[key]));
    });

    if (!row) {
        throw new Error(`Row not found with filter: ${JSON.stringify(filter)}`);
    }

    Object.keys(updates).forEach(key => {
        row.set(key, updates[key]);
    });

    await row.save();
    return row.toObject();
}

/**
 * Delete a row by filter criteria
 */
async function deleteRow(tabName, filter) {
    const sheet = await getSheet(tabName);
    const rows = await sheet.getRows();

    const row = rows.find(r => {
        return Object.keys(filter).every(key => r.get(key) === String(filter[key]));
    });

    if (!row) {
        throw new Error(`Row not found with filter: ${JSON.stringify(filter)}`);
    }

    await row.delete();
    return true;
}

/**
 * Delete multiple rows matching filter
 */
async function deleteRows(tabName, filterFn) {
    const sheet = await getSheet(tabName);
    const rows = await sheet.getRows();

    const toDelete = rows.filter(filterFn);
    for (const row of toDelete) {
        await row.delete();
    }

    return toDelete.length;
}

/**
 * Find a single row by filter
 */
async function findRow(tabName, filter) {
    const sheet = await getSheet(tabName);
    const rows = await sheet.getRows();

    const row = rows.find(r => {
        return Object.keys(filter).every(key => r.get(key) === String(filter[key]));
    });

    return row ? row.toObject() : null;
}

/**
 * Batch update multiple rows
 */
async function batchUpdate(tabName, updates, idField = 'UUID') {
    const sheet = await getSheet(tabName);
    const rows = await sheet.getRows();

    // Instead of sequentially saving each row (1 API call per row),
    // we use cell-based batch updating (1 API call total for all rows).
    await sheet.loadCells();

    let count = 0;
    for (const update of updates) {
        const idValue = String(update[idField.toLowerCase()] || update[idField]);
        const row = rows.find(r => r.get(idField) === idValue);

        if (row) {
            // row.rowNumber is 1-based (row 2 is the first data row)
            // sheet.getCell uses 0-based indices
            const rowIndex = row.rowNumber - 1;

            Object.keys(update).forEach(key => {
                if (key !== idField && key !== idField.toLowerCase()) {
                    // Map camelCase to sheet column names
                    const columnName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());

                    const colIndex = sheet.headerValues.indexOf(columnName);
                    if (colIndex !== -1) {
                        const cell = sheet.getCell(rowIndex, colIndex);
                        cell.value = update[key];
                    }
                }
            });
            count++;
        }
    }

    if (count > 0) {
        await sheet.saveUpdatedCells();
    }

    return count;
}

/**
 * Check if connection to Google Sheets is working
 */
async function testConnection() {
    try {
        const doc = await getDocument();
        return {
            connected: true,
            title: doc.title,
            sheets: Object.keys(doc.sheetsByTitle)
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message
        };
    }
}

module.exports = {
    TABS,
    getDocument,
    getSheet,
    getAllRows,
    addRow,
    updateRow,
    deleteRow,
    deleteRows,
    findRow,
    batchUpdate,
    testConnection
};
