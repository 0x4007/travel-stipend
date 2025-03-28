// Simple test for the airline parser

// Function to split concatenated airline names
function splitConcatenatedNames(text: string): string[] {
  if (!text) return [];

  // First handle comma-separated parts
  if (text.includes(",")) {
    return text
      .split(",")
      .map((part) => part.trim())
      .flatMap((part) => splitConcatenatedNames(part))
      .filter(Boolean);
  }

  // Look for camelCase patterns (lowercase followed by uppercase)
  const splitPoints: number[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    // Check if current char is lowercase and next char is uppercase
    if (/[a-z]/.test(text[i]) && /[A-Z]/.test(text[i + 1])) {
      splitPoints.push(i + 1);
    }
  }

  // If no split points found, return the original text
  if (splitPoints.length === 0) {
    return [text];
  }

  // Split the text at the identified points
  const result: string[] = [];
  let startIndex = 0;

  for (const splitPoint of splitPoints) {
    const part = text.substring(startIndex, splitPoint).trim();
    if (part) result.push(part);
    startIndex = splitPoint;
  }

  // Add the last part
  const lastPart = text.substring(startIndex).trim();
  if (lastPart) result.push(lastPart);

  return result;
}

// Function to process airline details
function processAirlineDetails(airlineDetails: string | null): string | null {
  if (!airlineDetails) return null;

  const airlineNames: string[] = [];

  // Split and add each airline name
  const names = splitConcatenatedNames(airlineDetails);
  for (const name of names) {
    if (name && !airlineNames.includes(name)) {
      airlineNames.push(name);
    }
  }

  // Extra deduplication step to ensure uniqueness
  const uniqueAirlines = [...new Set(airlineNames)];

  return uniqueAirlines.length > 0 ? uniqueAirlines.join(", ") : null;
}

// Test cases
const testCases = [
  "China Airlines, Korean Air, China AirlinesKorean Air",
  "Asiana Airlines, Asiana AirlinesEVA Air",
  "Korean Air, China Airlines, Korean AirChina Airlines",
  "Jin Air, Korean Air, Jin AirKorean Air",
];

// Import fs module
import * as fs from "fs";

// Run tests and write results to a file
let output = "Airline Parser Test Results\n";
output += "==========================\n\n";

for (const testCase of testCases) {
  output += `Original: "${testCase}"\n`;

  // Show split results
  const splitResults = splitConcatenatedNames(testCase);
  output += `Split results: ${JSON.stringify(splitResults)}\n`;

  // Show processed results
  const processed = processAirlineDetails(testCase);
  output += `Processed: "${processed}"\n\n`;
}

// Write results to file
fs.writeFileSync("airline-parser-test-results.txt", output);
console.log("Test results written to airline-parser-test-results.txt");
