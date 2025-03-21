import { ORIGIN } from "../src/utils/constants";
import { loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");

console.log("Verifying Barcelona fix:");
console.log("----------------------");

// Test with just "Barcelona"
try {
  // Get the distance to Barcelona (should use our special case)
  const distance = getDistanceKmFromCities(ORIGIN, "Barcelona", coordinates);
  console.log(`Distance from ${ORIGIN} to Barcelona: ${Math.round(distance)} km`);

  // Get the distance to Barcelona Spain for comparison (no comma)
  const spainDistance = getDistanceKmFromCities(ORIGIN, "Barcelona Spain", coordinates);
  console.log(`Distance from ${ORIGIN} to Barcelona Spain: ${Math.round(spainDistance)} km`);

  // Get the distance to Barcelona Philippines for comparison (no comma)
  let philippinesDistance = 0;
  try {
    philippinesDistance = getDistanceKmFromCities(ORIGIN, "Barcelona Philippines", coordinates);
    console.log(`Distance from ${ORIGIN} to Barcelona Philippines: ${Math.round(philippinesDistance)} km`);
  } catch (error) {
    console.log(`Error getting distance to Barcelona Philippines: ${(error as Error).message}`);
    // Try with comma format as fallback
    try {
      philippinesDistance = getDistanceKmFromCities(ORIGIN, "Barcelona, Philippines", coordinates);
      console.log(`Distance from ${ORIGIN} to Barcelona, Philippines: ${Math.round(philippinesDistance)} km`);
    } catch (innerError) {
      console.log(`Error getting distance to Barcelona, Philippines: ${(innerError as Error).message}`);
    }
  }

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
