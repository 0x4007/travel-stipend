import crypto from "crypto";
import fs from "fs";
import path from "path";

// Cache interface definition
export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, timestamp?: string): void;
  has(key: string): boolean;
  getTimestamp?(key: string): string | undefined;
}

// In-memory cache implementation
export class MemoryCache<T> implements Cache<T> {
  private _cache: Map<string, T> = new Map();

  get(key: string): T | undefined {
    return this._cache.get(key);
  }

  private _timestamps: Map<string, string> = new Map();

  set(key: string, value: T, timestamp?: string): void {
    this._cache.set(key, value);
    if (timestamp) {
      this._timestamps.set(key, timestamp);
    }
  }

  getTimestamp(key: string): string | undefined {
    return this._timestamps.get(key);
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  // Add a method to get all entries as a Record
  getAllEntries(): Record<string, T> {
    const entries: Record<string, T> = {};
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
        const cacheData = JSON.parse(data);

        for (const [key, value] of Object.entries(cacheData)) {
          this._memoryCache.set(key, value as T);
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

  private _timestamps: Map<string, string> = new Map();

  set(key: string, value: T, timestamp?: string): void {
    this._memoryCache.set(key, value);
    if (timestamp) {
      this._timestamps.set(key, timestamp);
    }
  }

  getTimestamp(key: string): string | undefined {
    return this._timestamps.get(key);
  }

  has(key: string): boolean {
    return this._memoryCache.has(key);
  }
}

// Helper function to create hash keys for caching
export function createHashKey(args: unknown[]): string {
  const stringifiedArgs = JSON.stringify(args);
  // Using SHA-256 instead of MD5 for better security
  return crypto.createHash("sha256").update(stringifiedArgs).digest("hex");
}

// Function decorator for caching
export function cached<T, TArgs extends unknown[]>(cache: Cache<T>, fn: (...args: TArgs) => T): (...args: TArgs) => T {
  return (...args: TArgs): T => {
    const key = createHashKey(args);

    if (cache.has(key)) {
      const cachedResult = cache.get(key);
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
