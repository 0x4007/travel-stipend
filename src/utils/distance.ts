import { SIMILARITY_THRESHOLD } from "./constants";
import { CoordinatesMapping, findBestMatch } from "./coordinates";
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

// Helper function to find city coordinates with fuzzy matching
export function findCityCoordinates(cityName: string, coordinates: CoordinatesMapping): Coordinates {
  // Try exact match first
  const exactMatch = coordinates.getCoordinates(cityName);
  if (exactMatch) {
    return exactMatch;
  }

  // Try lowercase match with variants
  const normalizedName = cityName.toLowerCase().trim();
  const variantMatch = coordinates.getCityVariant(normalizedName);
  if (variantMatch) {
    const variantCoords = coordinates.getCoordinates(variantMatch);
    if (variantCoords) {
      return variantCoords;
    }
  }

  // If no match found, try fuzzy matching
  const cityNames = coordinates.getCityNames();
  const { match, similarity } = findBestMatch(cityName, cityNames);

  if (similarity >= SIMILARITY_THRESHOLD) {
    console.log(`Fuzzy match found for "${cityName}": "${match}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
    const fuzzyMatchCoords = coordinates.getCoordinates(match);
    if (fuzzyMatchCoords) {
      return fuzzyMatchCoords;
    }
  }

  throw new Error(`No matching city found for: ${cityName} (best match: ${match}, similarity: ${(similarity * 100).toFixed(1)}%)`);
}

// Get distance in kilometers between two cities
export function getDistanceKmFromCities(originCity: string, destinationCity: string, coordinates: CoordinatesMapping): number {
  const originCoords = findCityCoordinates(originCity, coordinates);
  const destinationCoords = findCityCoordinates(destinationCity, coordinates);
  return haversineDistance(originCoords, destinationCoords);
}
