import * as isoCountries from 'i18n-iso-countries';
import { countries } from 'countries-list';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Initialize the ISO countries data with English locale
isoCountries.registerLocale(enLocale);

/**
 * Maps between country names and ISO 3166-1 alpha-2 country codes
 */

// Common country name variations that might not be in the standard mappings
const countryNameVariations: Record<string, string> = {
  // Middle East
  'UAE': 'AE',
  'United Arab Emirates': 'AE',

  // North America
  'USA': 'US',
  'United States': 'US',
  'United States of America': 'US',
  'America': 'US',
  'U.S.': 'US',
  'U.S.A.': 'US',

  // Europe
  'UK': 'GB',
  'United Kingdom': 'GB',
  'Britain': 'GB',
  'Great Britain': 'GB',
  'England': 'GB',
  'Czechia': 'CZ',
  'Czech Republic': 'CZ',
  'Deutschland': 'DE',
  'Holland': 'NL',
  'The Netherlands': 'NL',
  'Suomi': 'FI',
  'Schweiz': 'CH',
  'Suisse': 'CH',
  'Svizzera': 'CH',
  'España': 'ES',
  'Italia': 'IT',
  'Francaise': 'FR',

  // Asia
  'Korea': 'KR',
  'South Korea': 'KR',
  'Republic of Korea': 'KR',
  'ROK': 'KR',
  'Vietnam': 'VN',
  'Viet Nam': 'VN',
  'Japan': 'JP',
  'Nippon': 'JP',
  'Taiwan': 'TW',
  'Taiwan, Province of China': 'TW',
  'Republic of China': 'TW',
  'Hong Kong': 'HK',
  'HK': 'HK',
  'Singapore': 'SG',
  'Thailand': 'TH',
  'Russia': 'RU',
  'Russian Federation': 'RU',
  'Indonesia': 'ID',

  // US States treated as countries in some inputs
  'Texas': 'US',
  'TX': 'US',
  'California': 'US',
  'CA': 'US',
  'Florida': 'US',
  'FL': 'US',
  'New York': 'US',
  'NY': 'US',
  'Virginia': 'US',
  'VA': 'US'
};

/**
 * Resolves a country name to its ISO 3166-1 alpha-2 code
 * @param countryName The country name to resolve
 * @returns The ISO country code or undefined if not found
 */
export function getCountryCode(countryName: string): string | undefined {
  if (!countryName) return undefined;

  // Clean up input
  const cleanName = countryName.trim();

  // Check direct variations map first
  if (countryNameVariations[cleanName]) {
    return countryNameVariations[cleanName];
  }

  // Try standard library
  const code = isoCountries.getAlpha2Code(cleanName, 'en');
  if (code) return code;

  // If not found, try fuzzy matching against country names
  const countryEntries = Object.entries(countries);
  let matchedCode: string | undefined;

  for (const [code, info] of countryEntries) {
    if (info.name.toLowerCase() === cleanName.toLowerCase()) {
      matchedCode = code;
      break;
    }
  }

  return matchedCode;
}

/**
 * Gets the full country name from an ISO 3166-1 alpha-2 code
 * @param code The ISO country code
 * @returns The country name or undefined if not found
 */
export function getCountryName(code: string): string | undefined {
  if (!code) return undefined;

  const cleanCode = code.trim().toUpperCase();

  // Use the i18n-iso-countries library
  return isoCountries.getName(cleanCode, 'en');
}

/**
 * Normalizes a city and country input to standard format
 * @param cityWithCountry A string like "City, Country" or "City, CC"
 * @returns An object with normalized city and country code
 */
export function normalizeCityCountry(cityWithCountry: string): { city: string; countryCode: string | undefined } {
  // Split by comma
  const parts = cityWithCountry.split(/,\s*/);
  const city = parts[0].trim();

  // If no country part, return just the city
  if (parts.length < 2) {
    return { city, countryCode: undefined };
  }

  const countryPart = parts[1].trim();

  // First check if the country part is a special mapped value like "UK"
  if (countryNameVariations[countryPart]) {
    return { city, countryCode: countryNameVariations[countryPart] };
  }

  // If it's already a valid 2-letter ISO code, use it directly
  if (countryPart.length === 2 && countryPart === countryPart.toUpperCase() && isoCountries.isValid(countryPart)) {
    return { city, countryCode: countryPart };
  }

  // Otherwise try to resolve through getCountryCode
  const countryCode = getCountryCode(countryPart);
  return { city, countryCode };
}
