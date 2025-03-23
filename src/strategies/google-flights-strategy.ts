import { GoogleFlightsScraper } from "../utils/google-flights-scraper";
import { FlightPrice } from "../utils/google-flights-scraper/types";
import { FlightDates, FlightPriceResult, FlightPricingStrategy } from "./flight-pricing-strategy";

export class GoogleFlightsStrategy implements FlightPricingStrategy {
  private _scraper: GoogleFlightsScraper | null = null;

  private async _initializeScraper(): Promise<void> {
    if (!this._scraper) {
      this._scraper = new GoogleFlightsScraper();
      await this._scraper.initialize({ headless: true });
      await this._scraper.navigateToGoogleFlights();
      await this._scraper.changeCurrencyToUsd();
    }
  }

  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    try {
      await this._initializeScraper();

      if (!this._scraper) {
        throw new Error("Failed to initialize Google Flights scraper");
      }

      console.log(`[GoogleFlightsStrategy] Searching flights from ${origin} to ${destination}`);
      console.log(`[GoogleFlightsStrategy] Dates: ${dates.outbound} to ${dates.return}`);

      const results = await this._scraper.searchFlights(origin, destination, dates.outbound, dates.return);

      if (results.success && 'prices' in results && results.prices.length > 0) {
        // Calculate average from top flights or all flights if no top flights
        const topFlights = results.prices.filter((flight: FlightPrice) => flight.isTopFlight);
        const flightsToUse = topFlights.length > 0 ? topFlights : results.prices;

        const avgPrice = Math.round(
          flightsToUse.reduce((sum: number, flight: FlightPrice) => sum + flight.price, 0) / flightsToUse.length
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
      // Check if puppeteer can be initialized - this indicates if we can run a browser
      await this._initializeScraper();
      return true;
    } catch (error) {
      console.error("[GoogleFlightsStrategy] Not available:", error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this._scraper) {
      await this._scraper.close();
      this._scraper = null;
    }
  }
}
