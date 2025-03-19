import { Browser, Page } from "puppeteer";
import { closeBrowser, initializeBrowser } from "./browser-setup";
import { LOG_LEVEL } from "./config";
import { changeCurrencyToUsd } from "./currency-handler";
import { searchFlights } from "./flight-search";
import { log } from "./log";
import { navigateToGoogleFlights } from "./navigation";
import { BrowserInitOptions, FlightSearchResult } from "./types";

// Re-export types and constants
export { CURRENT_LOG_LEVEL, LOG_LEVEL } from "./config";
export { BrowserInitOptions, FlightSearchResult } from "./types";

// Main scraper class
export class GoogleFlightsScraper {
  private _browser: Browser | null = null;
  private _page: Page | null = null;

  constructor() {
    log(LOG_LEVEL.INFO, "Initializing Google Flights Scraper");
  }

  async initialize(options: BrowserInitOptions = { headless: false }): Promise<void> {
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

  async searchFlights(from: string, to: string, departureDate: string, returnDate?: string): Promise<FlightSearchResult> {
    if (!this._page) throw new Error("Page not initialized");
    return await searchFlights(this._page, from, to, departureDate, returnDate);
  }

  async close(): Promise<void> {
    if (this._browser) {
      await closeBrowser(this._browser);
      this._browser = null;
      this._page = null;
    }
  }
}
