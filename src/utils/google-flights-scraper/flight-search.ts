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

  // Take initial screenshot


  try {
    // Wait for the page to be fully loaded
    log(LOG_LEVEL.DEBUG, "Waiting for page to be fully loaded");
    await page.waitForSelector("body", { timeout: 10000 });

    // Wait a bit for the page to be fully interactive
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    // Find and fill origin field
    await fillOriginField(page, from);

    // Wait for the page to stabilize after selecting origin
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    // Find and fill destination field
    await fillDestinationField(page, to);

    // Wait for the page to stabilize after selecting destination
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    // Select dates in the calendar
    await selectDates(page, departureDate, returnDate);

    // Wait for the page to update after date selection
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));


    // Click the search button to initiate the search
    await clickSearchButton(page);

    // Wait for results page to load
    log(LOG_LEVEL.INFO, "Waiting for results page to load");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {
      log(LOG_LEVEL.WARN, "Navigation timeout, continuing anyway");
    });

    // Wait additional time for results to fully render
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));


    // Scrape flight prices from the results page
    const prices = await scrapeFlightPrices(page);
    log(LOG_LEVEL.INFO, `Found ${prices.length} flight prices`);

    // Return the flight search results
    return {
      success: true,
      prices: prices,
      airlines: [], // To be implemented
      durations: [], // To be implemented
    };
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error searching flights:", error);

    throw error;
  }
}
