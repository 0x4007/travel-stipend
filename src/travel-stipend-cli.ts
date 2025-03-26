#!/usr/bin/env bun
import { Command } from "commander";
import fs from "fs";
import { calculateStipend } from "./travel-stipend-calculator";
import { Conference, StipendBreakdown } from "./types";
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
  .option("--buffer-before <days>", "Buffer days before conference (default: 1)")
  .option("--buffer-after <days>", "Buffer days after conference (default: 1)")
  .option("--ticket-price <price>", "Conference ticket price (defaults to standard price)")
  .option("-o, --output <format>", "Output format: json, csv, table (default: table)")
  .option("--sort <field>", "Sort results by field (for batch mode)")
  .option("-r, --reverse", "Reverse sort order")
  .option("-v, --verbose", "Show detailed output")
  .addHelpText(
    "after",
    `
Examples:
  # Basic usage
  $ bun run src/travel-stipend-cli.ts \\
      --origin seoul \\
      --destination singapore \\
      --departure-date "15 april" \\
      --return-date "20 april"

  # With conference details and custom buffer days
  $ bun run src/travel-stipend-cli.ts \\
      --origin seoul \\
      --destination "barcelona" \\
      --departure-date "10 june" \\
      --return-date "12 june" \\
      -c "MobileConf 2025" \\
      --buffer-before 2 \\
      --buffer-after 1 \\
      --ticket-price 750 \\
      -o table

  # Batch mode for all upcoming conferences
  $ bun run src/travel-stipend-cli.ts -b

  # Batch mode with sorting and output format
  $ bun run src/travel-stipend-cli.ts -b --sort total_stipend -r -o csv
`
  );

/**
 * Process a single conference or business trip
 */
async function processSingleConference(options: {
  destination: string;
  conference?: string;
  departureDate: string;
  returnDate: string;
  bufferBefore?: string;
  bufferAfter?: string;
  ticketPrice?: string;
  origin: string;
}): Promise<StipendBreakdown> {
  const { destination, conference, departureDate, returnDate, bufferBefore, bufferAfter, ticketPrice, origin } = options;

  // Use default name if conference name not provided
  const defaultName = `Business Trip to ${destination.split(",")[0]}`;
  const conferenceName = conference ?? defaultName;

  if (!departureDate) {
    throw new Error("Departure date is required");
  }

  // Create conference record
  const record: Conference & { origin: string } = {
    conference: conferenceName,
    location: destination,
    origin,
    start_date: departureDate,
    end_date: returnDate ?? departureDate,
    ticket_price: ticketPrice ? `$${ticketPrice}` : undefined,
    category: "Business Travel",
    description: "",
    ...(bufferBefore !== undefined ? { buffer_days_before: parseInt(bufferBefore, 10) } : {}),
    ...(bufferAfter !== undefined ? { buffer_days_after: parseInt(bufferAfter, 10) } : {}),
  };

  console.log(`Conference dates: ${departureDate} to ${returnDate ?? departureDate}`);
  if (bufferBefore !== undefined || bufferAfter !== undefined) {
    console.log(`Travel buffer: ${bufferBefore ?? 1} day(s) before, ${bufferAfter ?? 1} day(s) after`);
  }

  return calculateStipend(record);
}

/**
 * Process all upcoming conferences
 */
async function processBatchConferences(origin: string): Promise<StipendBreakdown[]> {
  console.log("Starting batch processing of upcoming conferences...");

  // Get conference data from database
  const records = await DatabaseService.getInstance().getConferences();
  console.log(`Loaded ${records.length} conference records`);

  // Filter out past conferences
  const currentDate = new Date();
  const futureRecords = records.filter((record) => {
    try {
      const startDate = new Date(`${record.start_date} ${currentDate.getFullYear()}`);
      const nextYearDate = new Date(`${record.start_date} ${currentDate.getFullYear() + 1}`);
      const conferenceDate = startDate < currentDate ? nextYearDate : startDate;
      return conferenceDate >= currentDate;
    } catch (error) {
      console.error(`Error parsing date for "${record.conference}":`, error);
      return false;
    }
  });

  console.log(`Found ${futureRecords.length} upcoming conferences`);
  const results: StipendBreakdown[] = [];

  for (const record of futureRecords) {
    try {
      const result = await calculateStipend({ ...record, origin });
      results.push(result);
      console.log(`Processed: ${record.conference} - Total: $${result.total_stipend}`);
    } catch (error) {
      console.error(`Error processing "${record.conference}":`, error);
    }
  }

  return results;
}

/**
 * Sort results by the specified field
 */
function sortResults(results: StipendBreakdown[], options: { sort?: string; reverse?: boolean }): StipendBreakdown[] {
  if (!options.sort) return results;

  console.log(`Sorting by ${options.sort} (${options.reverse ? "descending" : "ascending"})`);

  return [...results].sort((a, b) => {
    const valueA = a[options.sort as keyof StipendBreakdown];
    const valueB = b[options.sort as keyof StipendBreakdown];
    const comparison = typeof valueA === "string" && typeof valueB === "string" ? valueA.localeCompare(valueB) : (valueA as number) - (valueB as number);
    return options.reverse ? -comparison : comparison;
  });
}

/**
 * Output results in the specified format
 */
function outputResults(results: StipendBreakdown[], format = "table"): void {
  const timestamp = Math.floor(Date.now() / 1000);
  fs.mkdirSync("outputs", { recursive: true });

  switch (format.toLowerCase()) {
    case "json": {
      const content = JSON.stringify(results, null, 2);
      const file = `outputs/stipends_${timestamp}.json`;
      fs.writeFileSync(file, content);
      console.log(content);
      console.log(`Results saved to ${file}`);
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
        "basic_meals_cost",
        "business_entertainment_cost",
        "meals_cost",
        "local_transport_cost",
        "internet_data_allowance",
        "incidentals_allowance",
        "ticket_price",
        "total_stipend",
      ].join(",");

      const rows = results.map((r) =>
        [
          `"${r.conference}"`,
          `"${r.location}"`,
          `"${r.conference_start}"`,
          `"${r.conference_end ?? ""}"`,
          `"${r.flight_departure}"`,
          `"${r.flight_return}"`,
          r.flight_cost,
          `"${r.flight_price_source}"`,
          r.lodging_cost,
          r.basic_meals_cost,
          r.business_entertainment_cost,
          r.meals_cost,
          r.local_transport_cost,
          r.internet_data_allowance,
          r.incidentals_allowance,
          r.ticket_price,
          r.total_stipend,
        ].join(",")
      );

      const content = [header, ...rows].join("\n");
      const file = `outputs/stipends_${timestamp}.csv`;
      fs.writeFileSync(file, content);
      console.log(content);
      console.log(`Results saved to ${file}`);
      break;
    }

    default:
      console.log("Detailed breakdown:");
      results.forEach((r) => {
        console.log(`\nConference: ${r.conference}`);
        console.log(`Flight cost: ${r.flight_cost}`);
        console.log(`Lodging cost: ${r.lodging_cost}`);
        console.log(`Basic meals cost: ${r.basic_meals_cost}`);
        console.log(`Business entertainment: ${r.business_entertainment_cost}`);
        console.log(`Total meals cost: ${r.meals_cost}`);
        console.log(`Transport cost: ${r.local_transport_cost}`);
        console.log(`Internet allowance: ${r.internet_data_allowance}`);
        console.log(`Incidentals allowance: ${r.incidentals_allowance}`);
        console.log(`Ticket price: ${r.ticket_price}`);
        console.log(`Total stipend: ${r.total_stipend}`);

        // Calculate total manually to verify
        const manualTotal =
          r.flight_cost + r.lodging_cost + r.meals_cost + r.local_transport_cost + r.internet_data_allowance + r.incidentals_allowance + r.ticket_price;

        console.log(`Manual total calculation: ${manualTotal.toFixed(2)}`);
      });

      console.table(
        results.map((r) => ({
          conference: r.conference,
          location: r.location,
          dates: `${r.conference_start} - ${r.conference_end ?? r.conference_start}`,
          flight: Number(r.flight_cost).toFixed(2),
          lodging: Number(r.lodging_cost).toFixed(2),
          basicMeals: Number(r.basic_meals_cost).toFixed(2),
          bizMeals: Number(r.business_entertainment_cost).toFixed(2),
          totalMeals: Number(r.meals_cost).toFixed(2),
          transport: Number(r.local_transport_cost).toFixed(2),
          internet: Number(r.internet_data_allowance).toFixed(2),
          incidentals: Number(r.incidentals_allowance).toFixed(2),
          ticket: Number(r.ticket_price).toFixed(2),
          total: Number(r.total_stipend).toFixed(2),
        }))
      );
      break;
  }
}

async function main(): Promise<void> {
  program.parse(process.argv);
  const options = program.opts();

  try {
    console.log(`Travel Stipend Calculator - Starting from ${options.origin}`);
    let results: StipendBreakdown[] = [];

    if (options.batch) {
      results = await processBatchConferences(options.origin);
    } else {
      if (!options.destination) {
        throw new Error("Destination is required (use --destination)");
      }

      if (!options.departureDate) {
        throw new Error("Departure date is required (use --departure-date)");
      }

      results = [
        await processSingleConference({
          destination: options.destination,
          conference: options.conference,
          departureDate: options.departureDate,
          returnDate: options.returnDate,
          bufferBefore: options.bufferBefore,
          bufferAfter: options.bufferAfter,
          ticketPrice: options.ticketPrice,
          origin: options.origin,
        }),
      ];
    }

    if (options.sort) {
      results = sortResults(results, options);
    }

    outputResults(results, options.output);
    await DatabaseService.getInstance().close();
    console.log("Travel Stipend Calculator - Completed");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
