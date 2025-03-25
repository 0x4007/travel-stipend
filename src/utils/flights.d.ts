import { Conference } from "../types";

declare module "src/utils/flights" {
  export function calculateFlightCost(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate: string
  ): Promise<number>;

  export function scrapeFlightPrice(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate: string
  ): Promise<number>;

  export function findUpcomingConferences(): Promise<Conference[]>;
  export function getRegion(location: string): string;
  export function extractAirportCode(location: string): string;
}
