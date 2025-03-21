import { ORIGIN } from "../src/utils/constants";
import { COMMON_CITY_PREFERRED_COUNTRIES, loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");
const cityNames = coordinates.getCityNames();

console.log("Debugging city matching issues:");
console.log("------------------------------");

// Print all Barcelona entries in the database
console.log("\nAll Barcelona entries in the database:");
const barcelonaEntries = cityNames.filter(name =>
  name.toLowerCase().includes("barcelona"));
barcelonaEntries.forEach(entry => {
  const coords = coordinates.getCoordinates(entry);
  console.log(`- "${entry}" => Coordinates: ${coords?.lat}, ${coords?.lng}`);
});

// Check if the preferred format exists in the database
const preferredFormat = `barcelona, ${COMMON_CITY_PREFERRED_COUNTRIES["barcelona"]}`;
console.log(`\nChecking if preferred format "${preferredFormat}" exists in the database:`);
const exactMatch = coordinates.getCoordinates(preferredFormat);
console.log(`Exact match for "${preferredFormat}": ${exactMatch ? "Found" : "Not found"}`);

// Check if "Barcelona, Spain" exists in the database
console.log(`\nChecking if "Barcelona, Spain" exists in the database:`);
const spainMatch = coordinates.getCoordinates("Barcelona, Spain");
console.log(`Exact match for "Barcelona, Spain": ${spainMatch ? "Found" : "Not found"}`);

// Check if "barcelona, Spain" (lowercase) exists in the database
console.log(`\nChecking if "barcelona, Spain" (lowercase) exists in the database:`);
const lowercaseMatch = coordinates.getCoordinates("barcelona, Spain");
console.log(`Exact match for "barcelona, Spain": ${lowercaseMatch ? "Found" : "Not found"}`);

// Check the format of entries in the database
console.log("\nSample of city entries in the database:");
const sampleEntries = cityNames.slice(0, 10);
sampleEntries.forEach(entry => {
  console.log(`- "${entry}"`);
});

// Try to get coordinates for different formats of Barcelona
console.log("\nTrying different formats of Barcelona:");
const testFormats = [
  "Barcelona",
  "barcelona",
  "Barcelona, Spain",
  "barcelona, Spain",
  "Barcelona Spain",
  "barcelona Spain"
];

testFormats.forEach(format => {
  const coords = coordinates.getCoordinates(format);
  console.log(`Format: "${format}" => ${coords ? `Found at ${coords.lat}, ${coords.lng}` : "Not found"}`);
});

// Test the distance calculation with different formats
console.log("\nTesting distance calculation with different formats:");
testFormats.forEach(format => {
  try {
    const distance = getDistanceKmFromCities(ORIGIN, format, coordinates);
    console.log(`Distance from ${ORIGIN} to ${format}: ${Math.round(distance)} km`);
  } catch (error) {
    console.log(`Error calculating distance to ${format}: ${(error as Error).message}`);
  }
});
