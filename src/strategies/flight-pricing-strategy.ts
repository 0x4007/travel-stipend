export interface FlightDates {
  outbound: string;
  return: string;
}

export interface FlightPriceResult {
  price: number;
  source: string;
}

export interface FlightPricingStrategy {
  /**
   * Get the flight price between origin and destination
   *
   * @param origin The origin city
   * @param destination The destination city
   * @param dates The departure and return dates
   * @returns Promise with the flight price and source
   */
  getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult>;

  /**
   * Check if this strategy is available for use
   *
   * @returns Promise that resolves to true if strategy can be used
   */
  isAvailable(): Promise<boolean>;

  /**
   * Clean up any resources used by the strategy
   */
  cleanup(): Promise<void>;
}

export interface FlightPricingContext {
  /**
   * Set the strategy to use for flight pricing
   *
   * @param strategy The strategy to use
   */
  setStrategy(strategy: FlightPricingStrategy): void;

  /**
   * Get the flight price using the current strategy
   *
   * @param origin The origin city
   * @param destination The destination city
   * @param dates The departure and return dates
   * @returns Promise with the flight price and source
   */
  getFlightPrice(
    origin: string,
    destination: string,
    dates: FlightDates
  ): Promise<FlightPriceResult>;
}
