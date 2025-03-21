import { findBestMatch, loadCoordinatesData } from "../src/utils/coordinates";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");
const cityNames = coordinates.getCityNames();

// Test Barcelona matching
console.log("Testing Barcelona city matching:");
console.log("-------------------------------");

// Test exact match for different Barcelona entries
const exactMatches = [
  "Barcelona",
  "Barcelona, Spain",
  "Barcelona, Philippines",
  "Barcelona, Venezuela"
];

exactMatches.forEach(city => {
  const coords = coordinates.getCoordinates(city);
  console.log(`Exact match for "${city}": ${coords ? `Found at ${coords.lat}, ${coords.lng}` : "Not found"}`);
});

// Test fuzzy matching for Barcelona
console.log("\nFuzzy matching for Barcelona:");
console.log("----------------------------");
const { match: bestMatch, similarity } = findBestMatch("Barcelona", cityNames);
console.log(`Best match for "Barcelona": "${bestMatch}" (similarity: ${(similarity * 100).toFixed(1)}%)`);

// Test fuzzy matching for Barcelona with different spellings
const spellingVariations = [
  "Barselona",
  "Barcellona",
  "Barçelona",
  "Barthelona"
];

spellingVariations.forEach(spelling => {
  const { match, similarity } = findBestMatch(spelling, cityNames);
  console.log(`Best match for "${spelling}": "${match}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
});

// Check all entries containing "Barcelona" in the city names
console.log("\nAll entries containing 'Barcelona' in city names:");
console.log("----------------------------------------------");
const barcelonaEntries = cityNames.filter(name => name.toLowerCase().includes("barcelona"));
barcelonaEntries.forEach(entry => {
  const coords = coordinates.getCoordinates(entry);
  console.log(`Entry: "${entry}" => Coordinates: ${coords?.lat}, ${coords?.lng}`);
});
