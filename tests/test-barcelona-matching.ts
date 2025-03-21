import { ORIGIN } from "../src/utils/constants";
import { loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");

// Test with different formats of Barcelona
const barcelonaFormats = [
  "Barcelona",
  "Barcelona, Spain",
  "Barcelona, Philippines",
  "Barcelona, Venezuela"
];

console.log(`Origin: ${ORIGIN}`);
console.log("Testing different Barcelona formats:");
console.log("-----------------------------------");

// Test each format
barcelonaFormats.forEach(format => {
  try {
    const distance = getDistanceKmFromCities(ORIGIN, format, coordinates);
    console.log(`Format: "${format}" => Distance: ${Math.round(distance)} km`);
  } catch (error) {
    console.log(`Format: "${format}" => Error: ${(error as Error).message}`);
  }
});

// Test fuzzy matching
console.log("\nTesting fuzzy matching:");
console.log("----------------------");
try {
  const distance = getDistanceKmFromCities(ORIGIN, "Barselona", coordinates);
  console.log(`Format: "Barselona" (misspelled) => Distance: ${Math.round(distance)} km`);
} catch (error) {
  console.log(`Format: "Barselona" (misspelled) => Error: ${(error as Error).message}`);
}
