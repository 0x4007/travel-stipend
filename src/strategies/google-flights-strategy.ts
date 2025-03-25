import { Page } from "puppeteer";
import { navigateToFlights } from "../utils/google-flights-scraper/src/google-flights/page-navigation";
import { scrapeFlightPrices } from "../utils/google-flights-scraper/src/google-flights/scrape/scrape-flight-prices";
import { launchBrowser } from "../utils/google-flights-scraper/src/utils/launch";
import { FlightDates, FlightPriceResult, FlightPricingStrategy } from "./flight-pricing-strategy";

export class GoogleFlightsStrategy implements FlightPricingStrategy {
  private _browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  private _page: Page | null = null;

  private async _initializeBrowser(): Promise<void> {
    if (!this._browser) {
      this._browser = await launchBrowser();
      this._page = await this._browser.newPage();
    }
  }

  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    try {
      await this._initializeBrowser();
      if (!this._page) {
        throw new Error("Failed to initialize browser page");
      }

      console.log(`[GoogleFlightsStrategy] Searching flights from ${origin} to ${destination}`);
      console.log(`[GoogleFlightsStrategy] Dates: ${dates.outbound} to ${dates.return}`);

      // Set up flight search parameters
      const parameters = {
        from: origin,
        to: destination,
        departureDate: dates.outbound,
        returnDate: dates.return,
        includeBudget: true
      };

      // Navigate to Google Flights and perform search
      await navigateToFlights(this._page, parameters);

      // Scrape flight prices
      const flightData = await scrapeFlightPrices(this._page);

      if (flightData.length > 0) {
        // Calculate average from top flights or all flights if no top flights
        const topFlights = flightData.filter(flight => flight.isTopFlight);
        const flightsToUse = topFlights.length > 0 ? topFlights : flightData;

        const avgPrice = Math.round(
          flightsToUse.reduce((sum, flight) => sum + flight.price, 0) / flightsToUse.length
        );

        return {
          price: avgPrice,
          source: "Google Flights"
        };
      }

      return {
        price: 0,
        source: "Google Flights (No results)"
      };
    } catch (error) {
      console.error("[GoogleFlightsStrategy] Error:", error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if browser can be launched
      await this._initializeBrowser();
      return true;
    } catch (error) {
      console.error("[GoogleFlightsStrategy] Not available:", error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
      this._page = null;
    }
  }
}
