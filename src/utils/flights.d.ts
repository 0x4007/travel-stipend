import { Conference } from "../types";

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
