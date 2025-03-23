import { FlightDates, FlightPriceResult, FlightPricingStrategy } from "./flight-pricing-strategy";
import { AmadeusStrategy } from "./amadeus-strategy";
import { DistanceBasedStrategy } from "./distance-based-strategy";

// Airport code mapping for major cities
const CITY_TO_AIRPORT_CODE: Record<string, string> = {
  "seoul": "ICN", // Incheon International Airport
  "barcelona": "BCN", // Barcelona El Prat Airport
  "new york": "JFK", // John F. Kennedy International Airport
  "tokyo": "HND", // Tokyo Haneda Airport
  "paris": "CDG", // Charles de Gaulle Airport
  "london": "LHR", // London Heathrow Airport
  "singapore": "SIN", // Singapore Changi Airport
  "dubai": "DXB", // Dubai International Airport
  "san francisco": "SFO", // San Francisco International Airport
  "los angeles": "LAX"  // Los Angeles International Airport
};

/**
 * ImprovedHybridStrategy combines Amadeus API and distance-based calculation
 * with improved handling of price discrepancies
 */
interface AmadeusResult {
  success: boolean;
  price: number | null;
  source?: string;
  prices?: Array<{
    airline: string;
    price: number;
  }>;
}

/**
 * ImprovedHybridStrategy combines Amadeus API and distance-based calculation
 * with improved handling of price discrepancies
 */
export class ImprovedHybridStrategy implements FlightPricingStrategy {
  private _amadeusStrategy: AmadeusStrategy;
  private _distanceStrategy: DistanceBasedStrategy;
  private _maxPriceDiscrepancyPercent: number;
  private _useLowestAmadeusPrices: boolean;

  constructor(
    maxPriceDiscrepancyPercent: number = 30,
    useLowestAmadeusPrices: boolean = true,
    filterMajorCarriersOnly: boolean = false
  ) {
    this._amadeusStrategy = new AmadeusStrategy(filterMajorCarriersOnly);
    this._distanceStrategy = new DistanceBasedStrategy();
    this._maxPriceDiscrepancyPercent = maxPriceDiscrepancyPercent;
    this._useLowestAmadeusPrices = useLowestAmadeusPrices;
  }

  /**
   * Check if origin and destination are the same location
   */
  private _isSameLocation(origin: string, destination: string): boolean {
    return origin.toLowerCase() === destination.toLowerCase();
  }

  /**
   * Convert city name to airport code
   */
  private _getCityAirportCode(cityName: string): string | null {
    // Extract just the city name without country
    const city = cityName.split(",")[0].trim().toLowerCase();

    // Check if we have a direct mapping
    if (city in CITY_TO_AIRPORT_CODE) {
      console.log(`[ImprovedHybridStrategy] Found airport code for ${city}: ${CITY_TO_AIRPORT_CODE[city]}`);
      return CITY_TO_AIRPORT_CODE[city];
    }

    // Check if any part of the input matches our known cities
    for (const [knownCity, code] of Object.entries(CITY_TO_AIRPORT_CODE)) {
      if (city.includes(knownCity) || knownCity.includes(city)) {
        console.log(`[ImprovedHybridStrategy] Found partial match for ${city}: ${code}`);
        return code;
      }
    }

    console.log(`[ImprovedHybridStrategy] No airport code found for ${city}`);
    return null;
  }

  /**
   * Process the Amadeus API result
   */
  private _processAmadeusResult(rawResult: AmadeusResult): {
    result: FlightPriceResult | null;
    lowestPrice: number | null;
  } {
    if (!rawResult.success || !rawResult.price) {
      return { result: null, lowestPrice: null };
    }

    // Log standard Amadeus price
    console.log(`[ImprovedHybridStrategy] Amadeus average price: $${rawResult.price}`);

    // Default to the average price
    let lowestPrice = rawResult.price;

    // Extract and log flight options if available
    if (rawResult.prices && rawResult.prices.length > 0) {
      lowestPrice = this._extractAndLogFlightOptions(rawResult.prices);
    }

    // Determine which price to use
    return this._determineAmadeusPrice(rawResult.price, lowestPrice, rawResult.source);
  }

  /**
   * Extract and log flight options from Amadeus result
   */
  private _extractAndLogFlightOptions(prices: Array<{ airline: string; price: number }>): number {
    // Sort prices from lowest to highest
    const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
    const lowestPrice = sortedPrices[0].price;

    console.log(`[ImprovedHybridStrategy] Amadeus lowest price: $${lowestPrice}`);

    // List top 3 cheapest flights for debugging
    console.log("[ImprovedHybridStrategy] Top 3 cheapest flights:");
    sortedPrices.slice(0, Math.min(3, sortedPrices.length)).forEach((flight, index) => {
      console.log(`  ${index + 1}. ${flight.airline}: $${flight.price}`);
    });

    return lowestPrice;
  }

  /**
   * Determine which Amadeus price to use (lowest or average)
   */
  private _determineAmadeusPrice(
    averagePrice: number,
    lowestPrice: number,
    source?: string
  ): { result: FlightPriceResult; lowestPrice: number } {
    if (this._useLowestAmadeusPrices && lowestPrice < averagePrice) {
      console.log(`[ImprovedHybridStrategy] Using lowest price ($${lowestPrice}) instead of average ($${averagePrice})`);
      return {
        result: {
          price: lowestPrice,
          source: "Amadeus API (lowest price)"
        },
        lowestPrice
      };
    } else {
      return {
        result: {
          price: averagePrice,
          source: source ?? "Amadeus API"
        },
        lowestPrice
      };
    }
  }

  /**
   * Try to get a price from Amadeus API
   */
  private async _getAmadeusPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<{ result: FlightPriceResult | null; error: Error | null; lowestPrice?: number | null }> {
    try {
      const isAvailable = await this._amadeusStrategy.isAvailable();
      if (!isAvailable) {
        console.log("[ImprovedHybridStrategy] Amadeus API not available");
        return { result: null, error: null };
      }

      // Get API instance and convert city names to airport codes
      const api = await this._amadeusStrategy['_getApi']();
      const originCode = this._getCityAirportCode(origin);
      const destCode = this._getCityAirportCode(destination);

      // If we don't have airport codes, fall back to standard strategy
      if (!originCode || !destCode) {
        console.log(`[ImprovedHybridStrategy] Missing airport code for ${!originCode ? origin : destination}`);
        const result = await this._amadeusStrategy.getFlightPrice(origin, destination, dates);
        return { result, error: null };
      }

      // Use direct API call with airport codes
      console.log(`[ImprovedHybridStrategy] Using airport codes: ${originCode} to ${destCode}`);
      const rawResult = await api.searchFlights(originCode, destCode, dates.outbound, dates.return);

      // Process the API result
      const processed = this._processAmadeusResult(rawResult);

      if (processed.result) {
        return {
          result: processed.result,
          error: null,
          lowestPrice: processed.lowestPrice
        };
      }

      // If direct API call failed, try standard approach as fallback
      console.log("[ImprovedHybridStrategy] Direct API call failed, trying standard approach");
      const result = await this._amadeusStrategy.getFlightPrice(origin, destination, dates);
      console.log(`[ImprovedHybridStrategy] Standard approach result: $${result.price}`);
      return { result, error: null, lowestPrice: null };
    } catch (err) {
      console.error("[ImprovedHybridStrategy] Amadeus error:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      return { result: null, error, lowestPrice: null };
    }
  }

  /**
   * Try to get a price from distance-based calculation
   */
  private async _getDistancePrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<{ result: FlightPriceResult | null; error: Error | null }> {
    try {
      const result = await this._distanceStrategy.getFlightPrice(origin, destination, dates);
      console.log(`[ImprovedHybridStrategy] Distance-based price: $${result.price}`);
      return { result, error: null };
    } catch (err) {
      console.error("[ImprovedHybridStrategy] Distance-based error:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      return { result: null, error };
    }
  }

  /**
   * Determine if prices have a significant discrepancy
   */
  private _hasPriceDiscrepancy(price1: number, price2: number): boolean {
    if (price1 === 0 || price2 === 0) return false;

    const higherPrice = Math.max(price1, price2);
    const lowerPrice = Math.min(price1, price2);
    const percentDifference = ((higherPrice - lowerPrice) / lowerPrice) * 100;

    const hasDiscrepancy = percentDifference > this._maxPriceDiscrepancyPercent;
    if (hasDiscrepancy) {
      console.log(`[ImprovedHybridStrategy] Price discrepancy detected: ${percentDifference.toFixed(1)}% difference`);
    }
    return hasDiscrepancy;
  }

  /**
   * Choose the most appropriate price based on available data
   */
  private _choosePrice(
    amadeusResult: FlightPriceResult | null,
    distanceResult: FlightPriceResult | null,
    lowestAmadeusPrice: number | null | undefined
  ): FlightPriceResult {
    // If we only have one result, use it
    if (amadeusResult && !distanceResult) {
      console.log("[ImprovedHybridStrategy] Using Amadeus price only");
      return amadeusResult;
    }

    if (!amadeusResult && distanceResult) {
      console.log("[ImprovedHybridStrategy] Using distance-based price only");
      return distanceResult;
    }

    // If we have both results, check for discrepancy
    if (amadeusResult && distanceResult) {
      const amadeusPrice = amadeusResult.price;
      const distancePrice = distanceResult.price;

      if (this._hasPriceDiscrepancy(amadeusPrice, distancePrice)) {
        // If there's a significant discrepancy, use the lower price
        if (amadeusPrice < distancePrice) {
          console.log("[ImprovedHybridStrategy] Using lower Amadeus price due to discrepancy");
          return amadeusResult;
        } else {
          console.log("[ImprovedHybridStrategy] Using lower distance-based price due to discrepancy");
          return distanceResult;
        }
      }

      // If we have a lowest Amadeus price that's lower than the distance-based price
      if (lowestAmadeusPrice && lowestAmadeusPrice < distancePrice) {
        console.log(`[ImprovedHybridStrategy] Using lowest Amadeus price: $${lowestAmadeusPrice}`);
        return {
          price: lowestAmadeusPrice,
          source: "Amadeus API (lowest price)"
        };
      }

      // No significant discrepancy, calculate average
      const avgPrice = Math.round((amadeusPrice + distancePrice) / 2);
      console.log(`[ImprovedHybridStrategy] Using average price: $${avgPrice}`);
      return {
        price: avgPrice,
        source: "Hybrid (Amadeus + Distance average)"
      };
    }

    // If we don't have any results (should never happen, but just in case)
    throw new Error("No pricing data available from any source");
  }

  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    try {
      // Check if destination is the same as origin
      if (this._isSameLocation(origin, destination)) {
        console.log(`[ImprovedHybridStrategy] Origin and destination are the same (${origin}), no flight needed`);
        return {
          price: 0,
          source: "Hybrid (Same location)"
        };
      }

      console.log(`[ImprovedHybridStrategy] Calculating flight price from ${origin} to ${destination}`);

      // Get prices from both strategies
      const { result: amadeusResult, lowestPrice: lowestAmadeusPrice } =
        await this._getAmadeusPrice(origin, destination, dates);
      const { result: distanceResult } =
        await this._getDistancePrice(origin, destination, dates);

      // Choose the most appropriate price
      return this._choosePrice(amadeusResult, distanceResult, lowestAmadeusPrice);
    } catch (error) {
      console.error("[ImprovedHybridStrategy] Error:", error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    // Hybrid strategy is available if at least distance-based strategy is available
    // (which should always be the case)
    return await this._distanceStrategy.isAvailable();
  }

  async cleanup(): Promise<void> {
    // Clean up both strategies
    await this._amadeusStrategy.cleanup();
    await this._distanceStrategy.cleanup();
  }
}
