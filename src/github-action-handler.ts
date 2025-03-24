#!/usr/bin/env bun
import * as core from '@actions/core';
import { Conference } from "./utils/types";
import { calculateStipend } from "./travel-stipend-calculator";
import { DatabaseService } from "./utils/database";
import { GoogleFlightsStrategy } from "./strategies/google-flights-strategy";
// Note: We keep the distance strategy available in case we need to fallback if Google Flights fails
import { FlightPricingContextImpl } from "./strategies/flight-pricing-context";
import { findBestMatchingConference } from "./utils/conference-matcher";
import { appendFileSync } from "fs";

// Allow script to run both as GitHub Action and directly via workflow
function getInput(name: string, options?: { required: boolean; }): string {
  // When run directly via workflow, inputs are passed via environment variables
  const envName = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  if (process.env[envName]) {
    return process.env[envName] || '';
  }
  // When run as a GitHub Action, inputs are accessed via @actions/core
  return core.getInput(name, options);
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

// Split into smaller functions to reduce cognitive complexity
async function getConferenceDetails(
  conferenceName: string | undefined,
  location: string
): Promise<{ name: string; category: string; description: string }> {
  const defaultName = `Business Trip to ${location}`;
  const defaultCategory = "Github Action";
  const defaultDescription = "";

  if (!conferenceName) {
    return { name: defaultName, category: defaultCategory, description: defaultDescription };
  }

  const matchResult = await findBestMatchingConference(conferenceName);

  if (matchResult.found) {
    if (matchResult.similarity && matchResult.similarity < 1.0) {
      logInfo(`Using closest matching conference: "${matchResult.conference?.conference}" (${Math.round(matchResult.similarity * 100)}% match)`);
    }
    return {
      name: matchResult.conference?.conference ?? conferenceName,
      category: matchResult.conference?.category ?? defaultCategory,
      description: matchResult.conference?.description ?? defaultDescription
    };
  }

  if (matchResult.suggestions?.length) {
    logInfo('Conference not found in database. Similar conferences:');
    matchResult.suggestions.forEach((conf, i) => {
      logInfo(`  ${i + 1}. ${conf.conference}`);
    });
    logInfo('Using provided conference name.');
  }

  return { name: conferenceName, category: defaultCategory, description: defaultDescription };
}

async function run(): Promise<void> {
  let flightContext: FlightPricingContextImpl | undefined;

  try {
    // Get inputs
    const location = getInput("location", { required: true });
    const origin = getInput("origin", { required: true });
    const conferenceStart = getInput("conference_start", { required: true });
    const conferenceEnd = getInput("conference_end") || conferenceStart;
    const conferenceName = getInput("conference_name");
    const daysBefore = parseInt(getInput("days_before") || "1", 10);
    const daysAfter = parseInt(getInput("days_after") || "1", 10);
    const ticketPrice = getInput("ticket_price");

    // Safety check: require at least 1 day before AND 1 day after for flights
    if (daysBefore < 1) {
      logWarning('Cannot fly on conference start day - you would miss the beginning!');
      logWarning('Using minimum 1 day before conference');
    }

    if (daysAfter < 1) {
      logWarning('Cannot fly on conference end day - you would miss the conclusion!');
      logWarning('Using minimum 1 day after conference');
    }

    // Get conference details using helper function
    const { name, category, description } = await getConferenceDetails(conferenceName, location);

    // Create conference record
    const conference: Conference & { origin: string } = {
      conference: name,
      location,
      origin,
      start_date: conferenceStart,
      end_date: conferenceEnd,
      ticket_price: ticketPrice ? `$${ticketPrice}` : "",
      category,
      description,
      buffer_days_before: Math.max(1, daysBefore),
      buffer_days_after: Math.max(1, daysAfter)
    };

    // Detect environment
    const isGitHubActions = !!process.env.GITHUB_ACTIONS;

    // Get debug settings - only enable in GitHub Actions if explicitly set
    const isDebugMode = process.env.DEBUG_GOOGLE_FLIGHTS === "true";
    const shouldCaptureScreenshots = process.env.CAPTURE_SCREENSHOTS === "true";

    // Configure timeout
    const timeout = parseInt(process.env.PUPPETEER_TIMEOUT ?? "60000", 10);

    // Determine screenshot mode
    let screenshotMode = 'Disabled';
    if (shouldCaptureScreenshots) {
      screenshotMode = 'Enabled';
    } else if (process.env.ENABLE_ERROR_SCREENSHOTS === "true") {
      screenshotMode = 'Error-only';
    }

    // Log environment and configuration
    logInfo(`Environment: ${isGitHubActions ? 'GitHub Actions' : 'Local'}`);
    logInfo(`Debug mode: ${isDebugMode ? 'Enabled' : 'Disabled'}`);
    logInfo(`Screenshots: ${screenshotMode}`);
    logInfo(`Timeout: ${timeout}ms`);

    // Set up default strategy
    const strategy = new GoogleFlightsStrategy();
    flightContext = new FlightPricingContextImpl(strategy);

    // Calculate stipend
    const result = await calculateStipend(conference);
    const nights = Math.ceil((new Date(result.flight_return).getTime() - new Date(result.flight_departure).getTime()) / (1000 * 60 * 60 * 24));
    const days = nights + 1;

    // Create results object
    const stipendResult = {
      conference: result.conference,
      location: result.location,
      conference_start: result.conference_start,
      conference_end: result.conference_end,
      flight_departure: result.flight_departure,
      flight_return: result.flight_return,
      flight_cost: result.flight_cost,
      flight_price_source: result.flight_price_source,
      lodging_cost: result.lodging_cost,
      meals_cost: result.meals_cost,
      local_transport_cost: result.local_transport_cost,
      ticket_price: result.ticket_price,
      total_stipend: result.total_stipend,
      stay_duration: {
        nights,
        days
      }
    };

    // Set outputs
    setOutput('stipend', stipendResult);

    // Build summary table
    const summaryTable = [
      [
        { data: 'Item', header: true },
        { data: 'Details', header: true },
        { data: 'Cost', header: true }
      ],
      ['Conference', `${result.conference} in ${result.location}`, ''],
      ['Dates', `${result.conference_start} to ${result.conference_end}`, ''],
      ['Travel', `${result.flight_departure} to ${result.flight_return}`, ''],
      ['Flight', result.flight_price_source, `$${result.flight_cost}`],
      ['Lodging', `${nights} nights`, `$${result.lodging_cost}`],
      ['Meals', `${days} days`, `$${result.meals_cost}`],
      ['Local Transport', `${days} days`, `$${result.local_transport_cost}`],
      ['Conference Ticket', '', `$${result.ticket_price}`],
      ['Total Stipend', '', `$${result.total_stipend}`]
    ];

    // Log results to console in table format (for direct workflow run)
    console.log('\nTravel Stipend Calculation:');
    console.table(summaryTable.slice(1).map(row => {
      return { Item: row[0], Details: row[1], Cost: row[2] };
    }));

    // Write GitHub summary if in GitHub Actions environment
    if (process.env.GITHUB_STEP_SUMMARY) {
      await core.summary
        .addHeading('Travel Stipend Calculation')
        .addTable(summaryTable)
        .addBreak()
        .write();
    }

  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed('An unexpected error occurred');
    }
  } finally {
    // Clean up resources
    if (flightContext) {
      await flightContext.cleanup();
    }
    await DatabaseService.getInstance().close();
  }
}

// Handle errors in the top-level async function
run().catch(error => {
  setFailed(`Unhandled error in run(): ${error}`);
});
