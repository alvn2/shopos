const Redis = require('ioredis');

// Connect to Redis using REDIS_URL from .env or fallback to localhost
const redisOptions = {
    // Retry strategy to handle connection drops without crashing
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, redisOptions)
    : new Redis(redisOptions);

redis.on('error', (error) => {
    console.error('[Redis Cache] Error:', error.message);
});

redis.on('connect', () => {
    console.log('[Redis Cache] Connected successfully');
});

/**
 * Get data from cache
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
async function getCache(key) {
    try {
        if (redis.status !== 'ready') return null;

        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`[Redis Cache] Get Cache Error. Key: ${key}`, error);
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
        if (redis.status !== 'ready') return;

        const serialized = JSON.stringify(value);
        await redis.setex(key, ttlInSeconds, serialized);
    } catch (error) {
        console.error(`[Redis Cache] Set Cache Error. Key: ${key}`, error);
    }
}

/**
 * Invalidate a specific cache key
 * @param {string} key 
 */
async function clearCache(key) {
    try {
        if (redis.status !== 'ready') return;

        await redis.del(key);
        // Also support partial matches or wildcard if needed
    } catch (error) {
        console.error(`[Redis Cache] Clear Cache Error. Key: ${key}`, error);
    }
}

/**
 * Invalidate multiple cache keys matching a pattern (e.g. 'inventory:*')
 * @param {string} matchPattern 
 */
async function invalidatePattern(matchPattern) {
    try {
        if (redis.status !== 'ready') return;

        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan('0', 'MATCH', matchPattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys && keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');
    } catch (error) {
        console.error(`[Redis Cache] Invalidate Pattern Error: ${matchPattern}`, error);
    }
}

module.exports = {
    redisClient: redis,
    getCache,
    setCache,
    clearCache,
    invalidatePattern
};
