import { calculateFlightCost } from '../src/utils/flights';
import { CoordinatesMapping } from '../src/utils/coordinates';
import { getDistanceKmFromCities } from '../src/utils/distance';

// Test destinations
const TEST_DESTINATIONS = [
  'Tokyo, Japan',
  'Taipei, Taiwan',
  'Hong Kong',
  'Bangkok, Thailand',
  'Singapore',
];
const ORIGIN = 'Seoul, South Korea';

// Add coordinates for testing
const COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Seoul, South Korea': { lat: 37.5665, lng: 126.9780 },
  'Tokyo, Japan': { lat: 35.6762, lng: 139.6503 },
  'Taipei, Taiwan': { lat: 25.0330, lng: 121.5654 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
};

// Actual prices from Google Flights
const ACTUAL_PRICES: Record<string, number> = {
  'Tokyo, Japan': 249,
  'Taipei, Taiwan': 225,
  'Hong Kong': 203,
  'Bangkok, Thailand': 297,
  'Singapore': 399,
};

// Initialize coordinates
const coordinates = new CoordinatesMapping();
Object.entries(COORDINATES).forEach(([city, coords]) => {
  coordinates.addCity(city, coords);
});

console.log('Flight Cost Analysis:');
console.log('=====================');
console.log('Origin:', ORIGIN);
console.log();

let totalError = 0;
let totalAbsError = 0;

// Calculate and print results for each destination
TEST_DESTINATIONS.forEach(destination => {
  const distanceKm = getDistanceKmFromCities(ORIGIN, destination, coordinates);
  const estimatedPrice = calculateFlightCost(distanceKm, destination, ORIGIN);
  const actualPrice = ACTUAL_PRICES[destination];
  const errorPercent = ((estimatedPrice - actualPrice) / actualPrice) * 100;

  totalError += errorPercent;
  totalAbsError += Math.abs(errorPercent);

  console.log(`Destination: ${destination}`);
  console.log(`Distance: ${distanceKm.toFixed(0)} km`);
  console.log(`Estimated Price: $${estimatedPrice}`);
  console.log(`Actual Price: $${actualPrice}`);
  console.log(`Error: ${errorPercent.toFixed(2)}%`);
  console.log();
});

console.log('Summary:');
console.log(`Average Error: ${(totalError / TEST_DESTINATIONS.length).toFixed(2)}%`);
console.log(`Average Absolute Error: ${(totalAbsError / TEST_DESTINATIONS.length).toFixed(2)}%`);
