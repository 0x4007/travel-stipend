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
  if (!countryCode || !validation.isValid) {
    validation = await tryAlternativeValidations(cityInput, countryCode, validation);
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

  // Fallback case
  return { isValid: false, error: "Invalid city/country combination", suggestions: validation.suggestions };
}
