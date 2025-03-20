import { FlightPrice } from "../types";

// Interface matching the FlightData from price-scraper.ts
interface FlightData {
  price: number;
  airlines: string[]; // Array of airline names
  bookingCaution: null | string;
  departureTime: null | string;
  arrivalTime: null | string;
  duration: null | string;
  stops: number;
  origin: null | string;
  destination: null | string;
  isTopFlight: boolean;
}

/**
 * Maps raw flight data from the scraper to the FlightPrice interface
 * @param flightData Array of raw flight data from the scraper
 * @returns Array of FlightPrice objects
 */
export function mapFlightDataToFlightPrices(flightData: FlightData[]): FlightPrice[] {
  return flightData.map(flight => {
    // Join multiple airlines with a + symbol if there are multiple
    const airline = flight.airlines.length > 0
      ? flight.airlines.join(' + ')
      : 'Unknown Airline';

    return {
      price: flight.price,
      airline,
      departureTime: flight.departureTime ?? 'Unknown',
      arrivalTime: flight.arrivalTime ?? 'Unknown',
      duration: flight.duration ?? 'Unknown',
      stops: flight.stops >= 0 ? flight.stops : 0,
      origin: flight.origin ?? 'Unknown',
      destination: flight.destination ?? 'Unknown',
      isTopFlight: flight.isTopFlight
    };
  });
}
