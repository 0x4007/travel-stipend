import { Page } from "puppeteer";
import { FlightSearchResult } from "../types";
import { LOG_LEVEL } from "./config";
import { selectDates } from "./date-selection-handler";
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

    // Wait for results to load
    log(LOG_LEVEL.INFO, "Waiting for results to load");

    // Scrape flight prices from the results page
    const prices = await scrapeFlightPrices(page);
    log(LOG_LEVEL.INFO, `Found ${prices.length} flight prices`);

    // Return the flight search results
    return {
      success: true,
      prices: prices,
    };
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error searching flights:", error);

    throw error;
  }
}
