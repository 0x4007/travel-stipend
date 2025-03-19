import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

/**
 * Flight data structure containing detailed information about a flight
 */
interface FlightData {
  price: number;
  airline: null | string;
  departureTime: null | string;
  arrivalTime: null | string;
  duration: null | string;
  stops: number;
  origin: null | string;
  destination: null | string;
  isTopFlight: boolean;
}

export async function scrapeFlightPrices(page: Page): Promise<FlightData[]> {
  log(LOG_LEVEL.INFO, "Scraping flight prices and details from results page");

  try {
    // Wait for results to load
    log(LOG_LEVEL.DEBUG, "Waiting for flight results to load");
    await page.waitForSelector("body", { timeout: 10000 });

    // Extract flight data using DOM selectors
    const flights = await page.evaluate(() => {
      const flightData: FlightData[] = [];

      // Helper function to extract price from aria-label
      function extractPrice(element: Element | null): number {
        if (!element) return -1;
        const ariaLabel = element.getAttribute("aria-label");
        if (!ariaLabel) return -1;

        // Extract price from aria-label like "250 US dollars"
        // Using a simple approach to avoid regex backtracking issues
        const parts = ariaLabel.split(" ");
        for (let i = 0; i < parts.length - 2; i++) {
          if (parts[i + 1] === "US" && parts[i + 2] === "dollars") {
            const price = parseInt(parts[i], 10);
            if (!isNaN(price)) {
              return price;
            }
          }
        }
        return -1;
      }

      // Helper function to extract text content safely
      function getText(element: Element | null): null | string {
        return element?.textContent?.trim() ?? null;
      }

      // Helper functions to extract specific flight details
      function extractAirline(flightElement: Element): null | string {
        const airlineElements = flightElement.querySelectorAll("div > div > div > div > div > span:not([aria-label])");
        for (const el of Array.from(airlineElements)) {
          const text = getText(el);
          if (text && !text.includes("Nonstop") && !text.includes("stop") && !text.includes("hr") && !text.includes("min")) {
            return text;
          }
        }
        return null;
      }

      function extractTimes(flightElement: Element): { departureTime: null | string; arrivalTime: null | string } {
        const timeElements = flightElement.querySelectorAll('span[aria-label^="Departure time"], span[aria-label^="Arrival time"]');
        let departureTime = null;
        let arrivalTime = null;

        if (timeElements.length >= 2) {
          departureTime = getText(timeElements[0]);
          arrivalTime = getText(timeElements[1]);
        }

        return { departureTime, arrivalTime };
      }

      function extractDuration(flightElement: Element): null | string {
        const durationElement = flightElement.querySelector('div[aria-label^="Total duration"]');
        return durationElement ? (durationElement.getAttribute("aria-label")?.replace("Total duration ", "") ?? null) : null;
      }

      function extractStops(flightElement: Element): number {
        const stopsElement = flightElement.querySelector('span[aria-label="Nonstop flight."], span[aria-label$="stop flight."]');
        if (!stopsElement) return -1;

        const stopsText = stopsElement.getAttribute("aria-label") ?? null;
        if (!stopsText) return -1;
        if (stopsText.includes("Nonstop")) return -1;

        // Using a simple approach to avoid regex backtracking issues
        const parts = stopsText.split(" ");
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i + 1] === "stop" || parts[i + 1] === "stops") {
            const numStops = parseInt(parts[i], 10);
            if (!isNaN(numStops)) {
              return numStops;
            }
          }
        }
        return -1;
      }

      function extractAirports(flightElement: Element): { origin: string | null; destination: string | null } {
        // Target the QylvBf class which contains the airport codes
        const airportElements = flightElement.querySelectorAll('.QylvBf span[aria-label=""]');
        let origin = null;
        let destination = null;

        if (airportElements.length >= 2) {
          origin = getText(airportElements[0]);
          destination = getText(airportElements[1]);
        }

        return { origin, destination };
      }

      // Main function to extract flight details
      function extractFlightDetails(flightElement: Element): FlightData | null {
        // Skip "View more flights" button if present
        if (flightElement.querySelector('button[aria-label="View more flights"]')) {
          return null;
        }

        // Extract price
        const priceElement = flightElement.querySelector('span[aria-label$="US dollars"]');
        const price = extractPrice(priceElement);

        // Skip if no price found
        if (price === 0) return null;

        // Extract other details
        const airline = extractAirline(flightElement);
        const { departureTime, arrivalTime } = extractTimes(flightElement);
        const duration = extractDuration(flightElement);
        const stops = extractStops(flightElement);
        const { origin, destination } = extractAirports(flightElement);

        return {
          price,
          airline,
          departureTime,
          arrivalTime,
          duration,
          stops,
          origin,
          destination,
          isTopFlight: false, // Will be set by the caller
        };
      }

      // Process flight elements in a section
      function processFlightElements(elements: NodeListOf<Element>, isTopFlight: boolean) {
        elements.forEach((flightElement) => {
          const flightDetails = extractFlightDetails(flightElement);
          if (flightDetails) {
            flightDetails.isTopFlight = isTopFlight;
            flightData.push(flightDetails);
          }
        });
      }

      // Find and process top flights
      const topFlightsHeader = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent?.includes("Top departing flights"));
      if (topFlightsHeader) {
        const topFlightsSection = topFlightsHeader.closest("div")?.parentElement;
        if (topFlightsSection) {
          const topFlightElements = topFlightsSection.querySelectorAll("ul > li");
          processFlightElements(topFlightElements, true);
        }
      }

      // Find and process other flights
      const otherFlightsHeader = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent?.includes("Other departing flights"));
      if (otherFlightsHeader) {
        const otherFlightsSection = otherFlightsHeader.closest("div")?.parentElement;
        if (otherFlightsSection) {
          const otherFlightElements = otherFlightsSection.querySelectorAll("ul > li");
          processFlightElements(otherFlightElements, false);
        }
      }

      return flightData;
    });

    // Log results
    if (flights.length > 0) {
      const topFlights = flights.filter((f) => f.isTopFlight);
      const otherFlights = flights.filter((f) => !f.isTopFlight);

      log(LOG_LEVEL.INFO, `Found ${flights.length} flights (${topFlights.length} top flights, ${otherFlights.length} other flights)`);

      // Return all flight data
      return flights;
    }

    log(LOG_LEVEL.WARN, "No flights found on the page");
    return [];
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error scraping flight prices:", error);
    return [];
  }
}

/**
 * Extracts just the prices from flight data
 * @param flightData Array of flight data objects
 * @returns Array of prices
 */
export function extractPricesFromFlightData(flightData: FlightData[]): number[] {
  return flightData.map((flight) => flight.price);
}
