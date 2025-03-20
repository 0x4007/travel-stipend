import { Page } from "puppeteer";
import { FlightSearchResult } from "../types";
import { applyAllianceFilters } from "./alliance-filter-handler";
import { LOG_LEVEL } from "./config";
import { selectDates } from "./date-selection-handler";
import { mapFlightDataToFlightPrices } from "./flight-data-mapper";
import { fillDestinationField, fillOriginField } from "./form-field-handler";
import { log } from "./log";
import { scrapeFlightPrices } from "./price-scraper";
import { clickSearchButton } from "./search-button-handler";

export async function searchFlights(page: Page, from: string, to: string, departureDate: string, returnDate?: string): Promise<FlightSearchResult> {
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
    await fillDestinationField(page, to);

    // Select dates in the calendar
    await selectDates(page, departureDate, returnDate);

    // Click the search button to initiate the search
    await clickSearchButton(page);

    // Try to apply alliance filters to show only legitimate airlines
    const isAllianceFiltersApplied = await applyAllianceFilters(page);
    if (isAllianceFiltersApplied) {
      log(LOG_LEVEL.INFO, "Alliance filters applied successfully");
    } else {
      log(LOG_LEVEL.INFO, "Alliance filters were not applied (might not be available for this route)");
    }

    // Wait for results to load
    log(LOG_LEVEL.INFO, "Waiting for results to load");

    // Get the current URL after search is complete
    const searchUrl = page.url();

    // Scrape flight prices from the results page
    const rawPrices = await scrapeFlightPrices(page);
    const prices = mapFlightDataToFlightPrices(rawPrices);
    log(LOG_LEVEL.INFO, `Found ${prices.length} flight prices`);

    // Return the flight search results with search URL
    return {
      success: true,
      prices,
      searchUrl
    };
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error searching flights:", error instanceof Error ? error.message : String(error));

    throw error;
  }
}
