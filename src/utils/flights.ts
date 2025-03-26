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
import { launchBrowser, navigateToFlights, scrapeFlightPrices } from "./google-flights";

// Load environment variables
config();

export async function calculateFlightCost(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  includeBudget: boolean = false
): Promise<number> {
  const result = await scrapeFlightPrice(origin, destination, {
    outbound: departureDate,
    return: returnDate,
  }, includeBudget);
  return result.price ?? 0;
}

async function handleScreenshot(page: Page, description: string, options: Record<string, boolean> = {}) {
  const env = setupEnvironment();
  if (env.screenshotMode !== "disabled") {
    await enhancedScreenshot(page, description, options);
  }
}

async function handleNavigation(page: Page, parameters: {
  from: string;
  to: string;
  departureDate: string;
  returnDate: string;
  includeBudget: boolean;
}) {
  const didNavigate = await withRetry(async () => {
    await navigateToFlights(page, parameters);
    return true;
  });

  if (!didNavigate) {
    throw new Error("Failed to navigate to Google Flights");
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function handleFlightScraping(page: Page) {
  return await withRetry(async () => {
    try {
      return await scrapeFlightPrices(page);
    } catch (error) {
      const isRecovered = await attemptSessionRecovery(page);
      if (!isRecovered) throw error;
      return await scrapeFlightPrices(page);
    }
  });
}

export async function scrapeFlightPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string },
  includeBudget: boolean = false
): Promise<{ price: number | null; source: string }> {
  console.log(`Scraping flight prices from ${origin} to ${destination}`);
  console.log(`Dates: ${dates.outbound} to ${dates.return}`);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser with GitHub Actions specific arguments
    const launchOptions: LaunchOptions = {
      args: getBrowserLaunchArgs(),
      timeout: setupEnvironment().timeout,
      headless: true
    };

    browser = await launchBrowser(launchOptions);
    page = await browser.newPage();

    // Set up flight search parameters
    const parameters = {
      from: origin,
      to: destination,
      departureDate: dates.outbound,
      returnDate: dates.return,
      includeBudget,
    };

    // Log parameters for debugging
    console.log("Flight search parameters:", parameters);

    // Take initial screenshots
    await handleScreenshot(page, "initial-state", { fullPage: true });
    await handleScreenshot(page, "pre-navigation", { fullPage: true });

    // Handle navigation
    await handleNavigation(page, parameters);
    await handleScreenshot(page, "post-navigation", { fullPage: true, captureHtml: true });

    // Handle flight scraping
    const flightData = await handleFlightScraping(page);

    if (!flightData.length) {
      console.error(`No flight results found for ${destination}`);
      await handleScreenshot(page, "no-results-error", {
        fullPage: true,
        captureHtml: true,
        logDOM: true,
        dumpConsole: true
      });
      return { price: null, source: "No flight results found" };
    }

    // Calculate price
    const topFlights = flightData.filter((flight) => flight.isTopFlight);
    const flightsToUse = topFlights.length > 0 ? topFlights : flightData;
    const avgPrice = Math.round(
      flightsToUse.reduce((sum, flight) => sum + flight.price, 0) / flightsToUse.length
    );

    await handleScreenshot(page, "successful-scrape", { fullPage: true });

    return {
      price: avgPrice,
      source: "Google Flights",
    };
  } catch (error) {
    if (page) {
      await handleError(
        page,
        error instanceof Error ? error : new Error(String(error)),
        "flight-scraping"
      );
    }
    return {
      price: null,
      source: error instanceof Error ? error.message : "Google Flights error",
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
