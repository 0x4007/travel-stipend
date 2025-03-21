export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Conference {
  category: string;
  start_date: string;
  end_date: string;
  conference: string;
  location: string;
  ticket_price: string;
  description: string;
}

export interface MealCosts {
  basicMealsCost: number;
  mealsCost: number;
  businessEntertainmentCost: number;
}

export interface StipendBreakdown {
  conference: string;
  location: string;
  conference_start: string;
  conference_end: string;
  flight_departure: string;
  flight_return: string;
  distance_km: number;
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
}
