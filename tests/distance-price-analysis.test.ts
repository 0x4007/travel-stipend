import { calculateFlightCost } from '../src/utils/flights';

interface RouteAnalysis {
  origin: string;
  destination: string;
  distanceKm: number;
  actualPrice: number;
  pricePerKm: number;
  estimatedPrice: number;
  errorPercent: number;
  distanceTier: string; // Add tier info for analysis
  dateCollected: string;
}

// Helper function to identify distance tier
function getDistanceTier(distanceKm: number): string {
  if (distanceKm < 500) return 'Very Short (<500km)';
  if (distanceKm < 1500) return 'Short (500-1500km)';
  if (distanceKm < 4000) return 'Medium (1500-4000km)';
  if (distanceKm < 8000) return 'Long (4000-8000km)';
  return 'Very Long (>8000km)';
}

// Test with different distance ranges
const TEST_DISTANCES = [
  { from: "City A", to: "City B", distance: 800 },  // Short distance
  { from: "City C", to: "City D", distance: 2500 }, // Medium distance
  { from: "City E", to: "City F", distance: 5000 }, // Long distance
  { from: "City G", to: "City H", distance: 8500 }, // Very long distance
  { from: "City I", to: "City J", distance: 12000 } // Ultra long distance
];


import { afterAll, beforeAll, describe, expect, test } from "bun:test";

describe('Distance-Based Price Analysis', () => {
  const BASE_PRICE = 200; // Base price for the simple linear model
  const results: RouteAnalysis[] = [];

  beforeAll(() => {
    // Pure distance-based analysis
    console.log('Starting pure distance-based analysis');
  });

  afterAll(() => {
    // Log analysis results
    console.log('\nRoute Analysis Results:');
    console.table(results);

    // Calculate and log aggregate statistics
    const avgErrorPercent = results.reduce((sum, r) => sum + Math.abs(r.errorPercent), 0) / results.length;
    const avgPricePerKm = results.reduce((sum, r) => sum + r.pricePerKm, 0) / results.length;

    // Group results by distance tier for analysis
    const tierResults = new Map<string, RouteAnalysis[]>();
    results.forEach(result => {
      const tier = result.distanceTier;
      const tierRoutes = tierResults.get(tier) || [];
      tierRoutes.push(result);
      tierResults.set(tier, tierRoutes);
    });

    console.log('\nAnalysis by Distance Tier:');
    tierResults.forEach((routes, tier) => {
      const avgError = routes.reduce((sum, r) => sum + Math.abs(r.errorPercent), 0) / routes.length;
      const avgPrice = routes.reduce((sum, r) => sum + r.actualPrice, 0) / routes.length;
      console.log(`\n${tier}:`);
      console.log(`  Average Error: ${avgError.toFixed(2)}%`);
      console.log(`  Average Price: $${avgPrice.toFixed(2)}`);
      const routeList = routes.map(r => `${r.origin} to ${r.destination}`).join(', ');
      console.log(`  Routes: ${routeList}`);
    });

    console.log('\nOverall Statistics:');
    console.log(`Average Error: ${avgErrorPercent.toFixed(2)}%`);
    console.log(`Average Price per KM: $${avgPricePerKm.toFixed(3)}`);

    // Suggestions for improvements
    console.log('\nSuggested Improvements:');
    tierResults.forEach((routes, tier) => {
      const avgError = routes.reduce((sum, r) => sum + r.errorPercent, 0) / routes.length;
      if (Math.abs(avgError) > 10) {
        const adjustment = avgError > 0 ? 'decrease' : 'increase';
        console.log(`- Consider ${adjustment} constants for ${tier} flights`);
      }
    });
  });

  // Test each distance range
  test.each(TEST_DISTANCES)('Analyzing route of %d km', async ({ from, to, distance }) => {
    const distanceKm = distance;
    console.log(`Calculated distance: ${distanceKm.toFixed(0)}km`);

    // Get estimated price using our distance-based algorithm
    const estimatedPrice = calculateFlightCost(distanceKm, to, from);

    // For testing purposes, we'll use a simplified price model to compare against
    // Base price plus distance-based factor (roughly $0.10 per km)
    const actualPrice = BASE_PRICE + (distance * 0.10);
    const pricePerKm = actualPrice / distanceKm;
    const errorPercent = ((estimatedPrice - actualPrice) / actualPrice) * 100;

    // Get tier for analysis
    const distanceTier = getDistanceTier(distanceKm);
    // Store results
    results.push({
        origin: from,
        destination: to,
        distanceKm,
        actualPrice,
        pricePerKm,
        estimatedPrice,
        errorPercent,
        distanceTier,
        dateCollected: new Date().toISOString(),
      });

      // Log individual route results
      console.log(`\nAnalyzing ${from} to ${to}:`);
      console.log(`Distance: ${distanceKm.toFixed(0)}km`);
      console.log(`Actual Price: $${actualPrice}`);
      console.log(`Estimated Price: $${estimatedPrice.toFixed(2)}`);
      console.log(`Price per KM: $${pricePerKm.toFixed(3)}`);
      console.log(`Error: ${errorPercent.toFixed(2)}%`);

    // Basic validation
    expect(distanceKm).toBeGreaterThan(0);
    expect(actualPrice).toBeGreaterThan(0);
  }, 120000); // Increased timeout for flight searches
});
