import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CoordinatesMapping } from '../src/utils/coordinates';
import { getDistanceKmFromCities } from '../src/utils/distance';
import { GoogleFlightsScraper } from '../src/utils/google-flights-scraper';
import { calculateFlightCost } from '../src/utils/flights';

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
}

// Helper function to identify distance tier
function getDistanceTier(distanceKm: number): string {
  if (distanceKm < 500) return 'Very Short (<500km)';
  if (distanceKm < 1500) return 'Short (500-1500km)';
  if (distanceKm < 4000) return 'Medium (1500-4000km)';
  if (distanceKm < 8000) return 'Long (4000-8000km)';
  return 'Very Long (>8000km)';
}

// Test with all cities from the list
const TEST_DESTINATIONS = [
  'Hong Kong',
  'Denver, USA',
  'Milan, Italy',
  'Barcelona, Spain',
  'Las Vegas, USA',
  'San Francisco, USA',
  'Turin, Italy',
  'Grapevine, TX, USA',
  'San Jose, USA',
  'Chicago, USA',
  'London, UK',
  'Bangkok, Thailand',
  'Berlin, Germany',
  'Taipei, Taiwan',
  'Paris, France',
  'Ho Chi Minh, Vietnam',
  'Seoul, Korea',
  'Montreal, Canada',
  'Tokyo, Japan',
  'Austin, USA',
  'Singapore',
  'Dubai, UAE',
  'Amsterdam, Netherlands',
  'Lisbon, Portugal',
  'Abu Dhabi, UAE',
  'Toronto, Canada',
  'San Diego, USA',
  'Jakarta, Indonesia',
  'Prague, Czech Republic',
  'Seattle, USA',
  'Zurich, Switzerland',
  'Brooklyn, USA',
  'Cannes, France',
  'Kyoto, Japan',
  'Geneva, Switzerland',
  'New York, USA',
  'Florence, Italy',
  'Helsinki, Finland',
  'Boston, USA',
  'Arlington, VA, USA',
  'Munich, Germany',
  'Vilnius, Lithuania'
];

// For initial testing, use a subset
const INITIAL_TEST_DESTINATIONS = [
  'Tokyo, Japan',
  'Taipei, Taiwan',
  'Hong Kong',
  'Bangkok, Thailand',
  'Singapore',
  'London, UK',
  'New York, USA',
  'San Francisco, USA',
  'Paris, France',
  'Berlin, Germany'
];

// Set to true to test all destinations, false for initial subset
const shouldTestAllDestinations = false;
const DESTINATIONS_TO_TEST = shouldTestAllDestinations ? TEST_DESTINATIONS : INITIAL_TEST_DESTINATIONS;
const ORIGIN = 'Seoul, South Korea';

// Add coordinates for testing
const COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Seoul, South Korea': { lat: 37.5665, lng: 126.9780 },
  'Tokyo, Japan': { lat: 35.6762, lng: 139.6503 },
  'Taipei, Taiwan': { lat: 25.0330, lng: 121.5654 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'London, UK': { lat: 51.5074, lng: -0.1278 },
  'New York, USA': { lat: 40.7128, lng: -74.0060 },
  'San Francisco, USA': { lat: 37.7749, lng: -122.4194 },
  'Paris, France': { lat: 48.8566, lng: 2.3522 },
  'Berlin, Germany': { lat: 52.5200, lng: 13.4050 },
  'Denver, USA': { lat: 39.7392, lng: -104.9903 },
  'Milan, Italy': { lat: 45.4642, lng: 9.1900 },
  'Barcelona, Spain': { lat: 41.3851, lng: 2.1734 },
  'Las Vegas, USA': { lat: 36.1699, lng: -115.1398 },
  'Turin, Italy': { lat: 45.0703, lng: 7.6869 },
  'Grapevine, TX, USA': { lat: 32.9343, lng: -97.0781 },
  'San Jose, USA': { lat: 37.3382, lng: -121.8863 },
  'Chicago, USA': { lat: 41.8781, lng: -87.6298 },
  'Ho Chi Minh, Vietnam': { lat: 10.8231, lng: 106.6297 },
  'Montreal, Canada': { lat: 45.5017, lng: -73.5673 },
  'Austin, USA': { lat: 30.2672, lng: -97.7431 },
  'Dubai, UAE': { lat: 25.2048, lng: 55.2708 },
  'Amsterdam, Netherlands': { lat: 52.3676, lng: 4.9041 },
  'Lisbon, Portugal': { lat: 38.7223, lng: -9.1393 },
  'Abu Dhabi, UAE': { lat: 24.4539, lng: 54.3773 },
  'Toronto, Canada': { lat: 43.6532, lng: -79.3832 },
  'San Diego, USA': { lat: 32.7157, lng: -117.1611 },
  'Jakarta, Indonesia': { lat: -6.2088, lng: 106.8456 },
  'Prague, Czech Republic': { lat: 50.0755, lng: 14.4378 },
  'Seattle, USA': { lat: 47.6062, lng: -122.3321 },
  'Zurich, Switzerland': { lat: 47.3769, lng: 8.5417 },
  'Brooklyn, USA': { lat: 40.6782, lng: -73.9442 },
  'Cannes, France': { lat: 43.5528, lng: 7.0174 },
  'Kyoto, Japan': { lat: 35.0116, lng: 135.7681 },
  'Geneva, Switzerland': { lat: 46.2044, lng: 6.1432 },
  'Florence, Italy': { lat: 43.7696, lng: 11.2558 },
  'Helsinki, Finland': { lat: 60.1699, lng: 24.9384 },
  'Boston, USA': { lat: 42.3601, lng: -71.0589 },
  'Arlington, VA, USA': { lat: 38.8799, lng: -77.1068 },
  'Munich, Germany': { lat: 48.1351, lng: 11.5820 },
  'Vilnius, Lithuania': { lat: 54.6872, lng: 25.2797 }
};

describe('Comprehensive Distance-Based Price Analysis', () => {
  let scraper: GoogleFlightsScraper;
  let coordinates: CoordinatesMapping;
  const results: RouteAnalysis[] = [];

  // Create output directory
  const outputDir = join(process.cwd(), 'test-results');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  beforeAll(async () => {
    // Initialize Google Flights scraper
    scraper = new GoogleFlightsScraper();
    await scraper.initialize({ headless: false });
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

    // Save results to CSV
    const csvHeader = 'Origin,Destination,Distance (km),Actual Price,Estimated Price,Error %,Price per km,Distance Tier,Date Collected';
    const csvRows = results.map(r =>
      `"${r.origin}","${r.destination}",${r.distanceKm.toFixed(0)},${r.actualPrice},${r.estimatedPrice},${r.errorPercent.toFixed(2)},${r.pricePerKm.toFixed(3)},"${r.distanceTier}","${r.dateCollected}"`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvFilePath = join(outputDir, `flight-price-analysis-${timestamp}.csv`);
    writeFileSync(csvFilePath, csvContent);
    console.log(`\nResults saved to: ${csvFilePath}`);
  });

  // Test each destination
  test.each(DESTINATIONS_TO_TEST)('Analyzing route: Seoul to %s', async (destination) => {
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

      // Get tier for analysis
      const distanceTier = getDistanceTier(distanceKm);

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
  }, 300000); // Increased timeout for multiple flight searches
});
