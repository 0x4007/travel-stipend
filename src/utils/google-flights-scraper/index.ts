import { Browser, Page } from "puppeteer";
import { createHashKey, isWithinSixHours, PersistentCache } from "../cache";
import { closeBrowser, initializeBrowser } from "./browser-setup";
import { LOG_LEVEL } from "./config";
import { changeCurrencyToUsd } from "./currency-handler";
import { searchFlights } from "./flight-search";
import { log } from "./log";
import { navigateToGoogleFlights } from "./navigation";

// Main scraper class
export class GoogleFlightsScraper {
  private _browser: Browser | null = null;
  private _page: Page | null = null;
  private _cache: PersistentCache<{ price: number; timestamp: string; source: string }>;

  async needsFreshData(searches: Array<{from: string, to: string, departureDate: string, returnDate?: string}>): Promise<boolean> {
    for (const search of searches) {
      const cacheKey = this._createCacheKey(
        search.from,
        search.to,
        search.departureDate,
        search.returnDate
      );
      const {shouldFetch} = this._checkCache(cacheKey);
      if (shouldFetch) return true;
    }
    return false;
  }

  constructor() {
    log(LOG_LEVEL.INFO, "Initializing Google Flights Scraper");
    this._cache = new PersistentCache<{ price: number; timestamp: string; source: string }>("fixtures/cache/google-flights-cache.json");
  }

  private _createCacheKey(from: string, to: string, departureDate: string, returnDate?: string): string {
    return createHashKey([from, to, departureDate, returnDate ?? "", "google-flights-v1"]);
  }

  private _checkCache(cacheKey: string): { shouldFetch: boolean; cachedResult?: { success: boolean; price: number; source: string } } {
    log(LOG_LEVEL.INFO, `Checking cache with key: ${cacheKey}`);
    const cachedData = this._cache.get(cacheKey);

    if (!cachedData) {
      log(LOG_LEVEL.INFO, "No cache entry found, proceeding with scraping");
      return { shouldFetch: true };
    }

    if (isWithinSixHours(cachedData.timestamp)) {
      log(LOG_LEVEL.INFO, `Using cached flight price from ${cachedData.timestamp} (${cachedData.source})`);
      return {
        shouldFetch: false,
        cachedResult: { success: true, price: cachedData.price, source: cachedData.source },
      };
    }

    log(LOG_LEVEL.INFO, `Cached data from ${cachedData.timestamp} is older than 6 hours, fetching new data`);
    return { shouldFetch: true };
  }

  async initialize(options?: { headless: boolean }): Promise<void> {
    const { browser, page } = await initializeBrowser(options);
    this._browser = browser;
    this._page = page;
  }

  async navigateToGoogleFlights(): Promise<void> {
    if (!this._page) throw new Error("Page not initialized");
    await navigateToGoogleFlights(this._page);
  }

  async changeCurrencyToUsd(): Promise<void> {
    if (!this._page) throw new Error("Page not initialized");
    await changeCurrencyToUsd(this._page);
  }

  async searchFlights(from: string, to: string, departureDate: string, returnDate?: string) {
    const cacheKey = this._createCacheKey(from, to, departureDate, returnDate);
    const { shouldFetch, cachedResult } = this._checkCache(cacheKey);

    if (!shouldFetch && cachedResult) {
      return cachedResult;
    }

    if (!this._page) throw new Error("Page not initialized");
    const result = await searchFlights(this._page, from, to, departureDate, returnDate);

    if (result.success && result.prices.length > 0) {
      // Calculate average price from all results
      const avgPrice = Math.round(result.prices.reduce((sum, price) => sum + price.price, 0) / result.prices.length);

      // Store in cache
      log(LOG_LEVEL.INFO, `Storing result in cache with key: ${cacheKey}`);
      this._cache.set(cacheKey, {
        price: avgPrice,
        timestamp: new Date().toISOString(),
        source: "Google Flights",
      });
      // Save cache to disk
      this._cache.saveToDisk();
      log(LOG_LEVEL.INFO, "Cache entry created and saved to disk");

      return {
        success: true,
        price: avgPrice,
        source: "Google Flights",
        prices: result.prices,
      };
    }

    return result;
  }

  async close(): Promise<void> {
    if (this._browser) {
      await closeBrowser(this._browser);
      this._browser = null;
      this._page = null;
    }
  }
}
