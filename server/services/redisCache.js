// A simple in-memory TTL cache to replace Redis
const cacheStore = new Map();

/**
 * Get data from cache
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
async function getCache(key) {
    try {
        const item = cacheStore.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            cacheStore.delete(key);
            return null;
        }
        return item.value;
    } catch (error) {
        console.error(`[Memory Cache] Get Error. Key: ${key}`, error);
        return null;
    }
}

/**
 * Set data in cache with TTL
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlInSeconds 
 */
async function setCache(key, value, ttlInSeconds = 300) {
    try {
        cacheStore.set(key, {
            value: value, // We assume value is already a plain object or array
            expiresAt: Date.now() + (ttlInSeconds * 1000)
        });
    } catch (error) {
        console.error(`[Memory Cache] Set Error. Key: ${key}`, error);
    }
}

/**
 * Invalidate a specific cache key
 * @param {string} key 
 */
async function clearCache(key) {
    try {
        cacheStore.delete(key);
    } catch (error) {
        console.error(`[Memory Cache] Clear Error. Key: ${key}`, error);
    }
}

/**
 * Invalidate multiple cache keys matching a regex pattern or prefix (e.g. 'inventory:*')
 * @param {string} matchPattern 
 */
async function invalidatePattern(matchPattern) {
    try {
        // Convert simple wildcard 'inventory:*' to regex
        const regexStr = matchPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexStr}$`);
        
        for (const key of cacheStore.keys()) {
            if (regex.test(key)) {
                cacheStore.delete(key);
            }
        }
    } catch (error) {
        console.error(`[Memory Cache] Invalidate Pattern Error: ${matchPattern}`, error);
    }
}

module.exports = {
    // Return dummy redisClient so health check and cleanup don't crash
    redisClient: { 
        status: 'ready', 
        disconnect: () => {} 
    },
    getCache,
    setCache,
    clearCache,
    invalidatePattern
};
