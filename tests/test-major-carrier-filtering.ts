import { getAirlineAlliance, isMajorCarrier } from "../src/utils/airline-alliances";

/**
 * Simple test script to demonstrate the airline alliance filtering
 */

// Sample airline codes to test
const airlineCodes = [
  // Star Alliance members
  "UA", // United Airlines
  "LH", // Lufthansa
  "NH", // All Nippon Airways
  "SQ", // Singapore Airlines
  "OZ", // Asiana Airlines

  // SkyTeam members
  "DL", // Delta Air Lines
  "AF", // Air France
  "KE", // Korean Air
  "KL", // KLM

  // OneWorld members
  "AA", // American Airlines
  "BA", // British Airways
  "CX", // Cathay Pacific
  "JL", // Japan Airlines
  "QF", // Qantas

  // Budget/non-alliance airlines
  "FR", // Ryanair
  "U2", // EasyJet
  "WN", // Southwest Airlines
  "B6", // JetBlue
  "7C", // Jeju Air
  "TW", // T'way Air
  "VJ", // VietJet Air
  "AK", // AirAsia
];

console.log("Testing airline alliance filtering\n");
console.log("Airline Code | Alliance      | Major Carrier");
console.log("-------------|---------------|-------------");

// Test each airline code
airlineCodes.forEach((code) => {
  const alliance = getAirlineAlliance(code);
  const isMajor = isMajorCarrier(code);

  console.log(`${code.padEnd(12)}| ${(alliance ?? "Not in alliance").padEnd(15)}| ${isMajor ? "Yes" : "No"}`);
});

console.log("\nSummary:");
console.log("- Major carriers are airlines that belong to one of the three global airline alliances");
console.log("- Star Alliance, OneWorld, and SkyTeam are the three major global airline alliances");
console.log("- Budget airlines and regional carriers typically do not belong to these alliances");
console.log("- When filtering for major carriers in Amadeus API results, only alliance members are included");
