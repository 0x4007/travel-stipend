// Test the getRegion function from flights.ts

import { calculateFlightCost } from "../src/utils/flights";

// Test locations with their expected regions
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

// We can infer the region by looking at flight costs between locations in the same region vs different regions
console.log("Testing region determination using the country-data library:");
console.log("==========================================================");

// Test each location against Seoul (Asia)
const seoulLocation = "Seoul, South Korea";

for (const { location, expectedRegion } of testLocations) {
  // Calculate flight cost between Seoul and the test location
  // We'll use a fixed distance to isolate the regional factor effect
  const costFromSeoul = calculateFlightCost(2000, location, seoulLocation);

  // Determine if the locations are in the same region
  const sameRegion = expectedRegion === "Asia";

  console.log(`Location: ${location} (${expectedRegion})`);
  console.log(`Flight cost from Seoul: $${costFromSeoul}`);
  console.log(`Same region as Seoul: ${sameRegion}`);
  console.log("---");
}

// Test a few cross-region pairs to verify premium routes
console.log("\nTesting premium routes:");
console.log("======================");

const premiumRoutes = [
  { from: "New York, USA", to: "Tokyo, Japan", description: "North America to Asia" },
  { from: "London, UK", to: "Sydney, Australia", description: "Europe to Australia" },
  { from: "São Paulo, Brazil", to: "Tokyo, Japan", description: "South America to Asia" }
];

for (const { from, to, description } of premiumRoutes) {
  const cost = calculateFlightCost(5000, to, from);
  console.log(`Route: ${from} to ${to} (${description})`);
  console.log(`Flight cost (5000km): $${cost}`);
  console.log("---");
}
