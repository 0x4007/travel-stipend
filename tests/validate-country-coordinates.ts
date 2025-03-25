import { CoordinatesMapping, getCityCoordinates } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { calculateFlightCost } from "../src/utils/flights";
import { normalizeCityCountry, getCountryCode, getCountryName } from "../src/utils/country-codes";
import defaultList from "./default-list.json";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// Test configuration
const ORIGIN = "Seoul, South Korea";
const ALL_DESTINATIONS = defaultList;

interface DestinationValidation {
  destination: string;
  normalizedCity?: string;
  normalizedCountry?: string;
  hasCoordinates: boolean;
  distanceKm?: number;
  estimatedCost?: number;
  notes?: string;
}

/**
 * Comprehensive test of our country code mapping and coordinate system
 */
async function validateCountryCoordinates() {
  console.log("=== Country Code and Coordinate Validation ===");
  console.log(`Testing ${ALL_DESTINATIONS.length} destinations from default list`);

  // Initialize coordinates mapping
  const coordinates = new CoordinatesMapping();
  const results: DestinationValidation[] = [];
  const outputDir = join(process.cwd(), "test-results");

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Add origin coordinates
  const originCoords = await getCityCoordinates(ORIGIN);
  if (originCoords.length > 0) {
    coordinates.addCity(ORIGIN, originCoords[0]);
    console.log(`Added coordinates for ${ORIGIN}: ${JSON.stringify(originCoords[0])}`);
  } else {
    console.warn(`No coordinates found for origin ${ORIGIN}`);
    return;
  }

  // Test each destination
  for (const destination of ALL_DESTINATIONS) {
    console.log(`\nTesting: ${destination}`);
    const result: DestinationValidation = {
      destination,
      hasCoordinates: false,
    };

    try {
      // 1. Test city-country normalization
      const normalized = normalizeCityCountry(destination);
      result.normalizedCity = normalized.city;
      result.normalizedCountry = normalized.countryCode;
      console.log(`Normalized: City=${normalized.city}, Country=${normalized.countryCode ?? "N/A"}`);

      // 2. Test coordinate lookup
      const destCoords = await getCityCoordinates(destination);
      if (destCoords.length > 0) {
        coordinates.addCity(destination, destCoords[0]);
        result.hasCoordinates = true;
        console.log(`Found coordinates: ${JSON.stringify(destCoords[0])}`);

        // 3. Test distance calculation
        try {
          const distance = await getDistanceKmFromCities(ORIGIN, destination, coordinates);
          result.distanceKm = distance;
          console.log(`Distance from ${ORIGIN}: ${isNaN(distance) ? "Unknown" : `${Math.round(distance)}km`}`);

          // 4. Test price calculation
          if (!isNaN(distance)) {
            const price = calculateFlightCost(distance, destination, ORIGIN);
            result.estimatedCost = price;
            console.log(`Estimated flight cost: $${price.toFixed(2)}`);
          } else {
            result.notes = "Could not calculate distance";
          }
        } catch (error) {
          result.notes = `Distance calculation error: ${error instanceof Error ? error.message : String(error)}`;
          console.error(result.notes);
        }
      } else {
        result.notes = "No coordinates found";
        console.warn(result.notes);
      }
    } catch (error) {
      result.notes = `Error: ${error instanceof Error ? error.message : String(error)}`;
      console.error(result.notes);
    }

    results.push(result);
  }

  // Generate success rate statistics
  const totalDestinations = results.length;
  const normalizedDestinations = results.filter((r) => r.normalizedCountry !== undefined).length;
  const destinationsWithCoordinates = results.filter((r) => r.hasCoordinates).length;
  const destinationsWithDistance = results.filter((r) => r.distanceKm !== undefined && !isNaN(r.distanceKm)).length;

  console.log("\n=== Validation Results ===");
  console.log(`Total destinations tested: ${totalDestinations}`);
  console.log(`Destinations with country codes: ${normalizedDestinations} (${((normalizedDestinations / totalDestinations) * 100).toFixed(1)}%)`);
  console.log(`Destinations with coordinates: ${destinationsWithCoordinates} (${((destinationsWithCoordinates / totalDestinations) * 100).toFixed(1)}%)`);
  console.log(`Destinations with valid distances: ${destinationsWithDistance} (${((destinationsWithDistance / totalDestinations) * 100).toFixed(1)}%)`);

  // Save results to CSV
  const csvHeader = "Destination,Normalized City,Normalized Country,Has Coordinates,Distance (km),Estimated Cost,Notes";
  const csvRows = results.map((r) => {
    return [
      r.destination,
      r.normalizedCity ?? "",
      r.normalizedCountry ?? "",
      r.hasCoordinates ? "Yes" : "No",
      r.distanceKm !== undefined ? (isNaN(r.distanceKm) ? "Error" : Math.round(r.distanceKm)) : "",
      r.estimatedCost !== undefined ? r.estimatedCost.toFixed(2) : "",
      r.notes ?? "",
    ].join(",");
  });

  const csvContent = [csvHeader, ...csvRows].join("\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvFilePath = join(outputDir, `country-coordinate-validation-${timestamp}.csv`);
  writeFileSync(csvFilePath, csvContent);
  console.log(`\nResults saved to: ${csvFilePath}`);

  // Problems report
  const problemDestinations = results.filter((r) => !r.hasCoordinates || r.notes);
  if (problemDestinations.length > 0) {
    console.log("\n=== Destinations with Problems ===");
    problemDestinations.forEach((r) => {
      console.log(`${r.destination}: ${r.notes ?? (r.hasCoordinates ? "" : "No coordinates found")}`);
    });
  }
}

// Run the test
validateCountryCoordinates().catch(console.error);
