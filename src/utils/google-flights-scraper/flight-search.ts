import { Page } from "puppeteer";
import { FlightPrice, FlightSearchResult } from "../types";
import { applyAllianceFilters } from "./alliance-filter-handler";
import { LOG_LEVEL } from "./config";
import { selectDates } from "./date-selection-handler";
import { fillDestinationField, fillOriginField } from "./form-field-handler";
import { log } from "./log";
import { scrapeFlightPrices } from "./price-scraper";
import { takeScreenshot } from "./screenshot-handler";
import { clickSearchButton } from "./search-button-handler";

export async function searchFlights(page: Page, from: string, to: string, departureDate: string, returnDate?: string, takeScreenshots = false): Promise<FlightSearchResult> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, `Searching flights from ${from} to ${to}`);
  const dateInfo = `Departure date: ${departureDate}`;
  const returnInfo = returnDate ? `, Return date: ${returnDate}` : "";
  log(LOG_LEVEL.INFO, dateInfo + returnInfo);

  try {
    // Wait for the page to be fully loaded
    log(LOG_LEVEL.DEBUG, "Waiting for page to be fully loaded");
    await page.waitForSelector("body", { timeout: 10000 });

    // Find and fill origin field
    await fillOriginField(page, from);

    // Find and fill destination field
    const destinationResult = await fillDestinationField(page, to);

    // Verify destination was selected correctly
    if (!destinationResult.success) {
      log(LOG_LEVEL.ERROR, `Destination mismatch! Expected: ${to}, Got: ${destinationResult.selectedDestination}`);
      throw new Error(`Destination mismatch! Expected: ${to}, Got: ${destinationResult.selectedDestination}`);
    }

    log(LOG_LEVEL.INFO, `Verified destination: ${destinationResult.selectedDestination}`);

    // Select dates in the calendar
    await selectDates(page, departureDate, returnDate);

    // Click the search button to initiate the search
    await clickSearchButton(page);

    // Apply alliance filters with retries
    let isAllianceFiltersApplied = false;
    const maxFilterRetries = 3;

    for (let attempt = 0; attempt < maxFilterRetries; attempt++) {
      isAllianceFiltersApplied = await applyAllianceFilters(page);
      if (isAllianceFiltersApplied) {
        log(LOG_LEVEL.INFO, "Alliance filters applied successfully");
        break;
      }

      if (attempt < maxFilterRetries - 1) {
        log(LOG_LEVEL.WARN, `Alliance filters failed to apply (attempt ${attempt + 1}/${maxFilterRetries}), retrying...`);
        // Refresh the page and wait before retrying
        await page.reload();
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Re-apply previous steps
        await fillOriginField(page, from);
        await fillDestinationField(page, to);
        await selectDates(page, departureDate, returnDate);
        await clickSearchButton(page);
      } else {
        throw new Error("Failed to apply alliance filters after maximum retries");
      }
    }

    // Take verification screenshot if enabled (after ensuring filters are applied)
    let screenshotPath = "";
    if (takeScreenshots) {
      screenshotPath = await takeScreenshot(page, to, "verification");
      log(LOG_LEVEL.INFO, `Verification screenshot saved to: ${screenshotPath}`);
    }

    // Wait for results to load
    log(LOG_LEVEL.INFO, "Waiting for results to load");

    // Get the current URL after search is complete
    const searchUrl = page.url();

    // Scrape flight prices from the results page
    const flightData = await scrapeFlightPrices(page);
    const prices: FlightPrice[] = flightData.map(flight => ({
      price: flight.price,
      airline: flight.airlines.join("/") ?? "Unknown",
      departureTime: flight.departureTime ?? "Unknown",
      arrivalTime: flight.arrivalTime ?? "Unknown",
      duration: flight.duration ?? "Unknown",
      stops: flight.stops,
      origin: flight.origin ?? "Unknown",
      destination: flight.destination ?? "Unknown",
      isTopFlight: flight.isTopFlight
    }));
    log(LOG_LEVEL.INFO, `Found ${prices.length} flight prices`);

    // Return the flight search results with search URL and screenshot path
    return {
      success: true,
      prices,
      searchUrl,
      screenshotPath: screenshotPath !== "" ? screenshotPath : undefined,
      selectedDestination: destinationResult.selectedDestination ?? undefined,
      allianceFiltersApplied: isAllianceFiltersApplied
    };
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error searching flights:", error instanceof Error ? error.message : String(error));

    throw error;
  }
}
