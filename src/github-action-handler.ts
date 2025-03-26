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
}

function getActionInputs(): ActionInputs {
  return {
    location: process.env.INPUT_LOCATION ?? "",
    conferenceStart: process.env.INPUT_CONFERENCE_START ?? "",
    conferenceEnd: process.env.INPUT_CONFERENCE_END ?? "",
    conferenceName: process.env.INPUT_CONFERENCE_NAME ?? "",
    daysBefore: parseInt(process.env.INPUT_DAYS_BEFORE ?? "1"),
    daysAfter: parseInt(process.env.INPUT_DAYS_AFTER ?? "1"),
    ticketPrice: process.env.INPUT_TICKET_PRICE ?? "0",
    outputFormat: process.env.INPUT_OUTPUT_FORMAT ?? "table"
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
    origin: process.env.ORIGIN ?? "Seoul, South Korea", // Default origin
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
      output += "-".repeat(50) + "\n";
      for (const [key, value] of Object.entries(result)) {
        // Format currency values
        const formattedValue = typeof value === "number"
          ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value;
        output += `${key.replace(/_/g, " ").split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")}: ${formattedValue}\n`;
      }
      output += "-".repeat(50);
      return output;
    }
  }
}

async function main() {
  try {
    console.log("Starting travel stipend calculation...");

    // Get inputs from environment variables (set by GitHub Actions)
    const inputs = getActionInputs();

    if (!inputs.location || !inputs.conferenceName || !inputs.conferenceStart) {
      throw new Error("Missing required inputs: location, conference name, and start date are required");
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
