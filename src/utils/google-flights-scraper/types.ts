export interface FlightPrice {
  price: number;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  origin: string;
  destination: string;
  isTopFlight: boolean;
}

export interface FlightSearchResult {
  success: boolean;
  prices: FlightPrice[];
  searchUrl: string;
  screenshotPath?: string;
  selectedDestination?: string;
  allianceFiltersApplied: boolean;
}
