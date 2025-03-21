import { COMMON_CITY_PREFERRED_COUNTRIES, loadCoordinatesData } from "../src/utils/coordinates";

// Load the coordinates data
const coordinates = loadCoordinatesData("fixtures/coordinates.csv");
const cityNames = coordinates.getCityNames();

console.log("Debugging Barcelona case sensitivity issues:");
console.log("------------------------------------------");

// Print all Barcelona entries in the database
console.log("\nAll Barcelona entries in the database:");
const barcelonaEntries = cityNames.filter(name =>
  name.toLowerCase().includes("barcelona"));
barcelonaEntries.forEach(entry => {
  const coords = coordinates.getCoordinates(entry);
  console.log(`- "${entry}" => Coordinates: ${coords?.lat}, ${coords?.lng}`);
});

// Try different case variations
const caseVariations = [
  "Barcelona",
  "BARCELONA",
  "barcelona",
  "Barcelona Spain",
  "BARCELONA SPAIN",
  "barcelona spain",
  "Barcelona SPAIN",
  "barcelona Spain"
];

console.log("\nTrying different case variations:");
caseVariations.forEach(variation => {
  const coords = coordinates.getCoordinates(variation);
  console.log(`- "${variation}" => ${coords ? `Found at ${coords.lat}, ${coords.lng}` : "Not found"}`);
});

// Try the exact format that should be used for preferred country
const city = "barcelona";
const preferredFormat = `${city} ${COMMON_CITY_PREFERRED_COUNTRIES[city]}`;
console.log(`\nTrying preferred format: "${preferredFormat}"`);
const preferredCoords = coordinates.getCoordinates(preferredFormat);
console.log(`- "${preferredFormat}" => ${preferredCoords ? `Found at ${preferredCoords.lat}, ${preferredCoords.lng}` : "Not found"}`);

// Check if the format with first letter capitalized exists
const capitalizedFormat = `Barcelona ${COMMON_CITY_PREFERRED_COUNTRIES[city]}`;
console.log(`\nTrying capitalized format: "${capitalizedFormat}"`);
const capitalizedCoords = coordinates.getCoordinates(capitalizedFormat);
console.log(`- "${capitalizedFormat}" => ${capitalizedCoords ? `Found at ${capitalizedCoords.lat}, ${capitalizedCoords.lng}` : "Not found"}`);
