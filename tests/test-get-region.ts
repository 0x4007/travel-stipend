// Test the getRegion function directly

import { getRegion } from "../src/utils/flights";

const testLocations = [
  { location: "Seoul, South Korea", expectedRegion: "Asia" },
  { location: "Tokyo, Japan", expectedRegion: "Asia" },
  { location: "New York, USA", expectedRegion: "North America" },
  { location: "London, UK", expectedRegion: "Europe" },
  { location: "Paris, France", expectedRegion: "Europe" },
  { location: "Sydney, Australia", expectedRegion: "Australia" },
  { location: "São Paulo, Brazil", expectedRegion: "South America" },
  { location: "Cairo, Egypt", expectedRegion: "Africa" },
  { location: "Singapore", expectedRegion: "Asia" },
  { location: "Hong Kong", expectedRegion: "Asia" },
  { location: "Berlin, Germany", expectedRegion: "Europe" },
  { location: "Mumbai, India", expectedRegion: "Asia" },
  { location: "Toronto, Canada", expectedRegion: "North America" },
  { location: "Mexico City, Mexico", expectedRegion: "North America" },
  { location: "Cape Town, South Africa", expectedRegion: "Africa" }
];

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
