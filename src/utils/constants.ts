// Configuration Constants used across the application

// Fixed origin for travel (for example, your home base)
export const ORIGIN = "Seoul, Korea";

// Cost-per-kilometer rate (USD per km)
export const COST_PER_KM = 0.2; // round trip

// Base rates for lodging (per night) and meals (per day) at baseline cost-of-living
export const BASE_LODGING_PER_NIGHT = 150; // USD
export const BASE_MEALS_PER_DAY = 50; // USD

// Default ticket price when not provided
export const DEFAULT_TICKET_PRICE = 1000; // USD

// Minimum similarity score to consider a match for fuzzy matching
export const SIMILARITY_THRESHOLD = 0.6;

// Default number of days for conference duration if not specified
export const DEFAULT_CONFERENCE_DAYS = 3;

// Default departure airport code (Seoul Incheon)
export const DEFAULT_DEPARTURE_AIRPORT = "ICN";
