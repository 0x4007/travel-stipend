// Configuration Constants used across the application

// Fixed origin for travel (for example, your home base)
export const ORIGIN = "Seoul, Korea";

// Cost-per-kilometer rate (USD per km)
export const COST_PER_KM = 0.2; // round trip

// Base rates for accommodation and daily expenses at baseline cost-of-living
export const BASE_LODGING_PER_NIGHT = 220; // USD (adjusted based on global average)
export const BASE_MEALS_PER_DAY = 75; // USD (adjusted for average costs)
export const BASE_LOCAL_TRANSPORT_PER_DAY = 35; // USD (increased based on analysis of actual spending)

// New allowance categories
export const INTERNATIONAL_INTERNET_ALLOWANCE = 25; // USD for international data plans
export const INCIDENTALS_PER_DAY = 20; // USD for miscellaneous business expenses

// Business-specific allowances
export const BUSINESS_ENTERTAINMENT_PER_DAY = 100; // USD (for business dinners and networking events)
// Removed BUSINESS_DISTRICT_MULTIPLIER as base rate now includes business district premium

// Travel duration adjustments
export const PRE_CONFERENCE_DAYS = 1; // Days before conference to cover
export const POST_CONFERENCE_DAYS = 1; // Days after conference to cover

// Default ticket price when not provided
export const DEFAULT_TICKET_PRICE = 1000; // USD

// Minimum similarity score to consider a match for fuzzy matching
export const SIMILARITY_THRESHOLD = 0.6;

// Default number of days for conference duration if not specified
export const DEFAULT_CONFERENCE_DAYS = 2;

// Default departure airport code (Seoul Incheon)
export const DEFAULT_DEPARTURE_AIRPORT = "ICN";

// Weekend vs Weekday adjustments
export const WEEKEND_RATE_MULTIPLIER = 0.85; // 15% discount for weekend stays
