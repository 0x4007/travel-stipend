import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

// Load cost-of-living data from CSV file
export function loadCostOfLivingData(filePath: string): { [location: string]: number } {
  try {
    const content = readFileSync(filePath, "utf-8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });

    const mapping: { [location: string]: number } = {};
    for (const rec of records) {
      mapping[rec.Location.trim()] = parseFloat(rec.Index);
    }

    console.log(`Loaded ${Object.keys(mapping).length} cost-of-living entries`);
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    return {};
  }
}

// Get cost of living factor for a location
export function getCostOfLivingFactor(location: string, costOfLivingMapping: { [location: string]: number }): number {
  // Try exact match first
  if (costOfLivingMapping[location.trim()]) {
    const factor = costOfLivingMapping[location.trim()];
    console.log(`Cost of living factor for ${location}: ${factor} (exact match)`);
    return factor;
  }

  // Try with comma
  const withComma = location.replace(/ ([A-Z]+)$/, ", $1");
  if (costOfLivingMapping[withComma]) {
    const factor = costOfLivingMapping[withComma];
    console.log(`Cost of living factor for ${location}: ${factor} (matched as ${withComma})`);
    return factor;
  }

  // Try without comma
  const withoutComma = location.replace(/, ([A-Z]+)$/, " $1");
  if (costOfLivingMapping[withoutComma]) {
    const factor = costOfLivingMapping[withoutComma];
    console.log(`Cost of living factor for ${location}: ${factor} (matched as ${withoutComma})`);
    return factor;
  }

  console.log(`No cost of living factor found for ${location}, using default 1.0`);
  return 1.0;
}
