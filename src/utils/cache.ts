import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Creates a hash key for caching values based on input parameters
 */
export function createHashKey(values: (string | number | undefined)[]): string {
  const stringValues = values.map((v) => v?.toString() ?? "undefined").join("|");
  return crypto.createHash("sha256").update(stringValues).digest("hex");
}

/**
 * A cache implementation that persists data to disk
 */
export class PersistentCache<T> {
  private _cache: Map<string, T>;
  private _filepath: string;

  constructor(filepath: string) {
    this._filepath = filepath;
    this._cache = new Map<string, T>();
    this._loadFromDisk();
  }

  private _loadFromDisk(): void {
    try {
      if (fs.existsSync(this._filepath)) {
        const data = JSON.parse(fs.readFileSync(this._filepath, "utf-8"));
        this._cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error(`Error loading cache from ${this._filepath}:`, error);
      // Start with empty cache if file can't be loaded
      this._cache = new Map<string, T>();
    }
  }

  public saveToDisk(): void {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this._filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert Map to object for JSON serialization
      const data = Object.fromEntries(this._cache);
      fs.writeFileSync(this._filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error saving cache to ${this._filepath}:`, error);
    }
  }

  public get(key: string): T | undefined {
    return this._cache.get(key);
  }

  public set(key: string, value: T): void {
    this._cache.set(key, value);
  }

  public has(key: string): boolean {
    return this._cache.has(key);
  }

  public clear(): void {
    this._cache.clear();
  }
}
