import { Page } from "puppeteer";
import { validateDestination } from "../destination-validator";
import { applyAllianceFilters } from "./alliance-filter-handler";
import { LOG_LEVEL } from "./config";
import { selectDates } from "./date-selection-handler";
import { fillDestinationField, fillOriginField } from "./form-field-handler";
import { log } from "./log";
import { scrapeFlightPrices } from "./price-scraper";
import { takeScreenshot } from "./screenshot-handler";
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

export async function searchFlights(page: Page, from: string, to: string, departureDate: string, returnDate?: string, takeScreenshots = false): Promise<FlightSearchResult> {
  if (!page) throw new Error("Page not initialized");

  // Validate destination
  const validation = await validateDestination(to);
  if (!validation.isValid) {
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

    // Fill form fields
    await fillOriginField(page, from);
    const destinationResult = await fillDestinationField(page, validatedDestination);

    if (!destinationResult.success) {
      throw new Error(`Destination mismatch! Expected: ${validatedDestination}, Got: ${destinationResult.selectedDestination}`);
    }

    // Complete search form
    await selectDates(page, departureDate, returnDate);
    await clickSearchButton(page);

    // Apply filters
    const isAllianceFiltersApplied = await applyFiltersWithRetries(
      page,
      from,
      validatedDestination,
      departureDate,
      returnDate
    );

    // Handle screenshots
    const screenshotPath = takeScreenshots
      ? await takeScreenshot(page, validatedDestination, "verification")
      : "";

    // Get results
    const searchUrl = page.url();
    const flightData = await scrapeFlightPrices(page);
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

    throw error;
  }
}
