import { FlightDates, FlightPriceResult, FlightPricingContext, FlightPricingStrategy } from "./flight-pricing-strategy";

/**
 * Context class for flight pricing strategy pattern
 * Allows switching between different strategies for flight pricing
 */
export class FlightPricingContextImpl implements FlightPricingContext {
  private _strategy: FlightPricingStrategy;

  constructor(strategy: FlightPricingStrategy) {
    this._strategy = strategy;
  }

  /**
   * Set a new pricing strategy
   */
  setStrategy(strategy: FlightPricingStrategy): void {
    this._strategy = strategy;
  }

  /**
   * Get flight price using the current strategy
   */
  async getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult> {
    if (!this._strategy) {
      throw new Error("No flight pricing strategy set");
    }

    return this._strategy.getFlightPrice(origin, destination, dates);
  }

  /**
   * Clean up resources used by the current strategy
   */
  async cleanup(): Promise<void> {
    if (this._strategy) {
      await this._strategy.cleanup();
    }
  }

  /**
   * Check if current strategy is available
   */
  async isStrategyAvailable(): Promise<boolean> {
    if (!this._strategy) {
      return false;
    }

    return this._strategy.isAvailable();
  }
}
