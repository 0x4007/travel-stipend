import { Page } from "puppeteer";
import { validateDestination } from "../destination-validator";
import { applyAllianceFilters } from "./alliance-filter-handler";
import { LOG_LEVEL } from "./config";
import { selectDates } from "./date-selection-handler";
import { fillDestinationField, fillOriginField } from "./form-field-handler";
import { log } from "./log";
import { scrapeFlightPrices } from "./price-scraper";
import { takeDebugScreenshot, takeScreenshot } from "./screenshot-handler";
import { clickSearchButton } from "./search-button-handler";
import { FlightPrice, FlightSearchResult } from "./types";

async function applyFiltersWithRetries(page: Page, from: string, to: string, departureDate: string, returnDate?: string): Promise<boolean> {
  const maxFilterRetries = 3;

  for (let attempt = 0; attempt < maxFilterRetries; attempt++) {
    const isApplied = await applyAllianceFilters(page);
    if (isApplied) {
      log(LOG_LEVEL.INFO, "Alliance filters applied successfully");
      return true;
    }

    if (attempt < maxFilterRetries - 1) {
      log(LOG_LEVEL.WARN, `Alliance filters failed to apply (attempt ${attempt + 1}/${maxFilterRetries}), retrying...`);
      await page.reload();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fillOriginField(page, from);
      await fillDestinationField(page, to);
      await selectDates(page, departureDate, returnDate);
      await clickSearchButton(page);
    }
  }

  throw new Error("Failed to apply alliance filters after maximum retries");
}

export async function searchFlights(page: Page, from: string, to: string, departureDate: string, returnDate?: string, debugMode = false): Promise<FlightSearchResult> {
  if (!page) throw new Error("Page not initialized");

  // Take initial screenshot of the page state
  if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
    await takeDebugScreenshot(page, "initial-page-state", {
      fullPage: true,
      captureHtml: true,
      sequence: 1000
    });
  }

  // Validate destination
  const validation = await validateDestination(to);
  if (!validation.isValid) {
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, `invalid-destination-${to.replace(/\s+/g, "-")}`, {
        fullPage: true,
        captureHtml: true,
        sequence: 1100
      });
    }
    throw new Error(validation.error ?? "Invalid destination");
  }

  const validatedDestination = validation.validatedDestination ?? to;
  log(LOG_LEVEL.INFO, `Searching flights from ${from} to ${validatedDestination}`);

  // Store suggestions for future reference if provided
  if (validation.suggestions?.length) {
    log(LOG_LEVEL.INFO, `Alternative destinations: ${validation.suggestions.join(", ")}`);
  }

  // Handle same origin/destination case
  if (from.toLowerCase() === validatedDestination.toLowerCase()) {
    log(LOG_LEVEL.INFO, "Origin and destination are the same, returning zero price result");
    return {
      success: true,
      prices: [{
        price: 0,
        airline: "N/A",
        departureTime: "N/A",
        arrivalTime: "N/A",
        duration: "0h 0m",
        stops: 0,
        origin: from,
        destination: to,
        isTopFlight: true
      }],
      searchUrl: "https://www.google.com/travel/flights",
      allianceFiltersApplied: true
    };
  }

  const returnDateInfo = returnDate ? `, Return: ${returnDate}` : "";
  log(LOG_LEVEL.INFO, `Departure: ${departureDate}${returnDateInfo}`);

  try {
    await page.waitForSelector("body", { timeout: 10000 });

    // Take screenshot before filling origin
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "before-origin-input", {
        fullPage: true,
        captureHtml: true,
        sequence: 2000
      });
    }

    // Fill form fields
    await fillOriginField(page, from);

    // Take screenshot after filling origin
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "after-origin-input", {
        fullPage: true,
        captureHtml: true,
        sequence: 2100,
        highlightElements: ['input[placeholder*="Where from?"]', 'input[aria-label*="Where from"]']
      });
    }

    // Take screenshot before filling destination
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "before-destination-input", {
        fullPage: true,
        captureHtml: true,
        sequence: 3000
      });
    }

    const destinationResult = await fillDestinationField(page, validatedDestination);

    // Take screenshot after filling destination
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "after-destination-input", {
        fullPage: true,
        captureHtml: true,
        sequence: 3100,
        highlightElements: ['input[placeholder*="Where to?"]', 'input[aria-label*="Where to"]']
      });
    }

    if (!destinationResult.success) {
      throw new Error(`Destination mismatch! Expected: ${validatedDestination}, Got: ${destinationResult.selectedDestination}`);
    }

    // Complete search form
    // Take screenshot before date selection
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "before-date-selection", {
        fullPage: true,
        captureHtml: true,
        sequence: 4000
      });
    }

    await selectDates(page, departureDate, returnDate);

    // Take screenshot after date selection
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "after-date-selection", {
        fullPage: true,
        captureHtml: true,
        sequence: 4100
      });
    }

    // Take screenshot before search button click
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "before-search-button-click", {
        fullPage: true,
        captureHtml: true,
        sequence: 5000,
        highlightElements: ['[role="button"]:has-text("Search")', 'button.gws-flights__search-button', '[aria-label="Search"]']
      });
    }

    await clickSearchButton(page);

    // Take screenshot after search button click
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "after-search-button-click", {
        fullPage: true,
        captureHtml: true,
        sequence: 5100
      });
    }

    // Apply filters
    // Take screenshot before alliance filter application
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "before-alliance-filters", {
        fullPage: true,
        captureHtml: true,
        sequence: 6000
      });
    }

    const isAllianceFiltersApplied = await applyFiltersWithRetries(
      page,
      from,
      validatedDestination,
      departureDate,
      returnDate
    );

    // Take screenshot after alliance filter application
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "after-alliance-filters", {
        fullPage: true,
        captureHtml: true,
        sequence: 6100
      });
    }

    // Handle screenshots
    let screenshotPath = "";

    // If old screenshot style was requested
    if (debugMode === false && process.env.DEBUG_GOOGLE_FLIGHTS !== "true") {
      screenshotPath = await takeScreenshot(page, validatedDestination, "verification");
    } else {
      // Take debug screenshot of results
      const debugResult = await takeDebugScreenshot(page, "flight-search-results", {
        fullPage: true,
        captureHtml: true,
        sequence: 7000
      });
      screenshotPath = debugResult.imagePath;
    }

    // Get results
    const searchUrl = page.url();

    // Take screenshot before price scraping
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "before-price-scraping", {
        fullPage: true,
        captureHtml: true,
        sequence: 8000
      });
    }

    const flightData = await scrapeFlightPrices(page);

    // Take screenshot after price scraping
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, "after-price-scraping", {
        fullPage: true,
        captureHtml: true,
        sequence: 8100
      });
    }
    const prices: FlightPrice[] = flightData.map(flight => ({
      price: flight.price,
      airline: flight.airlines?.join("/") || "Unknown",
      departureTime: flight.departureTime ?? "Unknown",
      arrivalTime: flight.arrivalTime ?? "Unknown",
      duration: flight.duration ?? "Unknown",
      stops: flight.stops,
      origin: flight.origin ?? "Unknown",
      destination: flight.destination ?? "Unknown",
      isTopFlight: flight.isTopFlight
    }));

    return {
      success: true,
      prices,
      searchUrl,
      screenshotPath: screenshotPath || void 0,
      selectedDestination: destinationResult.selectedDestination ?? undefined,
      allianceFiltersApplied: isAllianceFiltersApplied
    };
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error searching flights:", error instanceof Error ? error.message : String(error));

    // Take error screenshot
    if (debugMode || process.env.DEBUG_GOOGLE_FLIGHTS === "true") {
      await takeDebugScreenshot(page, `error-${error instanceof Error ? error.message.substring(0, 30).replace(/[^a-z0-9]/gi, '-') : 'unknown'}`, {
        fullPage: true,
        captureHtml: true,
        dumpConsole: true,
        sequence: 9999
      });
    }

    throw error;
  }
}
