import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHashKey, PersistentCache } from '../src/utils/cache';
import { CoordinatesMapping } from '../src/utils/coordinates';
import { getDistanceKmFromCities } from '../src/utils/distance';
import { calculateFlightCost } from '../src/utils/flights';
import { GoogleFlightsScraper } from '../src/utils/google-flights-scraper';

// Test just the routes with highest error percentages
const DESTINATIONS_TO_TEST = [
  "Helsinki, Finland",    // ~61% error
  "Abu Dhabi, UAE",      // ~55% error
  "Berlin, Germany"      // ~34% error
];

const ORIGIN = "Seoul, South Korea";

// Add coordinates for testing
const COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Seoul, South Korea': { lat: 37.5665, lng: 126.9780 },
  'Helsinki, Finland': { lat: 60.1699, lng: 24.9384 },
  'Abu Dhabi, UAE': { lat: 24.4539, lng: 54.3773 },
  'Berlin, Germany': { lat: 52.5200, lng: 13.4050 }
};

interface FlightCostCacheEntry {
  cost: number;
  metadata: {
    isTraining: boolean;
    tierVersion: string;
    timestamp: string;
    actualPrice?: number;
    error?: number;
    googleFlightsUrl?: string;
  }
}

interface RouteAnalysis {
  origin: string;
  destination: string;
  distanceKm: number;
  actualPrice: number;
  pricePerKm: number;
  estimatedPrice: number;
  errorPercent: number;
  distanceTier: string;
  dateCollected: string;
  googleFlightsUrl?: string;
}

// Helper function to identify distance tier
function getDistanceTier(distanceKm: number): string {
  if (distanceKm < 200) return 'Micro (<200km)';
  if (distanceKm < 300) return 'Ultra Short (200-300km)';
  if (distanceKm < 400) return 'Very Short (300-400km)';
  if (distanceKm < 500) return 'Short (400-500km)';
  if (distanceKm < 600) return 'Short-Plus (500-600km)';
  if (distanceKm < 750) return 'Short-Medium (600-750km)';
  if (distanceKm < 900) return 'Medium-Short (750-900km)';
  if (distanceKm < 1000) return 'Medium-Short-Plus (900-1000km)';
  if (distanceKm < 1250) return 'Medium-Minus (1000-1250km)';
  if (distanceKm < 1500) return 'Medium (1250-1500km)';
  if (distanceKm < 1750) return 'Medium-Plus (1500-1750km)';
  if (distanceKm < 2000) return 'Medium-Extended (1750-2000km)';
  if (distanceKm < 2250) return 'Medium-Long-Minus (2000-2250km)';
  if (distanceKm < 2500) return 'Medium-Long (2250-2500km)';
  if (distanceKm < 2750) return 'Medium-Long-Plus (2500-2750km)';
  if (distanceKm < 3000) return 'Extended-Medium (2750-3000km)';
  if (distanceKm < 3500) return 'Long-Starter-Minus (3000-3500km)';
  if (distanceKm < 4000) return 'Long-Starter (3500-4000km)';
  if (distanceKm < 4500) return 'Long-Minus (4000-4500km)';
  if (distanceKm < 5000) return 'Long (4500-5000km)';
  if (distanceKm < 5500) return 'Long-Plus (5000-5500km)';
  if (distanceKm < 6000) return 'Long-Extended (5500-6000km)';
  if (distanceKm < 6500) return 'Extended-Minus (6000-6500km)';
  if (distanceKm < 7000) return 'Extended (6500-7000km)';
  if (distanceKm < 7500) return 'Extended-Plus (7000-7500km)';
  if (distanceKm < 8000) return 'Extended-Long (7500-8000km)';
  if (distanceKm < 8500) return 'Very-Long-Starter-Minus (8000-8500km)';
  if (distanceKm < 9000) return 'Very-Long-Starter (8500-9000km)';
  if (distanceKm < 9500) return 'Very-Long-Minus (9000-9500km)';
  if (distanceKm < 10000) return 'Very-Long (9500-10000km)';
  if (distanceKm < 10500) return 'Ultra-Starter-Minus (10000-10500km)';
  if (distanceKm < 11000) return 'Ultra-Starter (10500-11000km)';
  if (distanceKm < 11500) return 'Ultra-Long-Minus (11000-11500km)';
  if (distanceKm < 12000) return 'Ultra-Long (11500-12000km)';
  if (distanceKm < 12500) return 'Extreme-Starter-Minus (12000-12500km)';
  if (distanceKm < 13000) return 'Extreme-Starter (12500-13000km)';
  if (distanceKm < 13500) return 'Extreme-Minus (13000-13500km)';
  if (distanceKm < 14000) return 'Extreme (13500-14000km)';
  if (distanceKm < 14500) return 'Extreme-Plus (14000-14500km)';
  if (distanceKm < 15000) return 'Ultra-Extreme (14500-15000km)';
  return 'Maximum (>15000km)';
}

describe('Comprehensive Distance-Based Price Analysis', () => {
  let scraper: GoogleFlightsScraper;
  let coordinates: CoordinatesMapping;
  const results: RouteAnalysis[] = [];
  const isTrainingMode = true; // Enable training mode for this run
  const flightCostCache = new PersistentCache<FlightCostCacheEntry>("fixtures/cache/flight-cost-cache.json", isTrainingMode);

  // Create output directory
  const outputDir = join(process.cwd(), 'test-results');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  beforeAll(async () => {
    // Initialize Google Flights scraper with training mode
    scraper = new GoogleFlightsScraper(isTrainingMode);
    await scraper.initialize({ headless: true });
    console.log('Browser initialized');

    await scraper.navigateToGoogleFlights();
    console.log('Navigated to Google Flights');

    // Add delay before currency change
    await new Promise(resolve => setTimeout(resolve, 2000));

    await scraper.changeCurrencyToUsd();
    console.log('Changed currency to USD');

    // Add delay after currency change
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Initialize coordinates
    coordinates = new CoordinatesMapping();
    Object.entries(COORDINATES).forEach(([city, coords]) => {
      coordinates.addCity(city, coords);
    });
    console.log('Coordinates initialized');
  });

  afterAll(async () => {
    await scraper.close();

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
      const tierRoutes = tierResults.get(tier) ?? [];
      tierRoutes.push(result);
      tierResults.set(tier, tierRoutes);
    });

    console.log('\nDetailed Analysis by Distance Tier:');
    tierResults.forEach((routes, tier) => {
      const avgError = routes.reduce((sum, r) => sum + Math.abs(r.errorPercent), 0) / routes.length;
      const avgPrice = routes.reduce((sum, r) => sum + r.actualPrice, 0) / routes.length;
      const avgPricePerKm = routes.reduce((sum, r) => sum + r.pricePerKm, 0) / routes.length;
      const avgEstimatedPrice = routes.reduce((sum, r) => sum + r.estimatedPrice, 0) / routes.length;

      console.log(`\n${tier}:`);
      console.log(`  Routes: ${routes.length}`);
      console.log(`  Average Real Price: $${avgPrice.toFixed(2)}`);
      console.log(`  Average Estimated Price: $${avgEstimatedPrice.toFixed(2)}`);
      console.log(`  Average Error: ${avgError.toFixed(2)}%`);
      console.log(`  Average Price per KM: $${avgPricePerKm.toFixed(4)}`);

      // Detailed route analysis
      console.log('  Route Details:');
      routes.forEach(r => {
        console.log(`    ${r.origin} to ${r.destination}:`);
        console.log(`      Distance: ${r.distanceKm.toFixed(0)}km`);
        console.log(`      Real Price: $${r.actualPrice}`);
        console.log(`      Estimated: $${r.estimatedPrice.toFixed(2)}`);
        console.log(`      Error: ${r.errorPercent.toFixed(2)}%`);
        if (r.googleFlightsUrl) {
          console.log(`      URL: ${r.googleFlightsUrl}`);
        }
      });

      // Provide specific adjustment recommendations
      if (Math.abs(avgError) > 10) {
        const errorMagnitude = Math.abs(avgError);
        let factorAdjustment = 0;

        if (errorMagnitude > 50) factorAdjustment = 0.03;
        else if (errorMagnitude > 30) factorAdjustment = 0.02;
        else if (errorMagnitude > 10) factorAdjustment = 0.01;

        console.log('\n  Suggested Adjustments:');
        if (avgError > 0) {
          console.log(`    - Decrease factor by ~${factorAdjustment.toFixed(3)} for this tier`);
          console.log(`    - Consider adjusting exponent by -0.01 to -0.02`);
        } else {
          console.log(`    - Increase factor by ~${factorAdjustment.toFixed(3)} for this tier`);
          console.log(`    - Consider adjusting exponent by +0.01 to +0.02`);
        }
      }
    });

    console.log('\nOverall Statistics:');
    console.log(`Average Error: ${avgErrorPercent.toFixed(2)}%`);
    console.log(`Average Price per KM: $${avgPricePerKm.toFixed(4)}`);

    // Save results to CSV with enhanced data
    const csvHeader = 'Origin,Destination,Distance (km),Actual Price,Estimated Price,Error %,Price per km,Distance Tier,Date Collected,Suggested Factor Adjustment,Suggested Exponent Adjustment,Google Flights URL';
    const csvRows = results.map(r => {
      const error = Math.abs(r.errorPercent);
      let factorAdjustment = 0;
      let exponentAdjustment = 0;

      if (error > 50) {
        factorAdjustment = 0.03;
        exponentAdjustment = 0.02;
      } else if (error > 30) {
        factorAdjustment = 0.02;
        exponentAdjustment = 0.015;
      } else if (error > 10) {
        factorAdjustment = 0.01;
        exponentAdjustment = 0.01;
      }

      if (r.errorPercent < 0) {
        factorAdjustment *= -1;
        exponentAdjustment *= -1;
      }

      // Handle URL properly for CSV
      const urlStr = r.googleFlightsUrl ? `"${r.googleFlightsUrl}"` : '""';

      return `"${r.origin}","${r.destination}",${r.distanceKm.toFixed(0)},${r.actualPrice},${r.estimatedPrice},${r.errorPercent.toFixed(2)},${r.pricePerKm.toFixed(4)},"${r.distanceTier}","${r.dateCollected}",${factorAdjustment.toFixed(3)},${exponentAdjustment.toFixed(3)},${urlStr}`;
    });
    const csvContent = [csvHeader, ...csvRows].join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvFilePath = join(outputDir, `flight-price-analysis-${timestamp}.csv`);
    writeFileSync(csvFilePath, csvContent);
    console.log(`\nResults saved to: ${csvFilePath}`);
  });

  // Test each destination
  test.each(DESTINATIONS_TO_TEST)('Analyzing route: Seoul to %s', async (destination) => {
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Calculate distance
    const distanceKm = getDistanceKmFromCities(ORIGIN, destination, coordinates);
    console.log(`Calculated distance: ${distanceKm.toFixed(0)}km`);

    // Get current estimated price using our enhanced algorithm
    const estimatedPrice = calculateFlightCost(distanceKm, destination, ORIGIN);

    // Get actual price from Google Flights
    const departureDate = '2024-05-25';
    const returnDate = '2024-06-01';
    console.log(`Searching flights for dates: ${departureDate} - ${returnDate}`);

    try {
      let retryCount = 0;
      const maxRetries = 3;
      let flightResult;

      while (retryCount < maxRetries) {
        try {
          flightResult = await scraper.searchFlights(ORIGIN, destination, departureDate, returnDate);
          console.log('Flight search completed');

          if (flightResult.success && 'price' in flightResult) {
            break;
          }

          console.log(`Retry ${retryCount + 1}/${maxRetries} for ${destination}`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`Error searching flights (attempt ${retryCount + 1}):`, error);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 3000));

          if (retryCount === maxRetries) {
            throw error;
          }
        }
      }

      if (!flightResult || !flightResult.success || !('price' in flightResult)) {
        console.error(`Failed to get flight price for ${destination} after ${maxRetries} attempts`);
        return;
      }

      const actualPrice = flightResult.price;
      const pricePerKm = actualPrice / distanceKm;
      const errorPercent = ((estimatedPrice - actualPrice) / actualPrice) * 100;

      // Extract searchUrl safely
      const searchUrl = flightResult.searchUrl && typeof flightResult.searchUrl === 'string'
        ? flightResult.searchUrl
        : undefined;

      // Get tier for analysis
      const distanceTier = getDistanceTier(distanceKm);

      // Create result object with URL
      const result: RouteAnalysis = {
        origin: ORIGIN,
        destination,
        distanceKm,
        actualPrice,
        pricePerKm,
        estimatedPrice,
        errorPercent,
        distanceTier,
        dateCollected: new Date().toISOString(),
        googleFlightsUrl: searchUrl
      };
      results.push(result);

      // Cache the result for training if in training mode
      if (isTrainingMode) {
        const cacheKey = createHashKey([ORIGIN, destination, distanceKm.toFixed(1), "v3-training"]);
        const cacheEntry: FlightCostCacheEntry = {
          cost: estimatedPrice,
          metadata: {
            isTraining: true,
            tierVersion: "v3",
            timestamp: new Date().toISOString(),
            actualPrice: actualPrice,
            error: errorPercent,
            googleFlightsUrl: searchUrl
          }
        };
        flightCostCache.set(cacheKey, cacheEntry);
      }

      // Log individual route results
      console.log(`\nAnalyzing ${ORIGIN} to ${destination}:`);
      console.log(`Distance: ${distanceKm.toFixed(0)}km`);
      console.log(`Actual Price: $${actualPrice}`);
      console.log(`Estimated Price: $${estimatedPrice.toFixed(2)}`);
      console.log(`Price per KM: $${pricePerKm.toFixed(4)}`);
      console.log(`Error: ${errorPercent.toFixed(2)}%`);
      console.log(`Tier: ${distanceTier}`);
      if (searchUrl) {
        console.log(`URL: ${searchUrl}`);
      }

      // Skip validation for same-city routes
      if (ORIGIN !== destination) {
        expect(distanceKm).toBeGreaterThan(0);
      }
      expect(actualPrice).toBeGreaterThan(0);
    } catch (error) {
      console.error(`Error processing flight search for ${destination}:`, error);
      throw error;
    }
  }, 300000); // Increased timeout for multiple flight searches
});
