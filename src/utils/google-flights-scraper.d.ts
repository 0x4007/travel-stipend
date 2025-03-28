declare module "../utils/google-flights-scraper" {
  import { Page } from "puppeteer";

  export class GoogleFlightsScraper {
    constructor(options?: { headless?: boolean });
    changeCurrencyToUsd(): Promise<void>;
    searchFlights(origin: string, destination: string, dates: { depart: string; return?: string }): Promise<FlightSearchResult>;
    scrapeFlightPrices(page: Page): Promise<FlightPrice[]>;
  }

  interface FlightSearchResult {
    prices: FlightPrice[];
    airlines: string[];
  }

  interface FlightPrice {
    price: number;
    airline: string;
    isTopFlight: boolean;
  }
}
