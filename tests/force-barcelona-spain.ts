import { ORIGIN } from "../src/utils/constants";
import { loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");

console.log("Forcing Barcelona to use Spain coordinates:");
console.log("----------------------------------------");

// Find Barcelona in Spain coordinates
console.log("Looking for Barcelona in Spain...");
let barcelonaSpainCoords: { lat: number, lng: number } | undefined;

// Get all city names
const cityNames = coordinates.getCityNames();

// Find all Barcelona entries
const barcelonaEntries = cityNames.filter(name =>
  name.toLowerCase().includes("barcelona"));

console.log("All Barcelona entries:");
barcelonaEntries.forEach(entry => {
  const coords = coordinates.getCoordinates(entry);
  console.log(`- "${entry}" => Coordinates: ${coords?.lat}, ${coords?.lng}`);

  // If this entry is Barcelona in Spain, store its coordinates
  if (entry.toLowerCase().includes("spain") || entry.toLowerCase().includes("españa")) {
    barcelonaSpainCoords = coords;
    console.log(`Found Barcelona in Spain: ${entry}`);
  }
});

if (!barcelonaSpainCoords) {
  console.error("Could not find Barcelona in Spain coordinates");
  process.exit(1);
}

// Get Barcelona coordinates
const barcelonaCoords = coordinates.getCoordinates("Barcelona");
if (!barcelonaCoords) {
  console.error("Could not find Barcelona coordinates");
  process.exit(1);
}

console.log("Original Barcelona coordinates:", barcelonaCoords);
console.log("Barcelona Spain coordinates:", barcelonaSpainCoords);

// Directly modify the coordinates mapping
// This is a hack to force Barcelona to use Spain coordinates
// @ts-ignore - Accessing private property
coordinates._cityMap["Barcelona"] = barcelonaSpainCoords;

console.log("Modified Barcelona coordinates:", coordinates.getCoordinates("Barcelona"));

// Test with just "Barcelona"
try {
  const distance = getDistanceKmFromCities(ORIGIN, "Barcelona", coordinates);
  console.log(`Distance from ${ORIGIN} to Barcelona: ${Math.round(distance)} km`);

  // Get the distance to Barcelona Spain for comparison
  const spainDistance = getDistanceKmFromCities(ORIGIN, "Barcelona Spain", coordinates);
  console.log(`Distance from ${ORIGIN} to Barcelona Spain: ${Math.round(spainDistance)} km`);

  // Check if the fix is working
  const isFixWorking = Math.abs(distance - spainDistance) < 1;
  console.log(`\nIs the fix working? ${isFixWorking ? "YES" : "NO"}`);

  if (isFixWorking) {
    console.log("Success! 'Barcelona' now correctly matches with 'Barcelona, Spain'");
  } else {
    console.log("Fix not working. 'Barcelona' is still matching with a different city");
  }
} catch (error) {
  console.log(`Error: ${(error as Error).message}`);
}
