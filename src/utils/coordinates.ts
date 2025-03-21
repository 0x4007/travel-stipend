import { DatabaseService } from "./database";
import { Coordinates } from "./types";

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
  return db.getAirportCoordinates(iataCode);
}

export async function getCityCoordinates(cityName: string): Promise<Coordinates[]> {
  const db = DatabaseService.getInstance();
  return db.getCityCoordinates(cityName);
}
