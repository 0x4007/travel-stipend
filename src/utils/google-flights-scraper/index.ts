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
  private _cache: PersistentCache<{ price: number; timestamp: string; source: string; url?: string; selectedDestination?: string }>;

  async needsFreshData(searches: Array<{ from: string; to: string; departureDate: string; returnDate?: string }>): Promise<boolean> {
    for (const search of searches) {
      const cacheKey = this._createCacheKey(search.from, search.to, search.departureDate, search.returnDate);
      const { shouldFetch } = this._checkCache(cacheKey);
      if (shouldFetch) return true;
    }
    return false;
  }

  constructor(trainingMode = false) {
    log(LOG_LEVEL.INFO, "Initializing Google Flights Scraper");
    this._cache = new PersistentCache<{ price: number; timestamp: string; source: string; url?: string; selectedDestination?: string }>(
      "fixtures/cache/google-flights-cache.json",
      trainingMode
    );
  }

  setTrainingMode(enabled: boolean): void {
    this._cache.setTrainingMode(enabled);
  }

  private _createCacheKey(from: string, to: string, departureDate: string, returnDate?: string): string {
    return createHashKey([from, to, departureDate, returnDate ?? "", "google-flights-v1"]);
  }

  private _checkCache(cacheKey: string): { shouldFetch: boolean; cachedResult?: { success: boolean; price: number; source: string; searchUrl?: string } } {
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
        cachedResult: {
          success: true,
          price: cachedData.price,
          source: cachedData.source,
          searchUrl: cachedData.url,
        },
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

  async searchFlights(from: string, to: string, departureDate: string, returnDate?: string, takeScreenshots = false) {
    const cacheKey = this._createCacheKey(from, to, departureDate, returnDate);
    const { shouldFetch, cachedResult } = this._checkCache(cacheKey);

    if (!shouldFetch && cachedResult) {
      log(LOG_LEVEL.INFO, `Using cached result for ${from} to ${to}`);
      return cachedResult;
    }

    if (!this._page) throw new Error("Page not initialized");
    const result = await searchFlights(this._page, from, to, departureDate, returnDate, takeScreenshots);

    if (result.success && result.prices.length > 0) {
      // Calculate average price from only top flights, excluding outliers
      const topFlights = result.prices.filter((price) => price.isTopFlight);

      if (topFlights.length === 0) {
        // Fallback if no top flights
        const avgPrice = result.prices.length > 0
          ? Math.round(result.prices.reduce((sum, price) => sum + price.price, 0) / result.prices.length)
          : 0;

        // Store in cache with URL and destination verification
        log(LOG_LEVEL.INFO, `Storing result in cache with key: ${cacheKey}`);
        this._cache.set(cacheKey, {
          price: avgPrice,
          timestamp: new Date().toISOString(),
          source: "Google Flights",
          url: result.searchUrl,
          selectedDestination: result.selectedDestination,
        });
        // Save cache to disk
        this._cache.saveToDisk();
        log(LOG_LEVEL.INFO, "Cache entry created and saved to disk");

        return {
          success: true,
          price: avgPrice,
          source: "Google Flights",
          prices: result.prices,
          searchUrl: result.searchUrl,
          screenshotPath: result.screenshotPath,
          selectedDestination: result.selectedDestination,
          allianceFiltersApplied: result.allianceFiltersApplied,
        };
      }

      // Use all top flights without filtering for outliers
      const avgPrice = topFlights.length > 0
        ? Math.round(topFlights.reduce((sum, flight) => sum + flight.price, 0) / topFlights.length)
        : 0;

      log(LOG_LEVEL.INFO, `Using average price of ${avgPrice} from ${topFlights.length} top flights`);

      // Store in cache with URL and destination verification
      log(LOG_LEVEL.INFO, `Storing result in cache with key: ${cacheKey}`);
      this._cache.set(cacheKey, {
        price: avgPrice,
        timestamp: new Date().toISOString(),
        source: "Google Flights",
        url: result.searchUrl,
        selectedDestination: result.selectedDestination,
      });
      // Save cache to disk
      this._cache.saveToDisk();
      log(LOG_LEVEL.INFO, "Cache entry created and saved to disk");

      return {
        success: true,
        price: avgPrice,
        source: "Google Flights",
        prices: result.prices,
        searchUrl: result.searchUrl,
        screenshotPath: result.screenshotPath,
        selectedDestination: result.selectedDestination,
        allianceFiltersApplied: result.allianceFiltersApplied,
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
