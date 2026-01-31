/**
 * Enhanced In-memory Cache Service for ShopOS
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time To Live) expiration
 * - Max size limits
 * - Cache warming support
 */

class CacheService {
    constructor(options = {}) {
        this.cache = new Map();
        this.defaultTTL = options.defaultTTL || 30000; // 30 seconds default
        this.maxSize = options.maxSize || 100; // Maximum number of entries
        this.accessOrder = []; // Track access order for LRU
    }

    /**
     * Get cached value if not expired
     * Updates access order for LRU
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this._removeFromAccessOrder(key);
            return null;
        }

        // Update access order (move to end = most recently used)
        this._updateAccessOrder(key);

        return item.value;
    }

    /**
     * Set cache value with optional TTL (milliseconds)
     * Implements LRU eviction when max size is reached
     */
    set(key, value, ttl = this.defaultTTL) {
        // If key already exists, update it
        if (this.cache.has(key)) {
            this.cache.set(key, {
                value,
                expiry: Date.now() + ttl
            });
            this._updateAccessOrder(key);
            return;
        }

        // Check if we need to evict (LRU policy)
        if (this.cache.size >= this.maxSize) {
            this._evictLRU();
        }

        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl
        });
        this.accessOrder.push(key);
    }

    /**
     * Evict the least recently used item
     */
    _evictLRU() {
        // First, try to evict expired items
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
            }
        }

        // If still at max size, evict LRU (oldest in access order)
        while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
            const lruKey = this.accessOrder.shift();
            this.cache.delete(lruKey);
        }
    }

    /**
     * Update access order (move key to end)
     */
    _updateAccessOrder(key) {
        this._removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * Remove key from access order
     */
    _removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * Invalidate specific key or pattern
     */
    invalidate(keyOrPattern) {
        if (typeof keyOrPattern === 'string') {
            this.cache.delete(keyOrPattern);
            this._removeFromAccessOrder(keyOrPattern);
        } else if (keyOrPattern instanceof RegExp) {
            for (const key of this.cache.keys()) {
                if (keyOrPattern.test(key)) {
                    this.cache.delete(key);
                    this._removeFromAccessOrder(key);
                }
            }
        }
    }

    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * Warm the cache with initial data
     * Useful for preloading frequently accessed data on startup
     */
    warm(entries) {
        for (const { key, value, ttl } of entries) {
            this.set(key, value, ttl || this.defaultTTL);
        }
    }

    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this._removeFromAccessOrder(key);
            return false;
        }
        return true;
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

        return {
            valid,
            expired,
            total: this.cache.size,
            max_size: this.maxSize
        };
    }

    /**
     * Clean up expired entries
     * Can be called periodically to free memory
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
                cleaned++;
            }
        }

        return cleaned;
    }
}

// Export singleton instance with production-ready defaults
module.exports = new CacheService({
    defaultTTL: 30000,  // 30 seconds
    maxSize: 200        // 200 entries max
});
