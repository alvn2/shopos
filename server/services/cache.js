/**
 * In-memory cache service for ShopOS
 * Reduces Google Sheets API calls dramatically
 */

class CacheService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 30000; // 30 seconds default
    }

    /**
     * Get cached value if not expired
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Set cache value with optional TTL (milliseconds)
     */
    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    }

    /**
     * Invalidate specific key or pattern
     */
    invalidate(keyOrPattern) {
        if (typeof keyOrPattern === 'string') {
            this.cache.delete(keyOrPattern);
        } else if (keyOrPattern instanceof RegExp) {
            for (const key of this.cache.keys()) {
                if (keyOrPattern.test(key)) {
                    this.cache.delete(key);
                }
            }
        }
    }

    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    stats() {
        let valid = 0;
        let expired = 0;
        const now = Date.now();

        for (const item of this.cache.values()) {
            if (now > item.expiry) expired++;
            else valid++;
        }

        return { valid, expired, total: this.cache.size };
    }
}

// Export singleton instance
module.exports = new CacheService();
