// Common interfaces used across the application

export interface FlightResults {
  best_flights: FlightOption[];
  search_metadata?: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_flights_url: string;
    raw_html_file: string;
    prettify_html_file: string;
    total_time_taken: number;
  };
  search_parameters?: {
    engine: string;
    hl: string;
    gl: string;
    type: string;
    departure_id: string;
    arrival_id: string;
    outbound_date: string;
    return_date: string;
    travel_class: number;
    adults: number;
    stops: number;
    currency: string;
    deep_search: boolean;
    sort_by: string;
  };
  other_flights?: FlightOption[];
  price_insights?: PriceInsights;
  airports?: AirportPair[];
}

export interface Conference {
  Category: string;
  Start: string;
  End: string;
  Conference: string;
  Location: string;
  "Ticket Price"?: string;
  "❗️"?: string;
  "❓"?: string;
  Description?: string;
}

export interface AirportCode {
  type: string;
  name: string;
  municipality: string;
  iata_code: string;
  coordinates: string; // Format: "lat,lng" as string from CSV
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface StipendBreakdown {
  conference: string;
  location: string;
  conference_start: string;
  conference_end: string;
  flight_departure: string;
  flight_return: string;
  flight_cost: number;
  lodging_cost: number;
  basic_meals_cost: number;
  business_entertainment_cost: number;
  local_transport_cost: number;
  ticket_price: number;
  total_stipend: number;
}

export interface Airport {
  name: string;
  id: string;
  time: string;
}

export interface Flight {
  departure_airport: Airport;
  arrival_airport: Airport;
  duration: number;
  airplane: string;
  airline: string;
  airline_logo: string;
  travel_class: string;
  flight_number: string;
  legroom: string;
  extensions: string[];
  overnight?: boolean;
  ticket_also_sold_by?: string[];
}

export interface Layover {
  duration: number;
  name: string;
  id: string;
  overnight?: boolean;
}

export interface CarbonEmissions {
  this_flight: number;
  typical_for_this_route: number;
  difference_percent: number;
}

export interface FlightOption {
  flights: Flight[];
  layovers: Layover[];
  total_duration: number;
  carbon_emissions: CarbonEmissions;
  price?: number;
  type: string;
  airline_logo: string;
  departure_token: string;
}

export interface PriceInsights {
  lowest_price: number;
  price_level: string;
  typical_price_range: number[];
}

export interface AirportInfo {
  airport: {
    id: string;
    name: string;
  };
  city: string;
  country: string;
  country_code: string;
  image: string;
  thumbnail: string;
}

export interface AirportPair {
  departure: AirportInfo[];
  arrival: AirportInfo[];
}
