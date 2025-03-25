import { calculateFlightCost } from "../src/utils/flights";

// Test with different distance ranges
const TEST_DISTANCES = [
  { distance: 800, from: "Origin City A", to: "Destination City B" },
  { distance: 1500, from: "Origin City C", to: "Destination City D" },
  { distance: 2500, from: "Origin City E", to: "Destination City F" },
  { distance: 5000, from: "Origin City G", to: "Destination City H" },
  { distance: 8500, from: "Origin City I", to: "Destination City J" },
  { distance: 12000, from: "Origin City K", to: "Destination City L" },
];

// Simple price model for comparison (similar to the one in distance-price-analysis.test.ts)
function getBaselinePrice(distance: number): number {
  const BASE_PRICE = 200;
  return Math.round((BASE_PRICE + distance * 0.1) / 5) * 5; // Round to nearest $5
}

console.log("Flight Cost Analysis (Distance-Based):");
console.log("=====================================");
console.log();

let totalError = 0;
let totalAbsError = 0;

// Calculate and print results for each distance
TEST_DISTANCES.forEach(({ distance, from, to }) => {
  const estimatedPrice = calculateFlightCost(distance, to, from);
  const baselinePrice = getBaselinePrice(distance);
  const errorPercent = ((estimatedPrice - baselinePrice) / baselinePrice) * 100;

  totalError += errorPercent;
  totalAbsError += Math.abs(errorPercent);

  console.log(`Route: ${from} to ${to}`);
  console.log(`Distance: ${distance.toFixed(0)} km`);
  console.log(`Estimated Price: $${estimatedPrice}`);
  console.log(`Baseline Price: $${baselinePrice}`);
  console.log(`Error: ${errorPercent.toFixed(2)}%`);
  console.log();
});

console.log("Summary:");
console.log(`Average Error: ${(totalError / TEST_DISTANCES.length).toFixed(2)}%`);
console.log(`Average Absolute Error: ${(totalAbsError / TEST_DISTANCES.length).toFixed(2)}%`);
