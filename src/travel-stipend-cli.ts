#!/usr/bin/env bun
import { Command } from "commander";
import fs from "fs";
import { calculateStipend } from "./travel-stipend-calculator";
import { Conference, StipendBreakdown } from "./utils/types";
import { DatabaseService } from "./utils/database";
import { ORIGIN } from "./utils/constants";
import { GoogleFlightsStrategy } from "./strategies/google-flights-strategy";
import { HybridStrategy } from "./strategies/hybrid-strategy";
import { FlightPricingContextImpl } from "./strategies/flight-pricing-context";

// Program definition with examples
const program = new Command()
  .version("1.0.0")
  .description("Travel Stipend Calculator CLI")
  .option("-b, --batch", "Process all upcoming conferences (batch mode)")
  .option("-s, --single <location>", "Calculate stipend for a single location")
  .option("-c, --conference <name>", "Conference name (required for single mode)")
  .option("--start-date <date>", "Conference start date (required for single mode)")
  .option("--end-date <date>", "Conference end date (defaults to start date)")
  .option("--ticket-price <price>", "Conference ticket price (defaults to standard price)")
  .option("-o, --output <format>", "Output format: json, csv, table (default: table)")
  .option("--sort <field>", "Sort results by field (for batch mode)")
  .option("-r, --reverse", "Reverse sort order")
  .option("-v, --verbose", "Show detailed output including flight pricing info")
  .addHelpText("after", `
Examples:
  # Calculate single destination stipend (minimal required parameters)
  $ bun run src/travel-stipend-cli.ts -s "Singapore, Singapore" -c "DevCon Asia 2025" --start-date "15 April"

  # Complete single destination example with all options
  $ bun run src/travel-stipend-cli.ts \\
      -s "Tokyo, Japan" \\
      -c "TechSummit Asia" \\
      --start-date "20 May" \\
      --end-date "23 May" \\
      --ticket-price 600 \\
      -o json

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
  startDate?: string;
  endDate?: string;
  ticketPrice?: string;
}

async function processSingleConference(options: SingleConferenceOptions): Promise<StipendBreakdown> {
  const { single: location, conference, startDate, endDate, ticketPrice } = options;

  // Check for required parameters with detailed error messages
  if (!location) {
    throw new Error(`
ERROR: Missing destination location

You must specify a location with -s or --single
Example:
  $ bun run src/travel-stipend-cli.ts -s "Singapore, Singapore" -c "Conference Name" --start-date "15 April"
`);
  }

  if (!conference) {
    throw new Error(`
ERROR: Missing conference name

You must specify a conference name with -c or --conference
Example:
  $ bun run src/travel-stipend-cli.ts -s "${location}" -c "DevCon Asia 2025" --start-date "15 April"
`);
  }

  if (!startDate) {
    throw new Error(`
ERROR: Missing conference start date

You must specify a start date with --start-date parameter
Example:
  $ bun run src/travel-stipend-cli.ts -s "${location}" -c "${conference}" --start-date "15 April"
`);
  }

  // Create a conference record from command line options
  const record: Conference = {
    conference,
    location,
    start_date: startDate,
    end_date: endDate ?? startDate, // Use start date as end date if not provided
    ticket_price: ticketPrice ? `$${ticketPrice}` : "",
    category: "CLI Input", // Default values for required fields
    description: ""
  };

  return calculateStipend(record);
}

/**
 * Process all upcoming conferences
 */
// Options parameter is not needed for batch processing
async function processBatchConferences(): Promise<StipendBreakdown[]> {
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
      const result = await calculateStipend(record);
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
      // Output as a table
      console.table(
        results.map((r) => ({
          conference: r.conference,
          location: r.location,
          start: r.conference_start,
          end: r.conference_end,
          flight: `$${r.flight_cost}`,
          lodging: `$${r.lodging_cost}`,
          meals: `$${r.meals_cost}`,
          transport: `$${r.local_transport_cost}`,
          ticket: `$${r.ticket_price}`,
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

  // Validate options
  if (!options.batch && !options.single) {
    console.error(`
ERROR: You must specify either --batch or --single mode

Examples:
  # Single destination mode (all required parameters)
  $ bun run src/travel-stipend-cli.ts -s "Singapore, Singapore" -c "DevCon Asia 2025" --start-date "15 April"

  # Batch mode
  $ bun run src/travel-stipend-cli.ts -b

For full help, run:
  $ bun run src/travel-stipend-cli.ts --help
`);
    process.exit(1);
  }

  try {
    console.log("Travel Stipend Calculator - Starting...");
    console.log(`Origin: ${ORIGIN}`);

    // Get appropriate strategy based on mode
    const strategy = options.batch
      ? StrategyFactory.createBatchStrategy()
      : StrategyFactory.createSingleStrategy();
    const context = new FlightPricingContextImpl(strategy);

    let results: StipendBreakdown[] = [];

    if (options.batch) {
      // Process all conferences
      results = await processBatchConferences();
    } else {
      // Process a single conference
      const result = await processSingleConference(options);
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
