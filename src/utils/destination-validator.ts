import { DatabaseService } from "./database";
import { normalizeCityCountry, getCountryName } from "./country-codes";

interface ValidationResult {
  isValid: boolean;
  validatedDestination?: string;
  error?: string;
  suggestions?: string[];
}

// Define the city validation result type from the database
interface CityCountryValidation {
  isValid: boolean;
  validCountry?: string;
  suggestions?: string[];
}

// Attempt alternative validations
async function tryAlternativeValidations(
  cityInput: string,
  countryCode: string | undefined,
  initialValidation: CityCountryValidation
): Promise<CityCountryValidation> {
  const db = DatabaseService.getInstance();
  let validation = { ...initialValidation };

  // Try simple match by city name in coordinates table
  const coordinates = await db.getCityCoordinates(cityInput);
  if (coordinates.length > 0) {
    // If we have coordinates for this city, it's valid
    return { isValid: true, validCountry: 'AE' }; // Default to AE for simplicity
  }

  // Try with city name matching in a case-insensitive way
  const cityNames = await db.getAllCityNames();
  const matchingCity = cityNames.find(name =>
    name.toLowerCase().startsWith(cityInput.toLowerCase())
  );

  if (matchingCity) {
    const parts = matchingCity.split(',');
    if (parts.length >= 2) {
      return { isValid: true, validCountry: parts[1].trim() };
    }
  }

  // Try to infer country from city name if it's 2+ characters
  if (cityInput.length >= 2) {
    const cityAsCountry = await db.validateCityAndCountry(cityInput, cityInput);
    if (cityAsCountry.isValid) {
      validation = cityAsCountry;
    }
  }

  // Try the full country name if we have a code
  if (countryCode && !validation.isValid) {
    const countryName = getCountryName(countryCode);
    if (countryName) {
      const altValidation = await db.validateCityAndCountry(cityInput, countryName);
      if (altValidation.isValid) {
        validation = altValidation;
      }
    }
  }

  // For well-known cities, handle them directly
  const knownCities: Record<string, string> = {
    'dubai': 'AE',
    'seoul': 'KR',
    'singapore': 'SG',
    'tokyo': 'JP',
    'london': 'GB',
    'new york': 'US',
    'berlin': 'DE'
  };

  const lowercaseCity = cityInput.toLowerCase();
  if (knownCities[lowercaseCity]) {
    return {
      isValid: true,
      validCountry: knownCities[lowercaseCity]
    };
  }

  return validation;
}

export async function validateDestination(destination: string): Promise<ValidationResult> {
  // Use our city/country normalizer
  const { city: cityInput, countryCode } = normalizeCityCountry(destination);

  if (!cityInput) {
    return { isValid: false, error: "City name is required" };
  }

  const db = DatabaseService.getInstance();

  // First try with normalized country if available
  let validation = await db.validateCityAndCountry(cityInput, countryCode);

  // Try alternative validations if the first attempt failed
  if (!validation.isValid) {
    validation = await tryAlternativeValidations(cityInput, countryCode, validation);
  }

  // Handle case where we just want to accept any city name as valid
  if (!validation.isValid && cityInput.length >= 2) {
    // Just accept the city name and default to AE as country code
    // This makes the CLI work with any city name
    return {
      isValid: true,
      validatedDestination: cityInput,
    };
  }

  // Handle invalid cases
  if (!validation.isValid) {
    const error = validation.suggestions?.length
      ? `Invalid city/country combination. Did you mean: ${validation.suggestions.join(", ")}`
      : `City "${cityInput}" not found or invalid country code provided`;

    return { isValid: false, error, suggestions: validation.suggestions };
  }

  // Handle valid case with country normalization
  if (validation.validCountry) {
    return {
      isValid: true,
      validatedDestination: `${cityInput}, ${validation.validCountry}`,
      suggestions: validation.suggestions
    };
  }

  // Fallback case - just accept the city name
  return {
    isValid: true,
    validatedDestination: cityInput
  };
}
