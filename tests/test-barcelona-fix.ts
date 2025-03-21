import { ORIGIN } from "../src/utils/constants";
import { loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");

// Test the current behavior
console.log("Current behavior:");
console.log("-----------------");
try {
  const distance = getDistanceKmFromCities(ORIGIN, "Barcelona", coordinates);
  console.log(`Distance from ${ORIGIN} to Barcelona: ${Math.round(distance)} km (matches Barcelona, Philippines)`);
} catch (error) {
  console.log(`Error: ${(error as Error).message}`);
}

// Proposed fix: Always use country-qualified city names for important cities
console.log("\nProposed fix:");
console.log("-------------");
try {
  const distance = getDistanceKmFromCities(ORIGIN, "Barcelona, Spain", coordinates);
  console.log(`Distance from ${ORIGIN} to Barcelona, Spain: ${Math.round(distance)} km`);
} catch (error) {
  console.log(`Error: ${(error as Error).message}`);
}

// Explanation of the issue
console.log("\nExplanation:");
console.log("------------");
console.log("The issue is that there are multiple cities named 'Barcelona' in the coordinates database:");
console.log("1. Barcelona, Philippines (lat: 12.8694, lng: 124.1419) - Distance from Seoul: ~2760 km");
console.log("2. Barcelona, Spain (lat: 41.3828, lng: 2.1769) - Distance from Seoul: ~9603 km");
console.log("3. Barcelona, Venezuela (lat: 10.1403, lng: -64.6833) - Distance from Seoul: ~14573 km");
console.log("\nWhen using just 'Barcelona' without a country, the system matches with Barcelona, Philippines");
console.log("because it appears first in the coordinates database when loading city names.");
console.log("\nTo ensure consistent results, always use country-qualified city names (e.g., 'Barcelona, Spain')");
console.log("for cities that exist in multiple countries.");
