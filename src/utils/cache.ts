import crypto from "crypto";
import fs from "fs";
import path from "path";

// Cache interface definition
// Define the structure of a cache entry
interface CacheEntry<T> {
  value: T;
  timestamp?: string;
}

interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, timestamp?: string): void;
  has(key: string): boolean;
  getTimestamp(key: string): string | undefined;
}

// In-memory cache implementation
export class MemoryCache<T> implements Cache<T> {
  private _cache: Map<string, CacheEntry<T>> = new Map();

  get(key: string): T | undefined {
    const entry = this._cache.get(key);
    return entry?.value;
  }

  set(key: string, value: T, timestamp?: string): void {
    this._cache.set(key, { value, timestamp });
  }

  getTimestamp(key: string): string | undefined {
    return this._cache.get(key)?.timestamp;
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  // Add a method to get all entries as a Record
  getAllEntries(): Record<string, CacheEntry<T>> {
    const entries: Record<string, CacheEntry<T>> = {};
    this._cache.forEach((value, key) => {
      entries[key] = value;
    });
    return entries;
  }
}

// Persistent cache implementation that saves to disk
export class PersistentCache<T> implements Cache<T> {
  private _memoryCache: MemoryCache<T> = new MemoryCache<T>();
  private _filePath: string;

  constructor(cacheFileName: string) {
    this._filePath = path.join(process.cwd(), cacheFileName);
    this._loadFromDisk();
  }

  private _loadFromDisk(): void {
    try {
      if (fs.existsSync(this._filePath)) {
        const data = fs.readFileSync(this._filePath, "utf-8");
        const cacheData = JSON.parse(data) as Record<string, CacheEntry<T>>;

        for (const [key, entry] of Object.entries(cacheData)) {
          this._memoryCache.set(key, entry.value, entry.timestamp);
        }

        console.log(`Loaded ${Object.keys(cacheData).length} cached entries from ${this._filePath}`);
      }
    } catch (error) {
      console.error(`Error loading cache from ${this._filePath}:`, error);
    }
  }

  saveToDisk(): void {
    try {
      // Get all entries from the memory cache
      const cacheObject = this._memoryCache.getAllEntries();

      fs.writeFileSync(this._filePath, JSON.stringify(cacheObject, null, 2));
      console.log(`Saved cache to ${this._filePath}`);
    } catch (error) {
      console.error(`Error saving cache to ${this._filePath}:`, error);
    }
  }

  get(key: string): T | undefined {
    return this._memoryCache.get(key);
  }

  set(key: string, value: T, timestamp?: string): void {
    this._memoryCache.set(key, value, timestamp);
  }

  getTimestamp(key: string): string | undefined {
    return this._memoryCache.getTimestamp(key);
  }

  has(key: string): boolean {
    return this._memoryCache.has(key);
  }
}

// Helper function to create hash keys for caching
/**
 * Check if a timestamp is within 6 hours of the current time
 */
export function isWithinSixHours(timestamp: string): boolean {
  const cachedTime = new Date(timestamp).getTime();
  const currentTime = Date.now();
  const sixHoursInMs = 6 * 60 * 60 * 1000;
  return (currentTime - cachedTime) < sixHoursInMs;
}

export function createHashKey(args: unknown[]): string {
  const stringifiedArgs = JSON.stringify(args);
  // Using SHA-256 instead of MD5 for better security
  return crypto.createHash("sha256").update(stringifiedArgs).digest("hex");
}

// Function decorator for caching - removed as unused
