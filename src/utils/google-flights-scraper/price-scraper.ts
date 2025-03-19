import { ElementHandle, Page } from "puppeteer";
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

    // Wait for price elements to appear
    // Try multiple possible selectors for price elements
    const possiblePriceSelectors = [
      // Common Google Flights price selectors
      '[aria-label*="$"]',
      '[aria-label*="USD"]',
      'div[role="row"] div[role="cell"]:last-child',
      'div.gws-flights-results__price',
      'div.gws-flights-results__itinerary-price',
      'div[data-test-id="price"]',
      // Add more potential selectors
    ];

    log(LOG_LEVEL.DEBUG, "Looking for price elements with multiple selectors");

    // Try each selector
    // Using ElementHandle from Puppeteer for the elements
    let priceElements: ElementHandle<Element>[] = [];
    for (const selector of possiblePriceSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          log(LOG_LEVEL.INFO, `Found ${elements.length} price elements with selector: ${selector}`);
          priceElements = elements;
          break;
        }
      } catch {
        log(LOG_LEVEL.DEBUG, `No price elements found with selector: ${selector}`);
      }
    }

    // If no price elements found with specific selectors, try a more generic approach
    if (priceElements.length === 0) {
      log(LOG_LEVEL.WARN, "No price elements found with specific selectors, trying generic text search");

      // Extract all text from the page
      const pageText = await page.evaluate(() => document.body.innerText);

      // Take screenshot for debugging


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

      log(LOG_LEVEL.WARN, "No prices found using text search either");
      return [];
    }

    // Extract prices from elements
    const prices: number[] = [];

    for (const element of priceElements) {
      try {
        // Get text content of the element
        const priceText = await element.evaluate((el: Element) => el.textContent ?? "");

        // Extract numeric value from price text (e.g., "$123" -> 123)
        const priceMatch = priceText.match(/\$?\s?(\d{1,3}(,\d{3})*(\.\d{2})?)/);

        if (priceMatch?.[1]) {
          // Remove commas and convert to number
          const price = parseFloat(priceMatch[1].replace(/,/g, ""));
          if (!isNaN(price)) {
            prices.push(price);
            log(LOG_LEVEL.DEBUG, `Extracted price: ${price}`);
          }
        }
      } catch (error) {
        log(LOG_LEVEL.ERROR, "Error extracting price from element:", error);
      }
    }

    log(LOG_LEVEL.INFO, `Successfully extracted ${prices.length} prices`);


    return prices;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error scraping flight prices:", error);

    return [];
  }
}
