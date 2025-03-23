import { AirportCode, DatabaseService } from "./database";
import { Coordinates } from "./types";

export class CoordinatesMapping {
  private _cityCoordinates: Map<string, { lat: number; lng: number }>;

  constructor() {
    this._cityCoordinates = new Map();
  }

  addCity(city: string, coordinates: { lat: number; lng: number }) {
    this._cityCoordinates.set(city, coordinates);
  }

  getCoordinates(city: string): { lat: number; lng: number } | undefined {
    return this._cityCoordinates.get(city);
  }

  hasCity(city: string): boolean {
    return this._cityCoordinates.has(city);
  }

  getCityNames(): string[] {
    return Array.from(this._cityCoordinates.keys());
  }
}

// Fuzzy matching function
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

function calculateSimilarity(query: string, candidate: string): number {
  // Split into city and country parts
  const [queryCity = "", queryCountry = ""] = query.toLowerCase().trim().split(/,\s*/);
  const [candidateCity = "", candidateCountry = ""] = candidate.toLowerCase().trim().split(/,\s*/);

  // Calculate city similarity
  const cityDistance = levenshteinDistance(queryCity, candidateCity);
  const cityMaxLength = Math.max(queryCity.length, candidateCity.length);
  const citySimilarity = cityMaxLength === 0 ? 1.0 : 1 - cityDistance / cityMaxLength;

  // Calculate country similarity if both have country parts
  if (queryCountry && candidateCountry) {
    const countryDistance = levenshteinDistance(queryCountry, candidateCountry);
    const countryMaxLength = Math.max(queryCountry.length, candidateCountry.length);
    const countrySimilarity = countryMaxLength === 0 ? 1.0 : 1 - countryDistance / countryMaxLength;

    // Weight city similarity more heavily than country similarity
    return citySimilarity * 0.7 + countrySimilarity * 0.3;
  }

  // If no country parts, just use city similarity
  return citySimilarity;
}

export async function findBestMatch(query: string, candidates: string[]): Promise<{ match: string; similarity: number }> {
  let bestMatch = "";
  let bestSimilarity = 0;

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(query, candidate);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  return { match: bestMatch, similarity: bestSimilarity };
}

export async function getAirportCoordinates(iataCode: string): Promise<Coordinates | undefined> {
  const db = DatabaseService.getInstance();
  const airports = await db.getAirportCodes(iataCode);
  if (airports.length === 0) return undefined;

  const coordinates = airports[0].coordinates;
  if (!coordinates) return undefined;

  const [lat, lng] = coordinates.split(',').map(Number);
  if (isNaN(lat) || isNaN(lng)) return undefined;

  return { lat, lng };
}

/**
 * Get city coordinates with improved fuzzy matching
 * Tries multiple strategies to find the best match:
 * 1. Exact match
 * 2. Fuzzy matching
 * 3. Nearest airport lookup as fallback
 */
export async function getCityCoordinates(cityName: string): Promise<Coordinates[]> {
  const db = DatabaseService.getInstance();

  // Try exact match first
  const exactMatches = await db.getCityCoordinates(cityName);
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Try more aggressive fuzzy matching if exact match fails
  const fuzzyMatches = await findCityCoordinatesByFuzzyMatching(cityName);
  if (fuzzyMatches.length > 0) {
    return fuzzyMatches;
  }

  // Last resort: Find nearest airport and use its coordinates
  const airportCoordinates = await findNearestAirportCoordinates(cityName);
  if (airportCoordinates) {
    return [airportCoordinates];
  }

  // Return empty array if all strategies fail
  return [];
}

/**
 * Find city coordinates using fuzzy matching against all cities in database
 */
async function findCityCoordinatesByFuzzyMatching(cityName: string): Promise<Coordinates[]> {
  const db = DatabaseService.getInstance();
  const allCities = await db.getAllCityNames();

  // Skip if no cities in database
  if (allCities.length === 0) {
    return [];
  }

  // Find best match using our existing fuzzy matching function
  const { match, similarity } = await findBestMatch(cityName, allCities);

  // Apply a lower threshold for fuzzy matching city names
  const FUZZY_MATCH_THRESHOLD = 0.5; // Even more permissive threshold for problem cities

  if (similarity >= FUZZY_MATCH_THRESHOLD) {
    console.log(`Fuzzy match found for ${cityName}: ${match} (similarity: ${(similarity * 100).toFixed(1)}%)`);
    return db.getCityCoordinates(match);
  }

  return [];
}

/**
 * Find coordinates of nearest airport to the city
 */
async function findNearestAirportCoordinates(cityName: string): Promise<Coordinates | undefined> {
  const db = DatabaseService.getInstance();

  // Try to find all airports that might be related to this city
  const cityPart = cityName.split(',')[0].trim();
  const cityWords = cityPart.toLowerCase().split(/\s+/);

  // Get all airports from database
  const allAirports = await db.getAllAirports();

  // Score each airport based on text similarity to the city name
  const scoredAirports = allAirports.map((airport: AirportCode) => {
    const airportCity = airport.city.toLowerCase();
    const airportMunicipality = airport.municipality?.toLowerCase() ?? '';

    // Calculate text similarity score with more sophisticated matching
    let score = 0;

    // Exact word matches are highly valued
    cityWords.forEach(word => {
      if (word.length >= 3) { // Only consider words with 3+ characters
        if (airportCity.includes(word) || airportMunicipality.includes(word)) {
          score += 2; // Double score for exact matches of significant words
        }

        // Check for substring matches
        if (airportCity.length >= 4 && word.length >= 4) {
          // Check for partial matches - beginning or ending of words
          if (airportCity.startsWith(word.substring(0, 3)) ||
              airportCity.endsWith(word.substring(word.length - 3))) {
            score += 0.5;
          }
        }
      }
    });

    // Add extra score for exact name match
    if (cityPart.toLowerCase() === airportCity || cityPart.toLowerCase() === airportMunicipality) {
      score += 10; // High bonus for exact city name match
    }

    // Add extra points for country matching if available
    const cityCountry = cityName.split(',')[1]?.trim().toLowerCase() ?? '';
    if (cityCountry && cityCountry === airport.country.toLowerCase()) {
      score += 5; // Strong bonus for country match
    }

    return {
      airport,
      score
    };
  });

  // Sort by score and get top match
  scoredAirports.sort((a: { airport: AirportCode; score: number }, b: { airport: AirportCode; score: number }) => b.score - a.score);

  // Return coordinates of best matching airport if any match was found
  if (scoredAirports.length > 0 && scoredAirports[0].score > 0) {
    const bestAirport = scoredAirports[0].airport;
    console.log(`Using airport coordinates for ${cityName}: ${bestAirport.code} (${bestAirport.city}, ${bestAirport.country})`);

    // Parse coordinates
    if (bestAirport.coordinates) {
      const [lat, lng] = bestAirport.coordinates.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }

  return undefined;
}
