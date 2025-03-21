import { loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");

console.log("Testing Barcelona special case:");
console.log("-----------------------------");

// Get coordinates for Barcelona Spain
const barcelonaSpainCoords = coordinates.getCoordinates("Barcelona Spain");
console.log(`Barcelona Spain coordinates: ${barcelonaSpainCoords?.lat}, ${barcelonaSpainCoords?.lng}`);

// Get coordinates for Barcelona (Philippines)
const barcelonaCoords = coordinates.getCoordinates("Barcelona");
console.log(`Barcelona coordinates: ${barcelonaCoords?.lat}, ${barcelonaCoords?.lng}`);

// Test the distance calculation with just "Barcelona"
try {
  const distance = getDistanceKmFromCities("Seoul Korea South", "Barcelona", coordinates);
  console.log(`Distance from Seoul Korea South to Barcelona: ${Math.round(distance)} km`);

  // Get the distance to Barcelona Spain for comparison
  const spainDistance = getDistanceKmFromCities("Seoul Korea South", "Barcelona Spain", coordinates);
  console.log(`Distance from Seoul Korea South to Barcelona Spain: ${Math.round(spainDistance)} km`);

  // Check if the special case is working
  const isSpecialCaseWorking = Math.abs(distance - spainDistance) < 1;
  console.log(`\nIs the special case working? ${isSpecialCaseWorking ? "YES" : "NO"}`);

  if (isSpecialCaseWorking) {
    console.log("Success! Special case for 'Barcelona' is working correctly");
  } else {
    console.log("Special case not working. 'Barcelona' is still matching with a different city");
    console.log(`Barcelona distance: ${Math.round(distance)} km`);
    console.log(`Barcelona Spain distance: ${Math.round(spainDistance)} km`);
  }
} catch (error) {
  console.log(`Error: ${(error as Error).message}`);
}
