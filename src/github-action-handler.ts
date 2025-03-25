#!/usr/bin/env bun
import * as core from "@actions/core";
import { appendFileSync } from "fs";
import { calculateStipend } from "./travel-stipend-calculator";
import { Conference, StipendBreakdown } from "./types";
import { DatabaseService } from "./utils/database";

// Enhanced input validation matching CLI behavior
function getInput(name: string, options?: { required: boolean }): string {
  const envName = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const value = process.env[envName] ?? core.getInput(name, options);

  if (options?.required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value ?? "";
}

function setOutput(name: string, value: Record<string, unknown>): void {
  if (process.env.GITHUB_OUTPUT) {
    // When run as GitHub Action via workflow with GITHUB_OUTPUT env variable
    const output = JSON.stringify(value);
    // Use the new approach of writing to environment files
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${output}\n`);
  } else {
    // When run as GitHub Action module, use the core library
    core.setOutput(name, value);
  }
}

function logInfo(message: string): void {
  console.log(message);
  if (core.info) {
    core.info(message);
  }
}

function logWarning(message: string): void {
  console.warn(message);
  if (core.warning) {
    core.warning(message);
  }
}

function setFailed(message: string): void {
  console.error(message);
  if (core.setFailed) {
    core.setFailed(message);
  } else {
    process.exit(1);
  }
}

function getInputs() {
  const location = getInput("destination", { required: true });
  const origin = getInput("origin", { required: true });
  const departureDate = getInput("departure_date", { required: true });
  const returnDate = getInput("return_date") ?? departureDate;
  const daysBefore = Math.max(1, parseInt(getInput("buffer_before") ?? "1", 10));
  const daysAfter = Math.max(1, parseInt(getInput("buffer_after") ?? "1", 10));
  const ticketPrice = getInput("ticket_price") ?? "750";
  const outputFormat = getInput("output_format") ?? "table";

  console.log("\nTravel stipend calculation inputs:");
  console.log("--------------------------------");
  console.log(`Origin: ${origin}`);
  console.log(`Destination: ${location}`);
  console.log(`Departure Date: ${departureDate}`);
  console.log(`Return Date: ${returnDate}`);
  console.log(`Buffer Days Before: ${daysBefore}`);
  console.log(`Buffer Days After: ${daysAfter}`);
  console.log(`Ticket Price: $${ticketPrice}`);
  console.log(`Output Format: ${outputFormat}`);
  console.log("--------------------------------\n");

  return { location, origin, departureDate, returnDate, daysBefore, daysAfter, ticketPrice, outputFormat };
}

function validateBufferDays(daysBefore: number, daysAfter: number) {
  if (daysBefore < 1) {
    logWarning("Cannot fly on conference start day - you would miss the beginning!");
    logWarning("Using minimum 1 day before conference");
  }

  if (daysAfter < 1) {
    logWarning("Cannot fly on conference end day - you would miss the conclusion!");
    logWarning("Using minimum 1 day after conference");
  }
}

function createConferenceRecord(
  location: string,
  origin: string,
  departureDate: string,
  returnDate: string,
  daysBefore: number,
  daysAfter: number,
  ticketPrice: string
): Conference & { origin: string } {
  return {
    conference: getInput("conference") || `Business Trip to ${location.split(",")[0]}`,
    location,
    origin,
    start_date: departureDate,
    end_date: returnDate,
    ticket_price: ticketPrice ? `$${ticketPrice}` : undefined,
    category: "GitHub Action",
    description: "",
    buffer_days_before: daysBefore,
    buffer_days_after: daysAfter,
  };
}

function logEnvironmentConfig() {
  const isGitHubActions = !!process.env.GITHUB_ACTIONS;
  const isDebugMode = process.env.DEBUG_GOOGLE_FLIGHTS === "true";
  const shouldCaptureScreenshots = process.env.CAPTURE_SCREENSHOTS === "true";
  const timeout = parseInt(process.env.PUPPETEER_TIMEOUT ?? "60000", 10);

  let screenshotMode = "Disabled";
  if (shouldCaptureScreenshots) {
    screenshotMode = "Enabled";
  } else if (process.env.ENABLE_ERROR_SCREENSHOTS === "true") {
    screenshotMode = "Error-only";
  }

  logInfo(`Environment: ${isGitHubActions ? "GitHub Actions" : "Local"}`);
  logInfo(`Debug mode: ${isDebugMode ? "Enabled" : "Disabled"}`);
  logInfo(`Screenshots: ${screenshotMode}`);
  logInfo(`Timeout: ${timeout}ms`);
}

async function run(): Promise<void> {
  try {
    const { location, origin, departureDate, returnDate, daysBefore, daysAfter, ticketPrice, outputFormat } = getInputs();
    validateBufferDays(daysBefore, daysAfter);
    const conference = createConferenceRecord(location, origin, departureDate, returnDate, daysBefore, daysAfter, ticketPrice);
    logEnvironmentConfig();

    const result = await calculateStipend(conference);
    await handleOutput(result, outputFormat);
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed("An unexpected error occurred");
    }
  } finally {
    await DatabaseService.getInstance().close();
  }
}

function formatStipendResult(result: StipendBreakdown) {
  const nights = Math.ceil((new Date(result.flight_return).getTime() - new Date(result.flight_departure).getTime()) / (1000 * 60 * 60 * 24));
  const days = nights + 1;

  return {
    ...result,
    stay_duration: { nights, days },
    internet_data_allowance: result.internet_data_allowance || 0,
    incidentals_allowance: result.incidentals_allowance || 0,
  };
}

async function handleOutput(result: StipendBreakdown, outputFormat: string) {
  const stipendResult = formatStipendResult(result);

  // Set outputs
  setOutput("stipend", stipendResult);

  // Handle different output formats
  if (outputFormat === "json") {
    console.log(JSON.stringify(stipendResult, null, 2));
  } else if (outputFormat === "csv") {
    const csv = [
      "conference,location,conference_start,conference_end,flight_departure,flight_return,flight_cost,flight_price_source,lodging_cost,meals_cost,local_transport_cost,ticket_price,total_stipend",
      `"${stipendResult.conference}","${stipendResult.location}","${stipendResult.conference_start}","${stipendResult.conference_end}","${stipendResult.flight_departure}","${stipendResult.flight_return}",${stipendResult.flight_cost},"${stipendResult.flight_price_source}",${stipendResult.lodging_cost},${stipendResult.meals_cost},${stipendResult.local_transport_cost},${stipendResult.ticket_price},${stipendResult.total_stipend}`
    ].join("\n");
    console.log(csv);
  } else {
    await outputTable(stipendResult);
  }
}

async function outputTable(result: StipendBreakdown) {
  const nights = Math.ceil((new Date(result.flight_return).getTime() - new Date(result.flight_departure).getTime()) / (1000 * 60 * 60 * 24));
  const days = nights + 1;

  const summaryTable = [
    [
      { data: "Item", header: true },
      { data: "Details", header: true },
      { data: "Cost", header: true },
    ],
    ["Conference", `${result.conference} in ${result.location}`, ""],
    ["Dates", `${result.conference_start} to ${result.conference_end}`, ""],
    ["Travel", `${result.flight_departure} to ${result.flight_return}`, ""],
    ["Flight", result.flight_price_source, `$${result.flight_cost}`],
    ["Lodging", `${nights} nights`, `$${result.lodging_cost}`],
    ["Meals", `${days} days`, `$${result.meals_cost}`],
    ["Local Transport", `${days} days`, `$${result.local_transport_cost}`],
    ["Internet", `${days} days`, `$${result.internet_data_allowance}`],
    ["Incidentals", `${days} days`, `$${result.incidentals_allowance}`],
    ["Conference Ticket", "", `$${result.ticket_price}`],
    ["Total Stipend", "", `$${result.total_stipend}`],
  ];

  console.log("\nTravel Stipend Calculation:");
  console.table(
    summaryTable.slice(1).map((row) => {
      return { Item: row[0], Details: row[1], Cost: row[2] };
    })
  );

  if (process.env.GITHUB_STEP_SUMMARY) {
    await core.summary.addHeading("Travel Stipend Calculation").addTable(summaryTable).addBreak().write();
  }
}
// Export the run function as the entry point
export { run };
