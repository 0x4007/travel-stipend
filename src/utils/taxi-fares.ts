import { TRAVEL_STIPEND } from "./constants";
import { DatabaseService } from "./database";

export async function calculateLocalTransportCost(
  city: string,
  numberOfDays: number,
  colFactor: number,
  baseRate = TRAVEL_STIPEND.costs.transport
): Promise<number> {
  try {
    const taxiRates = await DatabaseService.getInstance().getTaxiRates(city);

    if (!taxiRates) {
      // If no taxi data available, use the base rate adjusted for cost of living
      return numberOfDays * baseRate * colFactor;
    }

    // Calculate average trip cost using taxi rates
    const averageTripCost = taxiRates.base_fare + taxiRates.per_km_rate * taxiRates.typical_trip_km;

    // Assume 2 trips per day (to and from conference)
    const dailyCost = averageTripCost * 2;

    // Apply cost of living adjustment
    return numberOfDays * dailyCost * colFactor;
  } catch (error) {
    console.error(`Error calculating local transport cost for ${city}:`, error);
    // Fallback to base rate if there's an error
    return numberOfDays * baseRate * colFactor;
  }
}
