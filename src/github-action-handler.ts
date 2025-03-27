import { config } from "dotenv";
import fs from "fs";
import { calculateStipend } from "./travel-stipend-calculator";
import { Conference, StipendBreakdown } from "./types";
import { DatabaseService } from "./utils/database";

// Load environment variables
config();

interface ActionInputs {
  location: string;
  conferenceStart: string;
  conferenceEnd: string;
  conferenceName: string;
  daysBefore: number;
  daysAfter: number;
  ticketPrice: string;
  outputFormat: string;
  includeBudget: boolean;
}

function getActionInputs(): ActionInputs {
  return {
    location: process.env.INPUT_DESTINATION ?? "",
    conferenceStart: process.env.INPUT_CONFERENCE_START ?? "",
    conferenceEnd: process.env.INPUT_CONFERENCE_END ?? "",
    conferenceName: process.env.INPUT_CONFERENCE_NAME ?? `Conference in ${process.env.INPUT_DESTINATION ?? "destination"}`,
    daysBefore: parseInt(process.env.INPUT_DAYS_BEFORE ?? "1"),
    daysAfter: parseInt(process.env.INPUT_DAYS_AFTER ?? "1"),
    ticketPrice: process.env.INPUT_TICKET_PRICE ?? "0",
    outputFormat: process.env.INPUT_OUTPUT_FORMAT ?? "table",
    includeBudget: process.env.INPUT_INCLUDE_BUDGET === "true",
  };
}

async function constructConference(inputs: ActionInputs): Promise<Conference> {
  return {
    category: "Custom", // For one-off calculations
    conference: inputs.conferenceName,
    location: inputs.location,
    start_date: inputs.conferenceStart,
    end_date: inputs.conferenceEnd,
    buffer_days_before: inputs.daysBefore,
    buffer_days_after: inputs.daysAfter,
    ticket_price: inputs.ticketPrice,
    origin: process.env.INPUT_ORIGIN ?? "Seoul, South Korea", // Default origin
    includeBudget: inputs.includeBudget,
  };
}

// Helper function to format currency values
function formatCurrency(value: number | undefined) {
  if (value === undefined) return "$0.00";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper function to create table rows with proper padding and borders
function formatTableRow(label: string, value: string, isHeader = false, isTotal = false): string {
  const labelColumn = label.padEnd(20);
  const valueColumn = value.padStart(25);
  let border = "│";
  if (isHeader) {
    border = "├";
  } else if (isTotal) {
    border = "└";
  }
  return `${border} ${labelColumn} │ ${valueColumn} │`;
}

// Helper function to create section headers with proper formatting
function formatSectionHeader(title: string, isFirst = false): string {
  const topBorder = isFirst ? "┌" : "├";
  return [
    `${topBorder}${"─".repeat(22)}┬${"─".repeat(27)}┐`,
    `│ ${title.padEnd(21)} │${" ".repeat(27)}│`,
    `├${"─".repeat(22)}┼${"─".repeat(27)}┤`
  ].join("\n");
}

function formatOutput(result: StipendBreakdown, format: string): string {
  switch (format.toLowerCase()) {
    case "json": {
      return JSON.stringify(result, null, 2);
    }
    case "csv": {
      const headers = Object.keys(result).join(",");
      const values = Object.values(result).join(",");
      return `${headers}\n${values}`;
    }
    case "table":
    default: {
      const rows: string[] = [];

      // Conference Details Section
      rows.push(formatSectionHeader("Conference Details", true));
      rows.push(formatTableRow("Name", result.conference));
      rows.push(formatTableRow("Location", result.location));
      rows.push(formatTableRow("Start Date", result.conference_start));
      rows.push(formatTableRow("End Date", result.conference_end || result.conference_start));

      // Travel Dates Section
      rows.push(formatSectionHeader("Travel Dates"));
      rows.push(formatTableRow("Departure", result.flight_departure));
      rows.push(formatTableRow("Return", result.flight_return));

      // Travel Costs Section
      rows.push(formatSectionHeader("Travel Costs"));
      rows.push(formatTableRow("Flight", `${formatCurrency(result.flight_cost)} (${result.flight_price_source})`));
      rows.push(formatTableRow("Lodging", formatCurrency(result.lodging_cost)));
      rows.push(formatTableRow("Meals", formatCurrency(result.meals_cost)));
      rows.push(formatTableRow("Local Transport", formatCurrency(result.local_transport_cost)));

      // Additional Costs Section
      rows.push(formatSectionHeader("Additional Costs"));
      rows.push(formatTableRow("Conference Ticket", formatCurrency(result.ticket_price)));
      rows.push(formatTableRow("Internet Data", formatCurrency(result.internet_data_allowance)));
      rows.push(formatTableRow("Incidentals", formatCurrency(result.incidentals_allowance)));

      // Total Section
      rows.push(`├${"─".repeat(22)}┼${"─".repeat(27)}┤`);
      rows.push(formatTableRow("Total Stipend", formatCurrency(result.total_stipend), false, true));
      rows.push(`└${"─".repeat(22)}┴${"─".repeat(27)}┘`);

      return "\n" + rows.join("\n");
    }
  }
}

async function main() {
  try {
    console.log("Starting travel stipend calculation...");

    // Get inputs from environment variables (set by GitHub Actions)
    const inputs = getActionInputs();

    if (!inputs.location || !inputs.conferenceStart) {
      throw new Error("Missing required inputs: destination and start date are required");
    }

    // Construct conference object
    const conference = await constructConference(inputs);

    // Calculate stipend
    console.log("\nCalculating stipend for:", conference.conference);
    console.log("Location:", conference.location);
    console.log("Dates:", conference.start_date, "to", conference.end_date ?? conference.start_date);

    const result = await calculateStipend(conference);

    // Format and output results
    // Write JSON to file first to ensure we have a clean JSON output
    const outputJson = JSON.stringify(result, null, 2);
    fs.writeFileSync('result.json', outputJson);

    // Then show the formatted output
    const output = formatOutput(result, inputs.outputFormat);
    console.log(output);

    // Set GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `result=${outputJson}\n`);
    }
  } catch (error) {
    console.error("Error calculating travel stipend:", error);
    process.exit(1);
  } finally {
    // Always close the database connection
    await DatabaseService.getInstance().close();
  }
}

// Run the script
main().catch(console.error);
