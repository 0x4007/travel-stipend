import fs from "fs";
import path from "path";

// Helper function to check if a timestamp is within six hours
export function isWithinSixHours(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  const sixHoursInMs = 6 * 60 * 60 * 1000;
  return now.getTime() - date.getTime() < sixHoursInMs;
}

interface MemoryCache<T> {
  [key: string]: {
    value: T;
    timestamp: number;
  };
}

class CacheStore<T> {
  private _entries: MemoryCache<T> = {};

  set(key: string, value: T): void {
    this._entries[key] = {
      value,
      timestamp: Date.now(),
    };
  }

  get(key: string): T | null {
    const entry = this._entries[key];
    return entry ? entry.value : null;
  }

  getAllEntries(): MemoryCache<T> {
    return this._entries;
  }
}

export class PersistentCache<T> {
  private _memoryCache: CacheStore<T>;
  private _filePath: string;

  constructor(filePath: string) {
    this._memoryCache = new CacheStore<T>();
    this._filePath = filePath;
    this._createCacheDir();
    this._loadFromDisk();
  }

  private _createCacheDir(): void {
    const dir = path.dirname(this._filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private _loadFromDisk(): void {
    try {
      if (fs.existsSync(this._filePath)) {
        const data = fs.readFileSync(this._filePath, 'utf-8');
        const cache = JSON.parse(data) as MemoryCache<T>;

        // Load entries into memory cache
        Object.entries(cache).forEach(([key, entry]) => {
          this._memoryCache.set(key, entry.value);
        });
      }
    } catch (error) {
      console.error(`Error loading cache from ${this._filePath}:`, error);
    }
  }

  get(key: string): T | null {
    return this._memoryCache.get(key);
  }

  set(key: string, value: T): void {
    this._memoryCache.set(key, value);
  }

  getAllEntries(): MemoryCache<T> {
    return this._memoryCache.getAllEntries();
  }

  saveToDisk(): void {
    try {
      // Get all entries from the memory cache
      const cacheObject = this._memoryCache.getAllEntries();

      // Create cache directory if it doesn't exist
      this._createCacheDir();

      // Write to disk
      fs.writeFileSync(this._filePath, JSON.stringify(cacheObject, null, 2));
    } catch (error) {
      console.error(`Error saving cache to ${this._filePath}:`, error);
    }
  }
}

export function createHashKey(parts: (string | number | undefined)[]): string {
  return parts.map(part => String(part ?? '')).join('|');
}
