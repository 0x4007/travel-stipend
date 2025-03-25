#!/usr/bin/env bun
import { Command } from "commander";
import fs from "fs";
import { FlightPricingContextImpl } from "./strategies/flight-pricing-context";
import { GoogleFlightsStrategy } from "./strategies/google-flights-strategy";
import { HybridStrategy } from "./strategies/hybrid-strategy";
import { calculateStipend } from "./travel-stipend-calculator";
import { Conference, StipendBreakdown } from "./types";
import { findBestMatchingConference } from "./utils/conference-matcher";
import { DatabaseService } from "./utils/database";

// Program definition with examples
const program = new Command()
  .version("1.0.0")
  .description("Travel Stipend Calculator CLI")
  .requiredOption("--origin <city>", "Origin city (e.g. 'Seoul')")
  .requiredOption("--destination <city>", "Destination city (e.g. 'Singapore')")
  .requiredOption("--departure-date <date>", "Departure date (e.g. '15 april')")
  .requiredOption("--return-date <date>", "Return date (e.g. '20 april')")
  .option("-b, --batch", "Process all upcoming conferences (batch mode)")
  .option("-c, --conference <name>", "Conference name (optional, will use 'Business Trip' if not specified)")
  .option("--ticket-price <price>", "Conference ticket price (defaults to standard price)")
  .option("-o, --output <format>", "Output format: json, csv, table (default: table)")
  .option("--sort <field>", "Sort results by field (for batch mode)")
  .option("-r, --reverse", "Reverse sort order")
  .option("-v, --verbose", "Show detailed output including flight pricing info")
  .addHelpText("after", `
Examples:
  # Basic usage
  $ bun run src/travel-stipend-cli.ts \\
      --origin seoul \\
      --destination singapore \\
      --departure-date "15 april" \\
      --return-date "20 april"

  # With conference details
  $ bun run src/travel-stipend-cli.ts \\
      --origin seoul \\
      --destination "barcelona" \\
      --departure-date "10 june" \\
      --return-date "12 june" \\
      -c "MobileConf 2025" \\
      --ticket-price 750 \\
      -o table

  # Batch mode for all upcoming conferences
  $ bun run src/travel-stipend-cli.ts -b

  # Batch mode with sorting and output format
  $ bun run src/travel-stipend-cli.ts -b --sort total_stipend -r -o csv
`);

/**
 * Factory for creating the appropriate flight pricing strategy
 */
class StrategyFactory {
  static createBatchStrategy(): HybridStrategy {
    console.log("Using hybrid flight pricing strategy for batch mode");
    return new HybridStrategy();
  }

  static createSingleStrategy(): GoogleFlightsStrategy {
    console.log("Using Google Flights pricing strategy for single mode");
    return new GoogleFlightsStrategy();
  }
}

/**
 * Process a single conference
 */
interface SingleConferenceOptions {
  single?: string;
  conference?: string;
  startDate?: string;            // Legacy parameter
  endDate?: string;              // Legacy parameter
  conferenceStart?: string;      // New parameter
  conferenceEnd?: string;        // New parameter
  daysBefore?: number;           // New parameter for buffer days
  daysAfter?: number;           // New parameter for buffer days
  ticketPrice?: string;
  origin: string;               // Required origin city
}

async function processSingleConference(options: SingleConferenceOptions): Promise<StipendBreakdown> {
  const {
    single: location,
    conference: inputConference,
    startDate,
    endDate,
    conferenceStart,
    conferenceEnd,
    daysBefore,
    daysAfter,
    ticketPrice,
    origin
  } = options;

  // Use the new parameters if provided, fall back to legacy parameters
  const actualStartDate = conferenceStart ?? startDate;
  const actualEndDate = conferenceEnd ?? endDate ?? actualStartDate; // Default to start date if not specified

  // Check for required parameters with detailed error messages
  if (!location) {
    throw new Error(`
ERROR: Missing destination location

You must specify a destination location with --destination
Example:
  $ bun run src/travel-stipend-cli.ts --origin seoul --destination singapore --departure-date "15 april" --return-date "20 april"
`);
  }

  if (!actualStartDate) {
    throw new Error(`
ERROR: Missing departure date

You must specify when you're departing with --departure-date
Example:
  $ bun run src/travel-stipend-cli.ts --origin seoul --destination singapore --departure-date "15 april" --return-date "20 april"
`);
  }

  // Use default name if conference name not provided
  const defaultConferenceName = `Business Trip to ${location.split(',')[0]}`; // Just use city name if full location provided

  // Determine conference name to use
  let conferenceToUse = defaultConferenceName;
  let category = "CLI Input";
  let description = "";

  // Only do fuzzy matching if a conference name was provided
  if (inputConference) {
    // Try to match the conference name with fuzzy matching
    const matchResult = await findBestMatchingConference(inputConference);

    // Handle fuzzy matching results
    if (matchResult.found) {
      // We found a matching conference in the database
      if (matchResult.similarity && matchResult.similarity < 1.0) {
        console.log(`Using closest matching conference: "${matchResult.conference?.conference}" (${Math.round(matchResult.similarity * 100)}% match)`);
      }
      conferenceToUse = matchResult.conference?.conference ?? inputConference;
      category = matchResult.conference?.category ?? category;
      description = matchResult.conference?.description ?? description;
    } else if (matchResult.suggestions && matchResult.suggestions.length > 0) {
      // No exact match but we have suggestions
      console.log(`\nConference "${inputConference}" not found in the database. Did you mean one of these?`);
      matchResult.suggestions.forEach((conf, i) => {
        console.log(`  ${i + 1}. ${conf.conference}`);
      });
      console.log(`\nProceeding with the user-provided conference name. Use one of the suggestions above for a more accurate calculation.\n`);

      // Use the provided conference name
      conferenceToUse = inputConference;
    } else {
      // No match and no suggestions
      conferenceToUse = inputConference;
    }
  } else {
    console.log(`No conference name provided. Using default: "${defaultConferenceName}"`);
  }

  // Create a conference record from command line options
  const record: Conference & { origin: string } = {
    conference: conferenceToUse,
    location,
    origin,
    start_date: actualStartDate ?? "", // Use empty string as fallback for type safety
    end_date: actualEndDate ?? "", // Use empty string as fallback for type safety
    ticket_price: ticketPrice ? `$${ticketPrice}` : "",
    category,
    description,
    // Pass buffer days if provided
    ...(daysBefore !== undefined && { buffer_days_before: daysBefore }),
    ...(daysAfter !== undefined && { buffer_days_after: daysAfter })
  };

  console.log(`Conference dates: ${actualStartDate ?? ""} to ${actualEndDate ?? ""}`);
  if (daysBefore !== undefined || daysAfter !== undefined) {
    console.log(`Travel buffer: ${daysBefore ?? 1} day(s) before, ${daysAfter ?? 1} day(s) after`);
  }

  return calculateStipend(record);
}

/**
 * Process all upcoming conferences
 */
async function processBatchConferences(origin: string): Promise<StipendBreakdown[]> {
  console.log("Starting batch processing of all upcoming conferences...");

  // Get conference data from database
  console.log("Reading conferences from database...");
  const records = await DatabaseService.getInstance().getConferences();
  console.log(`Loaded ${records.length} conference records`);

  // Filter out past conferences
  const currentDate = new Date();
  const futureRecords = records.filter((record) => {
    const endDate = record.end_date ? new Date(`${record.end_date} 2025`) : new Date(`${record.start_date} 2025`);
    return endDate >= currentDate;
  });
  console.log(`Filtered to ${futureRecords.length} upcoming conferences`);

  const results: StipendBreakdown[] = [];

  for (const record of futureRecords) {
    try {
      console.log(`Processing conference: ${record.conference} in ${record.location}`);
      const result = await calculateStipend({ ...record, origin });
      results.push(result);
      console.log(`Completed: ${record.conference} - Total stipend: $${result.total_stipend}`);
    } catch (error) {
      console.error(`Error processing conference "${record.conference}":`, error);
    }
  }

  return results;
}

/**
 * Sort results based on provided options
 */
interface SortOptions {
  sort?: string;
  reverse?: boolean;
}

function sortResults(results: StipendBreakdown[], options: SortOptions): StipendBreakdown[] {
  if (!options.sort) return results;

  const sortColumn = options.sort as keyof StipendBreakdown;
  const reverse = options.reverse ? -1 : 1;

  console.log(`Sorting results by ${sortColumn} (${reverse === 1 ? 'ascending' : 'descending'})`);

  return [...results].sort((a, b) => {
    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    let comparison = 0;
    // Handle string vs number comparison
    if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB);
    } else {
      comparison = (valueA as number) - (valueB as number);
    }

    return comparison * reverse;
  });
}

/**
 * Output results in the specified format
 */
interface OutputOptions {
  output?: string;
}

function outputResults(results: StipendBreakdown[], options: OutputOptions): void {
  const format = options.output ?? "table";
  const timestamp = Math.floor(Date.now() / 1000);

  // Create outputs directory
  fs.mkdirSync("outputs", { recursive: true });

  switch (format.toLowerCase()) {
    case "json": {
      const jsonOutput = JSON.stringify(results, null, 2);
      console.log(jsonOutput);

      // Also save to file
      const jsonFile = `outputs/stipends_${timestamp}.json`;
      fs.writeFileSync(jsonFile, jsonOutput);
      console.log(`Results saved to ${jsonFile}`);
      break;
    }

    case "csv": {
      const header = [
        "conference",
        "location",
        "conference_start",
        "conference_end",
        "flight_departure",
        "flight_return",
        "flight_cost",
        "flight_price_source",
        "lodging_cost",
        "meals_cost",
        "local_transport_cost",
        "ticket_price",
        "total_stipend"
      ].join(",");

      const rows = results.map((r) =>
        [
          `"${r.conference}"`,
          `"${r.location}"`,
          `"${r.conference_start}"`,
          `"${r.conference_end || ""}"`,
          `"${r.flight_departure}"`,
          `"${r.flight_return}"`,
          r.flight_cost,
          `"${r.flight_price_source}"`,
          r.lodging_cost,
          r.meals_cost,
          r.local_transport_cost,
          r.ticket_price,
          r.total_stipend
        ].join(",")
      );

      const csvContent = [header, ...rows].join("\n");
      console.log(csvContent);

      // Also save to file
      const csvFile = `outputs/stipends_${timestamp}.csv`;
      fs.writeFileSync(csvFile, csvContent);
      console.log(`Results saved to ${csvFile}`);
      break;
    }

    case "table":
    default:
      // Output as a table with clear distinction between conference and travel dates
      console.table(
        results.map((r) => ({
          conference: r.conference,
          location: r.location,
          conf_start: r.conference_start,
          conf_end: r.conference_end || r.conference_start,
          travel_start: r.flight_departure,
          travel_end: r.flight_return,
          flight: `$${r.flight_cost}`,
          lodging: `$${r.lodging_cost}`,
          meals: `$${r.meals_cost}`,
          transport: `$${r.local_transport_cost}`,
          total: `$${r.total_stipend}`
        }))
      );
      break;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  program.parse(process.argv);
  const options = program.opts();

  try {
    console.log("Travel Stipend Calculator - Starting...");
    console.log(`Origin: ${options.origin}`);

    // Determine if we're running in batch mode or single mode
    const isBatchMode = options.batch;

    // Get appropriate strategy based on mode
    const strategy = isBatchMode
      ? StrategyFactory.createBatchStrategy()
      : StrategyFactory.createSingleStrategy();
    const context = new FlightPricingContextImpl(strategy);

    let results: StipendBreakdown[] = [];

    if (isBatchMode) {
      // Process all conferences
      results = await processBatchConferences(options.origin);
    } else {
      // Single mode (default)
      if (!options.destination) {
        throw new Error(`
ERROR: Missing destination location

You must specify a destination location with --destination
Example:
  $ bun run src/travel-stipend-cli.ts --origin seoul --destination singapore --departure-date "15 april" --return-date "20 april"
`);
      }

      if (!options.departureDate) {
        throw new Error(`
ERROR: Missing departure date

You must specify when you're departing with --departure-date
Example:
  $ bun run src/travel-stipend-cli.ts --origin seoul --destination singapore --departure-date "15 april" --return-date "20 april"
`);
      }

      // Process a single conference with all parameters
      const singleOptions = {
        single: options.destination,
        conference: options.conference,
        conferenceStart: options.departureDate,
        conferenceEnd: options.returnDate,
        ticketPrice: options.ticketPrice,
        origin: options.origin
      };

      const result = await processSingleConference(singleOptions);
      results = [result];
    }

    // Sort results if required
    if (options.sort) {
      results = sortResults(results, options);
    }

    // Output results
    outputResults(results, options);

    // Clean up resources
    await context.cleanup();
    await DatabaseService.getInstance().close();

    console.log("Travel Stipend Calculator - Completed");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Only run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
