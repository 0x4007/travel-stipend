import { config } from "dotenv";
import { Browser, LaunchOptions, Page } from "puppeteer";
import {
  attemptSessionRecovery,
  enhancedScreenshot,
  getBrowserLaunchArgs,
  handleError,
  setupEnvironment,
  withRetry,
} from "../../scripts/github-action-dispatcher";
// Import original functions without logCallback assumption
import { launchBrowser, navigateToFlights, scrapeFlightPrices } from "./google-flights";

// Load environment variables
config();

// Import LogCallback type
import { LogCallback } from "../types";

// Note: calculateFlightCost is a higher-level function, not directly involved in detailed scraping logs
export async function calculateFlightCost(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  includeBudget: boolean = false
): Promise<number> {
  // This function doesn't receive or pass logCallback
  const result = await scrapeFlightPrice(
    origin,
    destination,
    {
      outbound: departureDate,
      return: returnDate,
    },
    includeBudget
  );
  return result.price ?? 0;
}

async function handleScreenshot(page: Page, description: string, options: Record<string, boolean> = {}) {
  const env = setupEnvironment();
  if (env.screenshotMode !== "disabled") {
    await enhancedScreenshot(page, description, options);
  }
}

// Add logCallback parameter back
async function handleNavigation(
  page: Page,
  parameters: {
    from: string;
    to: string;
    departureDate: string;
    returnDate: string;
    includeBudget: boolean;
  },
  logCallback?: LogCallback // Added callback back
) {
  logCallback?.("Attempting navigation to Google Flights..."); // Log start
  const didNavigate = await withRetry(async () => {
    logCallback?.("Calling navigateToFlights (submodule)...");
    // Call original function (no callback passed into submodule)
    await navigateToFlights(page, parameters);
    logCallback?.("navigateToFlights (submodule) finished.");
    return true;
  });

  if (!didNavigate) {
     logCallback?.(`ERROR: Failed to navigate after retries.`);
    throw new Error("Failed to navigate to Google Flights and perform initial setup/scrape");
  }
   logCallback?.(`Navigation successful.`);

  await new Promise((resolve) => setTimeout(resolve, 2000)); // Keep delay
}

// Add logCallback parameter back
async function handleFlightScraping(page: Page, logCallback?: LogCallback) {
  logCallback?.("Attempting to scrape flight prices...");
  return await withRetry(async () => {
    try {
      logCallback?.("Calling scrapeFlightPrices (submodule)...");
      // Call original function (no callback passed into submodule)
      const results = await scrapeFlightPrices(page);
      logCallback?.(`scrapeFlightPrices (submodule) finished. Found ${results?.length ?? 0} results.`);
      return results;
    } catch (error) {
      logCallback?.(`Scraping attempt failed, attempting recovery... Error: ${error instanceof Error ? error.message : error}`);
      const isRecovered = await attemptSessionRecovery(page);
      if (!isRecovered) {
         logCallback?.(`ERROR: Session recovery failed.`);
        throw error;
      }
      logCallback?.("Session recovered, retrying scrape...");
      // Call original function (no callback passed into submodule)
      const results = await scrapeFlightPrices(page);
      logCallback?.(`scrapeFlightPrices (submodule) retry finished. Found ${results?.length ?? 0} results.`);
      return results;
    }
  });
}

// Add logCallback parameter back and use it in helpers
export async function scrapeFlightPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string },
  includeBudget: boolean = false,
  logCallback?: LogCallback // Added callback back
): Promise<{ price: number | null; source: string }> {
  const startMsg = `Looking up flight prices on Google Flights (${origin} -> ${destination})...`;
  console.log(startMsg); // Keep console log
  logCallback?.(startMsg); // Log start message

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logCallback?.("Launching browser..."); // Log before launch
    const launchOptions: LaunchOptions = {
      args: getBrowserLaunchArgs(),
      timeout: setupEnvironment().timeout,
      headless: true,
    };

    browser = await launchBrowser(launchOptions);
    logCallback?.("Browser launched."); // Log after launch
    page = await browser.newPage();
    logCallback?.("New page created."); // Log after page creation

    const parameters = {
      from: origin,
      to: destination,
      departureDate: dates.outbound,
      returnDate: dates.return,
      includeBudget,
    };
    logCallback?.(`Parameters set: ${JSON.stringify(parameters)}`);

    await handleScreenshot(page, "initial-state", { fullPage: true });
    await handleScreenshot(page, "pre-navigation", { fullPage: true });

    // Call updated handleNavigation (with callback)
    await handleNavigation(page, parameters, logCallback);
    await handleScreenshot(page, "post-navigation", { fullPage: true, captureHtml: true });

    // Call updated handleFlightScraping (with callback)
    // This contains the workaround call to scrapeFlightPrices again
    const flightData = await handleFlightScraping(page, logCallback);

    if (!flightData?.length) {
      const noResultsMsg = `No flight results found for ${destination}.`;
      console.error(noResultsMsg);
      logCallback?.(`WARNING: ${noResultsMsg}`); // Log warning
      await handleScreenshot(page, "no-results-error", {
        fullPage: true, captureHtml: true, logDOM: true, dumpConsole: true,
      });
      return { price: null, source: "No flight results found" };
    }
    // Log moved inside handleFlightScraping

    console.log("Flight data:", JSON.stringify(flightData, null, 2)); // Keep console log

    // Calculate price
    logCallback?.("Calculating average price...");
    const topFlights = flightData.filter((flight) => flight.isTopFlight);
    const flightsToUse = topFlights.length > 0 ? topFlights : flightData;
    const avgPrice = Math.round(flightsToUse.reduce((sum, flight) => sum + flight.price, 0) / flightsToUse.length);
    logCallback?.(`Average price calculated: ${avgPrice}`); // Log completion

    await handleScreenshot(page, "successful-scrape", { fullPage: true });

    return {
      price: avgPrice,
      source: "Google Flights",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logCallback?.(`ERROR during flight lookup: ${errorMsg}`); // Log error
    if (page) {
      await handleError(page, error instanceof Error ? error : new Error(errorMsg), "flight-scraping");
    }
    return {
      price: null,
      source: `Google Flights error: ${errorMsg}`,
    };
  } finally {
    logCallback?.("Closing browser..."); // Log before close
    if (browser) {
      await browser.close();
      logCallback?.("Browser closed."); // Log after close
    }
  }
}
