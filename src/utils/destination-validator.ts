import { DatabaseService } from "./database";

interface ValidationResult {
  isValid: boolean;
  validatedDestination?: string;
  error?: string;
  suggestions?: string[];
}

export async function validateDestination(destination: string): Promise<ValidationResult> {
  // Split and clean input
  // Handle input cleaning and normalization
  const [cityInput, rawCountryInput] = destination.split(",").map(s => s.trim());
  // Convert common country names to codes if provided
  const countryInput = rawCountryInput?.length === 2 ? rawCountryInput.toUpperCase() : rawCountryInput;

  if (!cityInput) {
    return {
      isValid: false,
      error: "City name is required"
    };
  }

  const db = DatabaseService.getInstance();
  const validation = await db.validateCityAndCountry(cityInput, countryInput);

  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.suggestions
        ? `Invalid city/country combination. Did you mean: ${validation.suggestions.join(", ")}`
          : `City "${cityInput}" not found or invalid country code provided`,
      suggestions: validation.suggestions
    };
  }

  // If no country was provided but we found a valid one, or if country needs normalization
  if (validation.validCountry) {
    const normalizedDestination = `${cityInput}, ${validation.validCountry}`;
    return {
      isValid: true,
      validatedDestination: normalizedDestination,
      suggestions: validation.suggestions?.map(s => {
        const [city, country] = s.split(",").map(part => part.trim());
        return `${city}, ${country}`;
      })
    };
  }

  return {
    isValid: false,
    error: "Invalid city/country combination",
    suggestions: validation.suggestions?.map(s => {
      const [city, country] = s.split(",").map(part => part.trim());
      return `${city}, ${country}`;
    })
  };
}
