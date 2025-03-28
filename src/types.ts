export interface Conference {
  id?: number;
  category: string;
  start_date: string;
  end_date?: string; // Optional: defaults to start_date if not provided
  conference: string;
  location: string;
  ticket_price?: string; // Optional: defaults to DEFAULT_TICKET_PRICE if not provided
  description?: string;

  // Optional buffer days for more precise travel planning
  buffer_days_before?: number; // Days to arrive before conference (default: 1)
  buffer_days_after?: number; // Days to stay after conference (default: 1)

  // For travel stipend calculations
  origin?: string; // Added during calculations
  includeBudget?: boolean; // Whether to include budget airlines in flight search
}

export interface MealCosts {
  basicMealsCost: number;
  businessEntertainmentCost: number;
}

export interface FlightResults {
  best_flights: Array<{
    price: number;
    airline: string;
    flight_number: string;
    departure_airport: string;
    arrival_airport: string;
    departure_time: string;
    arrival_time: string;
  }>;
  price_insights: {
    typical_price_range: [number, number];
    price_level: string;
  };
}

export interface StipendBreakdown {
  conference: string;
  origin: string; // Added origin city
  destination: string; // Renamed from location
  conference_start: string;
  conference_end: string;
  flight_departure: string;
  flight_return: string;
  flight_cost: number;
  flight_price_source: string;
  lodging_cost: number;
  basic_meals_cost: number;
  business_entertainment_cost: number;
  local_transport_cost: number;
  ticket_price: number;
  internet_data_allowance: number;
  incidentals_allowance: number;
  total_stipend: number;
  meals_cost: number;
  distance_km?: number;
}

export interface FlightCostCacheEntry {
  origin: string;
  destination: string;
  price: number;
  timestamp: number;
}
