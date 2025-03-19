import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

/**
 * Scrapes flight prices from the Google Flights results page
 * @param page Puppeteer page object
 * @returns Array of prices found on the page
 */
export async function scrapeFlightPrices(page: Page): Promise<number[]> {
  log(LOG_LEVEL.INFO, "Scraping flight prices from results page");

  // Take screenshot of the results page

  try {
    // Wait for results to load
    log(LOG_LEVEL.DEBUG, "Waiting for flight results to load");
    await page.waitForSelector("body", { timeout: 10000 });

    // Use generic text search approach to find prices
    log(LOG_LEVEL.INFO, "Using generic text search to find prices");

    // Extract all text from the page
    const pageText = await page.evaluate(() => document.body.innerText);

    // Look for price patterns in the text (e.g., $123, $1,234)
    const priceRegex = /\$\s?(\d{1,3}(,\d{3})*(\.\d{2})?)/g;
    const matches = [...pageText.matchAll(priceRegex)];

    if (matches.length > 0) {
      log(LOG_LEVEL.INFO, `Found ${matches.length} prices using text search`);

      // Extract prices from regex matches
      const prices = matches.map(match => {
        // Remove $ and commas, then convert to number
        const priceText = match[1].replace(/,/g, "");
        return parseFloat(priceText);
      });

      return prices;
    }

    log(LOG_LEVEL.WARN, "No prices found using text search");
    return [];
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error scraping flight prices:", error);
    return [];
  }
}
