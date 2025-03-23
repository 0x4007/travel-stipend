import { AmadeusApi } from "../utils/amadeus-api";
import { FlightDates, FlightPriceResult, FlightPricingStrategy } from "./flight-pricing-strategy";

export class AmadeusStrategy implements FlightPricingStrategy {
  private _api: AmadeusApi | null = null;
  private _filterMajorCarriersOnly: boolean;

  constructor(filterMajorCarriersOnly = true) {
    this._filterMajorCarriersOnly = filterMajorCarriersOnly;
  }

  private async _getApi(): Promise<AmadeusApi> {
    if (!this._api) {
      // Get the API key and secret from environment variables
      // Bun automatically imports .env files
      const apiKey = process.env.AMADEUS_API_KEY;
      const apiSecret = process.env.AMADEUS_API_SECRET;

      if (!apiKey || !apiSecret) {
        console.warn("Amadeus API credentials not found in environment variables");
        throw new Error("Missing Amadeus API credentials");
      }

      this._api = new AmadeusApi(apiKey, apiSecret, this._filterMajorCarriersOnly);
    }
    return this._api;
  }

  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    try {
      // Extract city or airport codes
      const originCity = origin.split(",")[0].trim();
      const destCity = destination.split(",")[0].trim();

      // Extract airport codes if available
      const api = await this._getApi();

      console.log(`[AmadeusStrategy] Searching flights from ${originCity} to ${destCity}`);
      console.log(`[AmadeusStrategy] Dates: ${dates.outbound} to ${dates.return}`);

      const results = await api.searchFlights(
        originCity,
        destCity,
        dates.outbound,
        dates.return
      );

      if (results.success && results.price !== null) {
        return {
          price: results.price,
          source: results.source || "Amadeus API"
        };
      }

      return {
        price: 0,
        source: "No results found"
      };
    } catch (error) {
      console.error("[AmadeusStrategy] Error:", error);
      // Don't rethrow, just return with price 0
      return {
        price: 0,
        source: "Error"
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if environment variables are set
      const apiKey = process.env.AMADEUS_API_KEY;
      const apiSecret = process.env.AMADEUS_API_SECRET;

      // Log the environment variables for debugging
      if (!apiKey || !apiSecret) {
        console.log("Amadeus API credentials not set in environment variables");
      } else {
        console.log("Amadeus API credentials found in environment variables");
      }

      return !!(apiKey && apiSecret);
    } catch (error) {
      console.error("[AmadeusStrategy] Not available:", error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up for API-based strategy
    this._api = null;
  }
}
