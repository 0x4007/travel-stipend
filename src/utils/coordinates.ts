import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { AirportCode, Coordinates } from "./types";

// Airport coordinates mapping class
export class AirportCoordinatesMapping {
  private _airportMap: { [code: string]: Coordinates } = {};

  addAirport(code: string, coordinates: Coordinates): void {
    this._airportMap[code] = coordinates;
  }

  getCoordinates(code: string): Coordinates | undefined {
    return this._airportMap[code];
  }

  size(): number {
    return Object.keys(this._airportMap).length;
  }
}

// City coordinates mapping class with fuzzy matching capabilities
export class CoordinatesMapping {
  private _cityMap: { [city: string]: Coordinates } = {};
  private _cityNames: string[] = [];
  private _cityVariants: { [normalizedName: string]: string } = {};

  addCity(cityName: string, coordinates: Coordinates): void {
    this._cityMap[cityName] = coordinates;
    this._cityNames.push(cityName);
  }

  addCityVariant(normalizedName: string, originalName: string): void {
    if (!normalizedName || !originalName) return;
    this._cityVariants[normalizedName] = originalName;
  }

  getCoordinates(cityName: string): Coordinates | undefined {
    return this._cityMap[cityName];
  }

  getCityNames(): string[] {
    return this._cityNames;
  }

  getCityVariant(normalizedName: string): string | undefined {
    return this._cityVariants[normalizedName];
  }

  size(): number {
    return this._cityNames.length;
  }
}

// Load coordinates from CSV file
interface CoordinateRecord {
  city: string;
  city_ascii: string;
  lat: string;
  lng: string;
  country: string;
  iso2: string;
  iso3: string;
  admin_name: string;
  capital: string;
  population: string;
  id: string;
}

// Fuzzy matching functions
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

function calculateSimilarity(a: string, b: string): number {
  // Normalize strings for comparison
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedA, normalizedB);

  // Calculate similarity as a percentage (0-1)
  // The max possible distance is the length of the longer string
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 1.0; // Both strings are empty

  return 1 - distance / maxLength;
}

export function findBestMatch(query: string, candidates: string[]): { match: string; similarity: number } {
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

export function loadAirportCoordinatesData(filePath: string): AirportCoordinatesMapping {
  try {
    const content = readFileSync(filePath, "utf-8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    }) as AirportCode[];

    const mapping = new AirportCoordinatesMapping();

    for (const rec of records) {
      if (!rec.iata_code || !rec.coordinates) continue;

      const [lat, lng] = rec.coordinates.split(",").map((coord) => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) continue;

      mapping.addAirport(rec.iata_code, { lat, lng });
    }

    console.log(`Loaded ${mapping.size()} airport coordinate entries`);
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    const defaultMapping = new AirportCoordinatesMapping();
    return defaultMapping;
  }
}

export function loadCoordinatesData(filePath: string): CoordinatesMapping {
  try {
    const content = readFileSync(filePath, "utf-8");
    const records: CoordinateRecord[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });

    const mapping = new CoordinatesMapping();

    for (const rec of records) {
      // Create standard city format: "City, Country"
      const cityName = `${rec.city}, ${rec.country}`;
      const coords = {
        lat: parseFloat(rec.lat),
        lng: parseFloat(rec.lng),
      };

      // Add entry with full country name
      mapping.addCity(cityName, coords);
      mapping.addCityVariant(cityName.toLowerCase(), cityName);

      // Also add entry with ISO code for countries commonly referenced with abbreviations
      if (rec.iso2 && ["US", "UK", "UAE"].includes(rec.iso2)) {
        const cityWithCode = `${rec.city}, ${rec.iso2}${rec.iso2 === "US" ? "A" : ""}`;
        mapping.addCity(cityWithCode, coords);
        mapping.addCityVariant(cityWithCode.toLowerCase(), cityWithCode);
      }

      // Add entry without country for unique city names
      mapping.addCity(rec.city, coords);
      mapping.addCityVariant(rec.city.toLowerCase(), rec.city);
    }

    console.log(`Loaded ${mapping.size()} coordinate entries`);
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    // Fallback to a minimal set of coordinates if file can't be loaded
    const defaultMapping = new CoordinatesMapping();

    defaultMapping.addCity("Seoul, Korea", { lat: 37.5665, lng: 126.978 });
    defaultMapping.addCityVariant("seoul, korea", "Seoul, Korea");

    defaultMapping.addCity("Tokyo, Japan", { lat: 35.6895, lng: 139.6917 });
    defaultMapping.addCityVariant("tokyo, japan", "Tokyo, Japan");

    defaultMapping.addCity("Jakarta, Indonesia", { lat: -6.2088, lng: 106.8456 });
    defaultMapping.addCityVariant("jakarta, indonesia", "Jakarta, Indonesia");

    return defaultMapping;
  }
}
