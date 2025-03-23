import { normalizeCityCountry, getCountryCode, getCountryName } from "../src/utils/country-codes";
import { CoordinatesMapping, getCityCoordinates } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";
import defaultList from "./default-list.json";

const ORIGIN = "Seoul, South Korea";

async function testCountryCodeMapping() {
  console.log("=== COUNTRY CODE MAPPING TEST ===");

  // Test country code lookup
  const countryTests = [
    { input: "USA", expected: "US" },
    { input: "United States", expected: "US" },
    { input: "Korea", expected: "KR" },
    { input: "South Korea", expected: "KR" },
    { input: "Republic of Korea", expected: "KR" },
    { input: "UK", expected: "GB" },
    { input: "United Kingdom", expected: "GB" },
    { input: "Britain", expected: "GB" },
    { input: "Germany", expected: "DE" },
    { input: "Deutschland", expected: "DE" },
    { input: "Japan", expected: "JP" },
    { input: "France", expected: "FR" },
    { input: "Spain", expected: "ES" },
    { input: "España", expected: "ES" },
    { input: "UAE", expected: "AE" },
    { input: "United Arab Emirates", expected: "AE" },
    { input: "Czech Republic", expected: "CZ" },
    { input: "Czechia", expected: "CZ" },
    { input: "Vietnam", expected: "VN" },
    { input: "Viet Nam", expected: "VN" }
  ];

  console.log("\nTesting country code lookup:");
  for (const test of countryTests) {
    const code = getCountryCode(test.input);
    const result = code === test.expected ? "✅" : "❌";
    console.log(`${result} ${test.input} => ${code} (expected: ${test.expected})`);
  }

  // Test country name lookup
  const nameTests = [
    { input: "US", expected: "United States" },
    { input: "GB", expected: "United Kingdom" },
    { input: "KR", expected: "Korea, Republic of" },
    { input: "JP", expected: "Japan" },
    { input: "DE", expected: "Germany" },
    { input: "AE", expected: "United Arab Emirates" },
    { input: "FR", expected: "France" },
    { input: "ES", expected: "Spain" },
    { input: "CH", expected: "Switzerland" }
  ];

  console.log("\nTesting country name lookup:");
  for (const test of nameTests) {
    const name = getCountryName(test.input);
    const result = name?.includes(test.expected) ? "✅" : "❌";
    console.log(`${result} ${test.input} => ${name} (expected to include: ${test.expected})`);
  }

  // Test city-country normalization
  const normalizationTests = [
    { input: "New York, USA", expectedCity: "New York", expectedCountry: "US" },
    { input: "London, UK", expectedCity: "London", expectedCountry: "GB" },
    { input: "Paris, France", expectedCity: "Paris", expectedCountry: "FR" },
    { input: "Seoul, Korea", expectedCity: "Seoul", expectedCountry: "KR" },
    { input: "Tokyo, JP", expectedCity: "Tokyo", expectedCountry: "JP" },
    { input: "Berlin, DE", expectedCity: "Berlin", expectedCountry: "DE" },
    { input: "Madrid, España", expectedCity: "Madrid", expectedCountry: "ES" },
    { input: "Prague, Czechia", expectedCity: "Prague", expectedCountry: "CZ" },
    { input: "Singapore", expectedCity: "Singapore", expectedCountry: undefined },
    { input: "Hong Kong", expectedCity: "Hong Kong", expectedCountry: undefined }
  ];

  console.log("\nTesting city-country normalization:");
  for (const test of normalizationTests) {
    const { city, countryCode } = normalizeCityCountry(test.input);
    const cityResult = city === test.expectedCity ? "✅" : "❌";
    const countryResult = countryCode === test.expectedCountry ? "✅" : "❌";
    console.log(`${cityResult} ${countryResult} ${test.input} => City: ${city}, Country: ${countryCode} (expected: ${test.expectedCity}, ${test.expectedCountry})`);
  }

  // Test distance calculation with default list
  console.log("\nTesting distance calculation with default list:");
  const coordinates = new CoordinatesMapping();

  // Add origin coordinates
  const originCoords = await getCityCoordinates(ORIGIN);
  if (originCoords.length > 0) {
    coordinates.addCity(ORIGIN, originCoords[0]);
    console.log(`Added coordinates for ${ORIGIN}`);
  }

  // Test distance calculation for a subset of destinations
  const testDestinations = defaultList.slice(0, 10);

  for (const destination of testDestinations) {
    try {
      // Add destination coordinates
      const destCoords = await getCityCoordinates(destination);
      if (destCoords.length > 0) {
        coordinates.addCity(destination, destCoords[0]);
        console.log(`Added coordinates for ${destination}`);

        // Calculate distance
        const distance = await getDistanceKmFromCities(ORIGIN, destination, coordinates);
        console.log(`Distance from ${ORIGIN} to ${destination}: ${distance.toFixed(0)}km`);
      } else {
        console.log(`❌ No coordinates found for ${destination}`);
      }
    } catch (error) {
      console.error(`Error calculating distance for ${destination}:`, error);
    }
  }
}

testCountryCodeMapping().catch(console.error);
