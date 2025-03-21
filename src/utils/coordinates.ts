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
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ",",
      quote: '"',
      relax_quotes: true,
      trim: true
    }) as CoordinateRecord[];

    const mapping = new CoordinatesMapping();

    for (const rec of records) {
      const coords = {
        lat: parseFloat(rec.lat),
        lng: parseFloat(rec.lng),
      };

      if (isNaN(coords.lat) || isNaN(coords.lng)) {
        continue;
      }

      // Add both formats for US cities
      if (rec.iso2 === "US") {
        const usaFormat = `${rec.city}, USA`;
        mapping.addCity(usaFormat, coords);
        mapping.addCityVariant(usaFormat.toLowerCase(), usaFormat);
      }

      // Add standard format with country
      const standardFormat = `${rec.city}, ${rec.country}`;
      mapping.addCity(standardFormat, coords);
      mapping.addCityVariant(standardFormat.toLowerCase(), standardFormat);

      // Add city name only for unique cities
      mapping.addCity(rec.city, coords);
      mapping.addCityVariant(rec.city.toLowerCase(), rec.city);
    }

    console.log(`Loaded ${mapping.size()} coordinate entries`);
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    // No default mapping - force use of database
    const defaultMapping = new CoordinatesMapping();
    return defaultMapping;
  }
}
