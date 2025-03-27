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
      let output = "\nStipend Calculation Results:\n";
      output += "-".repeat(50) + "\n\n";

      // Group 1: Conference Info
      output += `Conference: ${result.conference}\n`;
      output += `Location: ${result.location}\n`;
      output += `Conference Start: ${result.conference_start}\n`;
      output += `Conference End: ${result.conference_end}\n\n`;

      // Group 2: Travel Dates
      output += `Flight Departure: ${result.flight_departure}\n`;
      output += `Flight Return: ${result.flight_return}\n\n`;

      // Group 3: Travel Costs
      const formatCurrency = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      output += "Travel Costs:\n";
      output += `Flight Cost: ${formatCurrency(result.flight_cost)} (Source: ${result.flight_price_source})\n`;
      output += `Lodging Cost: ${formatCurrency(result.lodging_cost)}\n`;
      output += `Meals Cost: ${formatCurrency(result.meals_cost)}\n`;
      output += `Local Transport Cost: ${formatCurrency(result.local_transport_cost)}\n\n`;

      // Group 4: Additional Costs
      output += "Additional Costs:\n";
      output += `Conference Ticket: ${formatCurrency(result.ticket_price)}\n`;
      output += `Internet Data: ${formatCurrency(result.internet_data_allowance)}\n`;
      output += `Incidentals: ${formatCurrency(result.incidentals_allowance)}\n\n`;

      // Group 5: Total
      output += `Total Stipend: ${formatCurrency(result.total_stipend)}\n`;

      output += "\n" + "-".repeat(50);
      return output;
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
    const output = formatOutput(result, inputs.outputFormat);
    console.log(output);

    // Set GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `result=${JSON.stringify(result)}\n`);
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
