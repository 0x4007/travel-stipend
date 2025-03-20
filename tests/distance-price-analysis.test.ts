import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CoordinatesMapping } from '../src/utils/coordinates';
import { getDistanceKmFromCities } from '../src/utils/distance';
import { calculateFlightCost } from '../src/utils/flights';
import { GoogleFlightsScraper } from '../src/utils/google-flights-scraper';

interface RouteAnalysis {
  origin: string;
  destination: string;
  distanceKm: number;
  actualPrice: number;
  pricePerKm: number;
  estimatedPrice: number;
  errorPercent: number;
  distanceTier: string; // Add tier info for analysis
  regionalFactor: number;
  popularityFactor: number;
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

// Test with representative cities from different distance ranges
const TEST_DESTINATIONS = [
  'Tokyo, Japan', // Short distance
  'Taipei, Taiwan', // Short distance
  'Hong Kong', // Medium distance
  'Bangkok, Thailand', // Medium distance
  'Singapore', // Longer distance
];
const ORIGIN = 'Seoul, South Korea';

// Add coordinates for testing
const COORDINATES = {
  'Seoul, South Korea': { lat: 37.5665, lng: 126.9780 },
  'Tokyo, Japan': { lat: 35.6762, lng: 139.6503 },
  'Taipei, Taiwan': { lat: 25.0330, lng: 121.5654 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
  'Singapore': { lat: 1.3521, lng: 103.8198 }
};

describe('Distance-Based Price Analysis', () => {
  let scraper: GoogleFlightsScraper;
  let coordinates: CoordinatesMapping;
  const results: RouteAnalysis[] = [];

  // Create screenshots directory
  const screenshotsDir = join(process.cwd(), 'test-screenshots');
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }

  beforeAll(async () => {
    // Initialize Google Flights scraper
    scraper = new GoogleFlightsScraper();

    // Create all flight searches upfront
    const searches = TEST_DESTINATIONS.map(destination => ({
      from: ORIGIN,
      to: destination,
      departureDate: '2024-05-20',
      returnDate: '2024-05-27'
    }));

    // Only initialize browser if we need fresh data
    const shouldInitBrowser = await scraper.needsFreshData(searches);
    if (shouldInitBrowser) {
      await scraper.initialize({ headless: false });
      console.log('Browser initialized');

      await scraper.navigateToGoogleFlights();
      console.log('Navigated to Google Flights');

      await scraper.changeCurrencyToUsd();
      console.log('Changed currency to USD');
    } else {
      console.log('Using cached data - skipping browser initialization');
    }

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

  // Test each destination
  test.each(TEST_DESTINATIONS)('Analyzing route: Seoul to %s', async (destination) => {
    // Calculate distance
    const distanceKm = getDistanceKmFromCities(ORIGIN, destination, coordinates);
    console.log(`Calculated distance: ${distanceKm.toFixed(0)}km`);

    // Get current estimated price using our enhanced algorithm
    const estimatedPrice = calculateFlightCost(distanceKm, destination, ORIGIN);

    // Get actual price from Google Flights
    // Use dates from test-flexible-search.test.ts that worked
    const departureDate = '2024-05-20';
    const returnDate = '2024-05-27';
    console.log(`Searching flights for dates: ${departureDate} - ${returnDate}`);

    try {
      const flightResult = await scraper.searchFlights(ORIGIN, destination, departureDate, returnDate);
      console.log('Flight search completed');

      if (!flightResult.success || !('price' in flightResult)) {
        console.error(`Failed to get flight price for ${destination}`);
        return;
      }

      const actualPrice = flightResult.price;
      const pricePerKm = actualPrice / distanceKm;
      const errorPercent = ((estimatedPrice - actualPrice) / actualPrice) * 100;

      // Get tier and factors for analysis
      const distanceTier = getDistanceTier(distanceKm);
      // These would ideally come from the flight cost calculation, but for now we'll estimate
      const regionalFactor = 1.1; // Default regional factor
      const popularityFactor = 1.0; // Default popularity factor

      // Store results
      results.push({
        origin: ORIGIN,
        destination,
        distanceKm,
        actualPrice,
        pricePerKm,
        estimatedPrice,
        errorPercent,
        distanceTier,
        regionalFactor,
        popularityFactor,
        dateCollected: new Date().toISOString(),
      });

      // Log individual route results
      console.log(`\nAnalyzing ${ORIGIN} to ${destination}:`);
      console.log(`Distance: ${distanceKm.toFixed(0)}km`);
      console.log(`Actual Price: $${actualPrice}`);
      console.log(`Estimated Price: $${estimatedPrice.toFixed(2)}`);
      console.log(`Price per KM: $${pricePerKm.toFixed(3)}`);
      console.log(`Error: ${errorPercent.toFixed(2)}%`);

      // Basic validation
      expect(distanceKm).toBeGreaterThan(0);
      expect(actualPrice).toBeGreaterThan(0);
    } catch (error) {
      console.error(`Error processing flight search for ${destination}:`, error);
      throw error;
    }
  }, 120000); // Increased timeout for flight searches
});
