// Test the getRegion function with locations from different continents

import { countries } from "countries-list";
import { getRegion } from "../src/utils/flights";

// Generate test locations from countries-list library
// This avoids hardcoding specific city names
function generateTestLocations() {
  // Sample countries from each continent
  const continentMap: Record<string, string> = {
    "EU": "Europe",
    "AS": "Asia",
    "NA": "North America",
    "SA": "South America",
    "AF": "Africa",
    "OC": "Australia"
  };

  const testLocations = [];
  const usedContinents = new Set<string>();

  // Get 2-3 countries from each continent
  for (const [code, country] of Object.entries(countries)) {
    const continent = country.continent;
    const continentName = continentMap[continent];

    if (continentName && usedContinents.has(continentName) && usedContinents.size < 15) {
      continue;
    }

    // Create a generic location string
    const location = `Capital of ${country.name}, ${country.name}`;
    testLocations.push({
      location,
      expectedRegion: continentName || "Other"
    });

    usedContinents.add(continentName);

    // Limit to 15 test locations
    if (testLocations.length >= 15) break;
  }

  return testLocations;
}

const testLocations = generateTestLocations();

console.log("Testing getRegion function directly:");
console.log("===================================");

for (const { location, expectedRegion } of testLocations) {
  const actualRegion = getRegion(location);
  const isCorrect = actualRegion === expectedRegion;

  console.log(`Location: ${location}`);
  console.log(`Expected Region: ${expectedRegion}`);
  console.log(`Actual Region: ${actualRegion}`);
  console.log(`Correct: ${isCorrect ? "✓" : "✗"}`);
  console.log("---");
}

// Count correct results
const correctCount = testLocations.filter(
  ({ location, expectedRegion }) => getRegion(location) === expectedRegion
).length;

console.log(`\nSummary: ${correctCount}/${testLocations.length} correct (${Math.round(correctCount / testLocations.length * 100)}%)`);
