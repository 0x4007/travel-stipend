import { config } from "dotenv";
import { Page } from "puppeteer";
import { launchBrowser, navigateToFlights, scrapeFlightPrices } from "./google-flights";

// Load environment variables
config();

// Initialize flight cache

export async function calculateFlightCost(origin: string, destination: string, departureDate: string, returnDate: string): Promise<number> {
  const result = await scrapeFlightPrice(origin, destination, {
    outbound: departureDate,
    return: returnDate,
  });
  return result.price ?? 0;
}

export async function scrapeFlightPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  console.log(`Scraping flight prices from ${origin} to ${destination}`);
  console.log(`Dates: ${dates.outbound} to ${dates.return}`);

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  let page: Page | null = null;

  try {
    browser = await launchBrowser();
    page = await browser.newPage();

    // Set up flight search parameters
    const parameters = {
      from: origin,
      to: destination,
      departureDate: dates.outbound,
      returnDate: dates.return,
      includeBudget: true,
    };

    // Log parameters for debugging
    console.log("Flight search parameters:", {
      from: parameters.from,
      to: parameters.to,
      departureDate: parameters.departureDate,
      returnDate: parameters.returnDate,
    });

    // Navigate to Google Flights and perform search
    await navigateToFlights(page, parameters);

    // Add a delay to ensure the page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scrape flight prices
    const flightData = await scrapeFlightPrices(page);

    if (!flightData.length) {
      console.error(`No flight results found for ${destination}`);
      return {
        price: null,
        source: "No flight results found",
      };
    }

    // Calculate average from top flights or all flights if no top flights
    const topFlights = flightData.filter((flight) => flight.isTopFlight);
    const flightsToUse = topFlights.length > 0 ? topFlights : flightData;

    const avgPrice = Math.round(flightsToUse.reduce((sum, flight) => sum + flight.price, 0) / flightsToUse.length);

    return {
      price: avgPrice,
      source: "Google Flights",
    };
  } catch (error) {
    console.error("Error scraping Google Flights:", error);
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
