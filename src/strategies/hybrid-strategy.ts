import { FlightDates, FlightPriceResult, FlightPricingStrategy } from "./flight-pricing-strategy";
import { AmadeusStrategy } from "./amadeus-strategy";
import { DistanceBasedStrategy } from "./distance-based-strategy";

/**
 * HybridStrategy combines Amadeus API and distance-based calculation
 * This is suitable for batch processing where Google Flights scraping would be too slow
 */
export class HybridStrategy implements FlightPricingStrategy {
  private _amadeusStrategy: AmadeusStrategy;
  private _distanceStrategy: DistanceBasedStrategy;

  constructor() {
    this._amadeusStrategy = new AmadeusStrategy();
    this._distanceStrategy = new DistanceBasedStrategy();
  }

  /**
   * Check if origin and destination are the same location
   */
  private _isSameLocation(origin: string, destination: string): boolean {
    return origin.toLowerCase() === destination.toLowerCase();
  }

  /**
   * Try to get a price from Amadeus API
   */
  private async _getAmadeusPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<{ result: FlightPriceResult | null; error: Error | null }> {
    try {
      const isAvailable = await this._amadeusStrategy.isAvailable();
      if (!isAvailable) {
        console.log("[HybridStrategy] Amadeus API not available");
        return { result: null, error: null };
      }

      const result = await this._amadeusStrategy.getFlightPrice(origin, destination, dates);
      console.log(`[HybridStrategy] Amadeus price: $${result.price}`);
      return { result, error: null };
    } catch (err) {
      console.error("[HybridStrategy] Amadeus error:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      return { result: null, error };
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
      console.log(`[HybridStrategy] Distance-based price: $${result.price}`);
      return { result, error: null };
    } catch (err) {
      console.error("[HybridStrategy] Distance-based error:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      return { result: null, error };
    }
  }

  /**
   * Calculate the average price from Amadeus and distance-based results
   */
  private _calculateAveragePrice(
    amadeusResult: FlightPriceResult,
    distanceResult: FlightPriceResult
  ): FlightPriceResult {
    const avgPrice = Math.round((amadeusResult.price + distanceResult.price) / 2);
    console.log(`[HybridStrategy] Using average price: $${avgPrice}`);
    return {
      price: avgPrice,
      source: "Hybrid (Amadeus + Distance average)"
    };
  }

  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    try {
      // Check if destination is the same as origin
      if (this._isSameLocation(origin, destination)) {
        console.log(`[HybridStrategy] Origin and destination are the same (${origin}), no flight needed`);
        return {
          price: 0,
          source: "Hybrid (Same location)"
        };
      }

      console.log(`[HybridStrategy] Calculating flight price from ${origin} to ${destination}`);

      // Get prices from both strategies
      const { result: amadeusResult, error: amadeusError } = await this._getAmadeusPrice(origin, destination, dates);
      const { result: distanceResult, error: distanceError } = await this._getDistancePrice(origin, destination, dates);

      // Determine final result based on what we got
      if (amadeusResult && distanceResult) {
        return this._calculateAveragePrice(amadeusResult, distanceResult);
      } else if (amadeusResult) {
        console.log("[HybridStrategy] Using Amadeus price only");
        return amadeusResult;
      } else if (distanceResult) {
        console.log("[HybridStrategy] Using distance-based price only");
        return distanceResult;
      }

      // If we get here, both strategies failed
      throw amadeusError || distanceError || new Error("Both pricing strategies failed");
    } catch (error) {
      console.error("[HybridStrategy] Error:", error);
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
