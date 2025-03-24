// Default conference duration in days (if no end date is specified)
export const DEFAULT_CONFERENCE_DAYS = 1;

// Fuzzy matching threshold for conference names (0.0 to 1.0)
export const SIMILARITY_THRESHOLD = 0.6;

// Default flight cost per kilometer (in USD)
export const COST_PER_KM = 0.15;

// Cost below which we'll warn about potentially unrealistic flight prices
export const MIN_FLIGHT_COST = 100;

// Default values (in USD)
export const DEFAULT_TICKET_PRICE = 1000;  // Conference ticket
export const DEFAULT_HOTEL_COST = 150;     // Hotel per night
export const DEFAULT_DAILY_MEALS = 65;     // Food per day
export const DEFAULT_DAILY_TRANSPORT = 35; // Local transport per day
export const DEFAULT_DAILY_INCIDENTALS = 25; // Incidentals per day
export const BUSINESS_ENTERTAINMENT_PER_DAY = 50; // Business entertainment allowance

// Aliases for backward compatibility
export const DEFAULT_CONFERENCE_TICKET = DEFAULT_TICKET_PRICE;
export const BASE_LOCAL_TRANSPORT_PER_DAY = DEFAULT_DAILY_TRANSPORT;
export const BASE_MEALS_PER_DAY = DEFAULT_DAILY_MEALS;
export const BASE_LODGING_PER_DAY = DEFAULT_HOTEL_COST;
export const BASE_LODGING_PER_NIGHT = DEFAULT_HOTEL_COST;
export const INCIDENTALS_PER_DAY = DEFAULT_DAILY_INCIDENTALS;
export const DEFAULT_DAILY_FOOD = DEFAULT_DAILY_MEALS;

// Additional days around conference
export const ARRIVAL_DAYS_BEFORE = 1;
export const DEPARTURE_DAYS_AFTER = 1;

// More aliases for backward compatibility
export const PRE_CONFERENCE_DAYS = ARRIVAL_DAYS_BEFORE;
export const POST_CONFERENCE_DAYS = DEPARTURE_DAYS_AFTER;

// Default cost of living index
export const DEFAULT_COST_OF_LIVING_INDEX = 100;

// Cost adjustments
export const INTERNATIONAL_FLIGHT_BUFFER = 1.2; // 20% buffer for international flights
export const INTERNATIONAL_INTERNET_ALLOWANCE = 15; // Daily allowance for international internet
export const WEEKEND_RATE_MULTIPLIER = 1.25; // 25% premium for weekend rates
