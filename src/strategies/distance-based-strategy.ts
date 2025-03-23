import { DatabaseService } from "../utils/database";
import { haversineDistance } from "../utils/distance";
import { calculateFlightCost } from "../utils/flights";
import { FlightDates, FlightPriceResult, FlightPricingStrategy } from "./flight-pricing-strategy";

export class DistanceBasedStrategy implements FlightPricingStrategy {
  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    // Log dates for information, but they're not used in distance calculation
    console.log(`[DistanceBasedStrategy] Dates (unused): ${dates.outbound} to ${dates.return}`);
    try {
      // Check if destination is the same as origin
      if (origin.toLowerCase() === destination.toLowerCase()) {
        console.log(`[DistanceBasedStrategy] Origin and destination are the same (${origin}), no flight needed`);
        return {
          price: 0,
          source: "Distance-based (Same location)"
        };
      }

      console.log(`[DistanceBasedStrategy] Calculating flight cost from ${origin} to ${destination}`);

      // Get coordinates from database
      const originCoords = await DatabaseService.getInstance().getCityCoordinates(origin);
      const destCoords = await DatabaseService.getInstance().getCityCoordinates(destination);

      if (!originCoords.length || !destCoords.length) {
        throw new Error(`Could not find coordinates for ${!originCoords.length ? origin : destination}`);
      }

      // Create coordinates objects
      const originCoord = originCoords[0];
      const destCoord = destCoords[0];

      // Calculate distance directly with haversine
      const distanceKm = haversineDistance(originCoord, destCoord);

      console.log(`[DistanceBasedStrategy] Distance from ${origin} to ${destination}: ${distanceKm.toFixed(1)} km`);

      // Calculate flight cost
      const flightCost = calculateFlightCost(distanceKm, destination, origin);
      console.log(`[DistanceBasedStrategy] Calculated flight cost: $${flightCost}`);

      return {
        price: flightCost,
        source: "Distance-based calculation"
      };
    } catch (error) {
      console.error("[DistanceBasedStrategy] Error:", error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    // This strategy is always available as it uses internal calculations
    return true;
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up for this strategy
  }
}
