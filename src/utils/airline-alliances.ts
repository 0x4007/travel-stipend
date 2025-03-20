/**
 * Airline alliance data and utility functions
 */

/**
 * Major airline alliances and their member airlines (by IATA code)
 */
export const AIRLINE_ALLIANCES = {
  STAR_ALLIANCE: [
    "AC", // Air Canada
    "NH", // All Nippon Airways
    "OZ", // Asiana Airlines
    "OS", // Austrian Airlines
    "AV", // Avianca
    "BR", // EVA Air
    "CA", // Air China
    "CM", // Copa Airlines
    "MS", // Egyptair
    "ET", // Ethiopian Airlines
    "BR", // EVA Air
    "LH", // Lufthansa
    "SK", // Scandinavian Airlines
    "SQ", // Singapore Airlines
    "SA", // South African Airways
    "LX", // Swiss International Air Lines
    "TP", // TAP Air Portugal
    "TG", // Thai Airways
    "TK", // Turkish Airlines
    "UA", // United Airlines
    "ZH", // Shenzhen Airlines
  ],
  ONE_WORLD: [
    "AA", // American Airlines
    "BA", // British Airways
    "CX", // Cathay Pacific
    "AY", // Finnair
    "IB", // Iberia
    "JL", // Japan Airlines
    "LA", // LATAM Airlines
    "MH", // Malaysia Airlines
    "QF", // Qantas
    "QR", // Qatar Airways
    "RJ", // Royal Jordanian
    "UL", // SriLankan Airlines
    "S7", // S7 Airlines
  ],
  SKY_TEAM: [
    "SU", // Aeroflot
    "AR", // Aerolineas Argentinas
    "AM", // Aeromexico
    "AF", // Air France
    "AZ", // Alitalia
    "CI", // China Airlines
    "MU", // China Eastern
    "CZ", // China Southern
    "OK", // Czech Airlines
    "DL", // Delta Air Lines
    "KE", // Korean Air
    "KL", // KLM
    "ME", // Middle East Airlines
    "SV", // Saudia
    "RO", // TAROM
    "VN", // Vietnam Airlines
    "MF", // Xiamen Airlines
  ],
};

/**
 * Check if an airline is a member of any major alliance
 * @param airlineCode IATA airline code
 * @returns boolean indicating if the airline is a major carrier (alliance member)
 */
export function isMajorCarrier(airlineCode: string): boolean {
  return (
    AIRLINE_ALLIANCES.STAR_ALLIANCE.includes(airlineCode) ||
    AIRLINE_ALLIANCES.ONE_WORLD.includes(airlineCode) ||
    AIRLINE_ALLIANCES.SKY_TEAM.includes(airlineCode)
  );
}

/**
 * Get the alliance name for an airline code
 * @param airlineCode IATA airline code
 * @returns Alliance name or null if not a member of any alliance
 */
export function getAirlineAlliance(airlineCode: string): string | null {
  if (AIRLINE_ALLIANCES.STAR_ALLIANCE.includes(airlineCode)) {
    return "Star Alliance";
  }
  if (AIRLINE_ALLIANCES.ONE_WORLD.includes(airlineCode)) {
    return "OneWorld";
  }
  if (AIRLINE_ALLIANCES.SKY_TEAM.includes(airlineCode)) {
    return "SkyTeam";
  }
  return null;
}
