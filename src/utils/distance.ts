import { SIMILARITY_THRESHOLD } from "./constants";
import { CoordinatesMapping, findBestMatch, getAirportCoordinates } from "./coordinates";
import { Coordinates } from "./types";

// Convert degrees to radians
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate distance between two coordinates using the Haversine formula
export function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(coord2.lat - coord1.lat);
  const dLon = deg2rad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(coord1.lat)) * Math.cos(deg2rad(coord2.lat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Try to find city by exact or normalized match
function findCityByExactMatch(cityName: string, coordinates: CoordinatesMapping): Coordinates | undefined {
  // Try exact match first
  const exactMatch = coordinates.getCoordinates(cityName);
  if (exactMatch) {
    return exactMatch;
  }

  // Try normalized version
  const normalizedName = cityName.toLowerCase().trim();
  const normalizedMatch = coordinates.getCoordinates(normalizedName);
  if (normalizedMatch) {
    return normalizedMatch;
  }

  return undefined;
}

// Try to find city by fuzzy matching
async function findCityByFuzzyMatch(cityName: string, coordinates: CoordinatesMapping): Promise<Coordinates | undefined> {
  const cityNames = coordinates.getCityNames();
  const { match, similarity } = await findBestMatch(cityName, cityNames);

  if (similarity >= SIMILARITY_THRESHOLD) {
    console.log(`Fuzzy match found for "${cityName}": "${match}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
    return coordinates.getCoordinates(match);
  }

  return undefined;
}

// Helper function to find city coordinates with fuzzy matching
async function findCityCoordinates(cityName: string, coordinates: CoordinatesMapping): Promise<Coordinates> {
  // Try exact match first
  const exactMatch = findCityByExactMatch(cityName, coordinates);
  if (exactMatch) {
    return exactMatch;
  }

  // If no exact match found, try fuzzy matching
  const fuzzyMatch = await findCityByFuzzyMatch(cityName, coordinates);
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  // Get best match info for error message
  try {
    const { match, similarity } = await findBestMatch(cityName, coordinates.getCityNames());
    console.warn(`No matching city found for: ${cityName} (best match: ${match}, similarity: ${(similarity * 100).toFixed(1)}%)`);
    return { lat: 0, lng: 0 }; // Return zeros instead of throwing
  } catch (error) {
    console.warn(`Error finding match for ${cityName}: ${error instanceof Error ? error.message : String(error)}`);
    return { lat: 0, lng: 0 }; // Return zeros on any error
  }
}

// Helper function to check if string is an airport code (3 uppercase letters)
function isAirportCode(str: string): boolean {
  return /^[A-Z]{3}$/.test(str);
}

// Get coordinates for either airport code or city name
async function getLocationCoordinates(location: string, coordinates: CoordinatesMapping): Promise<Coordinates> {
  // Check if it's an airport code
  if (isAirportCode(location)) {
    const airportCoords = await getAirportCoordinates(location);
    if (airportCoords) {
      return airportCoords;
    }
    // If no coordinates for airport code, fall back to city matching
    console.warn(`No coordinates found for airport code: ${location}, trying city matching`);
  }

  // Try city matching
  return findCityCoordinates(location, coordinates);
}

export async function getDistanceKmFromCities(
  originLocation: string,
  destinationLocation: string,
  coordinates: CoordinatesMapping
): Promise<number> {
  try {
    const originCoords = await findCityCoordinates(originLocation, coordinates);
    const destinationCoords = await findCityCoordinates(destinationLocation, coordinates);

    // Check if either coordinate is invalid (zeros)
    if ((originCoords.lat === 0 && originCoords.lng === 0) ||
        (destinationCoords.lat === 0 && destinationCoords.lng === 0)) {
      console.warn(`Cannot calculate distance: Invalid coordinates for ${originLocation} or ${destinationLocation}`);
      return NaN;
    }

    return haversineDistance(originCoords, destinationCoords);
  } catch (error) {
    console.error(`Error calculating distance between ${originLocation} and ${destinationLocation}: ${error instanceof Error ? error.message : String(error)}`);
    return NaN;
  }
}

interface DistanceTier {
  maxDistance: number;
  name: string;
}

const distanceTiers: DistanceTier[] = [
  { maxDistance: 200, name: "Micro (<200km)" },
  { maxDistance: 500, name: "Local (200-500km)" },
  { maxDistance: 1000, name: "Regional (500-1000km)" },
  { maxDistance: 1500, name: "Short-Haul (1000-1500km)" },
  { maxDistance: 2000, name: "Short-Plus (1500-2000km)" },
  { maxDistance: 2500, name: "Medium-Starter (2000-2500km)" },
  { maxDistance: 3000, name: "Medium (2500-3000km)" },
  { maxDistance: 3500, name: "Medium-Plus (3000-3500km)" },
  { maxDistance: 4000, name: "Long-Starter (3500-4000km)" },
  { maxDistance: 4500, name: "Long (4000-4500km)" },
  { maxDistance: 5000, name: "Long-Plus (4500-5000km)" },
  { maxDistance: 5500, name: "Extended-Starter (5000-5500km)" },
  { maxDistance: 6000, name: "Extended-Minus (5500-6000km)" },
  { maxDistance: 6500, name: "Extended-Middle (6000-6500km)" },
  { maxDistance: 7000, name: "Extended (6500-7000km)" },
  { maxDistance: 7500, name: "Extended-Plus (7000-7500km)" },
  { maxDistance: 8000, name: "Very-Long-Starter (7500-8000km)" },
  { maxDistance: 8500, name: "Very-Long-Starter-Minus (8000-8500km)" },
  { maxDistance: 9000, name: "Very-Long-Starter-Plus (8500-9000km)" },
  { maxDistance: 9500, name: "Very-Long (9000-9500km)" },
  { maxDistance: 10000, name: "Very-Long-Plus (9500-10000km)" },
  { maxDistance: 10500, name: "Ultra-Long-Starter (10000-10500km)" },
  { maxDistance: 11000, name: "Ultra-Long (10500-11000km)" },
  { maxDistance: 11500, name: "Ultra-Long-Plus (11000-11500km)" },
  { maxDistance: 12000, name: "Extreme-Long-Starter (11500-12000km)" },
  { maxDistance: 12500, name: "Extreme-Long (12000-12500km)" },
  { maxDistance: 13000, name: "Extreme-Long-Plus (12500-13000km)" },
  { maxDistance: 13500, name: "Maximum-Range-Starter (13000-13500km)" },
  { maxDistance: 14000, name: "Maximum-Range (13500-14000km)" },
];

// Function to get the distance tier based on kilometers
export function getDistanceTier(distanceKm: number): string {
  const tier = distanceTiers.find(t => distanceKm < t.maxDistance);
  return tier?.name ?? "Maximum-Range-Plus (>14000km)";
}

// Helper function to create a consistent key for distance caching
export function getDistanceKey(city1: string, city2: string): string {
  const cities = [city1, city2].sort((a, b) => a.localeCompare(b));
  return `${cities[0]}|${cities[1]}`;
}
