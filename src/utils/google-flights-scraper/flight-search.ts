import { Page } from "puppeteer";
import { FlightSearchResult } from "../types";
import { LOG_LEVEL } from "./config";
import { selectDates } from "./date-selection-handler";
import { fillDestinationField, fillOriginField } from "./form-field-handler";
import { log } from "./log";
import { clickSearchButton } from "./search-button-handler";
import { takeScreenshot } from "./take-screenshot";

export async function searchFlights(page: Page, from: string, to: string, departureDate: string, returnDate?: string): Promise<FlightSearchResult> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, `Searching flights from ${from} to ${to}`);
  const dateInfo = `Departure date: ${departureDate}`;
  const returnInfo = returnDate ? `, Return date: ${returnDate}` : "";
  log(LOG_LEVEL.INFO, dateInfo + returnInfo);

  // Take initial screenshot
  await takeScreenshot(page, "before-search");

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
    await takeScreenshot(page, "after-date-selection");

    // Click the search button to initiate the search
    await clickSearchButton(page);

    // Return a result with empty arrays for now
    // In a real implementation, these would be populated with actual flight data
    return {
      success: true,
      prices: [],
      airlines: [],
      durations: [],
    };
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error searching flights:", error);
    await takeScreenshot(page, "error-searching-flights");
    throw error;
  }
}
