import { ORIGIN } from "../src/utils/constants";
import { findBestMatch, loadCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");
const cityNames = coordinates.getCityNames();

console.log("Testing city-country matching with improved logic:");
console.log("------------------------------------------------");

// Test cases for common cities that should match with their preferred countries
const testCases = [
  "Barcelona",
  "Paris",
  "London",
  "New York",
  "Tokyo",
  "Rome",
  "Berlin",
  "Madrid"
];

// Test each city
testCases.forEach(city => {
  console.log(`\nTesting city: ${city}`);

  // Test the findBestMatch function
  const { match, similarity } = findBestMatch(city, cityNames);
  console.log(`Best match for "${city}": "${match}" (similarity: ${(similarity * 100).toFixed(1)}%)`);

  // Test the distance calculation
  try {
    const distance = getDistanceKmFromCities(ORIGIN, city, coordinates);
    console.log(`Distance from ${ORIGIN} to ${city}: ${Math.round(distance)} km`);

    // Get the coordinates for the matched city
    const coords = coordinates.getCoordinates(match);
    console.log(`Coordinates for matched city: ${coords?.lat}, ${coords?.lng}`);
  } catch (error) {
    console.log(`Error calculating distance: ${(error as Error).message}`);
  }
});

// Test Barcelona specifically to verify the fix
console.log("\nDetailed test for Barcelona:");
console.log("---------------------------");

// Get all Barcelona entries
const barcelonaEntries = cityNames.filter(name =>
  name.toLowerCase().includes("barcelona"));

console.log("All Barcelona entries in the database:");
barcelonaEntries.forEach(entry => {
  console.log(`- ${entry}`);
});

// Test with just "Barcelona"
const { match: barcelonaMatch } = findBestMatch("Barcelona", cityNames);
console.log(`\nBest match for "Barcelona": "${barcelonaMatch}"`);

// Verify it's Barcelona, Spain by checking coordinates
const spainCoords = coordinates.getCoordinates("Barcelona, Spain");
const matchCoords = coordinates.getCoordinates(barcelonaMatch);

if (spainCoords && matchCoords) {
  const isSameLocation =
    Math.abs(spainCoords.lat - matchCoords.lat) < 0.001 &&
    Math.abs(spainCoords.lng - matchCoords.lng) < 0.001;

  console.log(`Match coordinates: ${matchCoords.lat}, ${matchCoords.lng}`);
  console.log(`Spain coordinates: ${spainCoords.lat}, ${spainCoords.lng}`);
  console.log(`Is Barcelona, Spain: ${isSameLocation ? "YES" : "NO"}`);
}
