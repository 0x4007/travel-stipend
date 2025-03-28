import { execSync } from 'child_process'; // For running curl
import { config } from "dotenv";
import fs from "fs";
import { calculateStipend } from "./travel-stipend-calculator";
import { Conference, LogCallback, StipendBreakdown } from "./types"; // Import LogCallback

// Load environment variables (primarily for local testing if needed)
config();

interface ActionInputs {
  origin: string; // Added origin
  location: string; // Destination
  conferenceStart: string;
  conferenceEnd: string;
  conferenceName: string;
  daysBefore: number;
  daysAfter: number;
  ticketPrice: string;
  outputFormat: string;
  includeBudget: boolean;
  // Callback related inputs from workflow env
  clientId?: string;
  callbackUrl?: string;
  callbackSecret?: string;
}

function getActionInputs(): ActionInputs {
  // Read from process.env, which includes workflow env vars
  return {
    origin: process.env.INPUT_ORIGIN ?? "", // Read origin
    location: process.env.INPUT_DESTINATION ?? "",
    conferenceStart: process.env.INPUT_CONFERENCE_START ?? "",
    conferenceEnd: process.env.INPUT_CONFERENCE_END ?? "",
    conferenceName: process.env.INPUT_CONFERENCE_NAME ?? `Conference in ${process.env.INPUT_DESTINATION ?? "destination"}`,
    daysBefore: parseInt(process.env.INPUT_DAYS_BEFORE ?? "1"),
    daysAfter: parseInt(process.env.INPUT_DAYS_AFTER ?? "1"),
    ticketPrice: process.env.INPUT_TICKET_PRICE ?? "0",
    outputFormat: process.env.INPUT_OUTPUT_FORMAT ?? 'table', // Default to table for logs if not specified
    includeBudget: process.env.INPUT_INCLUDE_BUDGET === "true",
    // Get callback info from env set in the job
    clientId: process.env.CLIENT_ID, // Matches env var set in workflow job
    callbackUrl: process.env.PROXY_CALLBACK_URL, // Matches env var set in workflow job
    callbackSecret: process.env.PROXY_CALLBACK_SECRET, // Matches env var set in workflow job
  };
}

async function constructConference(inputs: ActionInputs): Promise<Conference> {
  // Ensure origin is included in the Conference object for calculateStipend
  return {
    category: "Custom",
    conference: inputs.conferenceName,
    location: inputs.location, // This is the destination
    origin: inputs.origin, // Pass origin explicitly
    start_date: inputs.conferenceStart,
    end_date: inputs.conferenceEnd,
    buffer_days_before: inputs.daysBefore,
    buffer_days_after: inputs.daysAfter,
    ticket_price: inputs.ticketPrice,
    includeBudget: inputs.includeBudget,
  };
}

// --- Log Callback Function ---
function createLogCallback(clientId?: string, callbackUrl?: string, callbackSecret?: string): LogCallback | undefined {
    // Only create a callback if all necessary info is present
    if (!clientId || !callbackUrl || !callbackSecret) {
        console.log("Callback info missing, logging to console only.");
        return undefined;
    }

    // Construct the full log endpoint URL
    // Ensure no double slashes if callbackUrl already ends with /
    const logEndpoint = callbackUrl.replace(/\/api\/workflow-complete$/, '/api/log-message');
    console.log(`Log callback configured for client ${clientId} at ${logEndpoint}`);

    return (logMessage: string) => {
        try {
            const timestamp = new Date().toISOString(); // Use ISO format for consistency
            const payload = JSON.stringify({
                clientId: clientId,
                message: `[Action Log] ${logMessage}` // Add prefix
            });

            // Escape payload for shell command
            const escapedPayload = payload.replace(/'/g, "'\\''"); // Basic escaping for single quotes

            // Use curl to send log message asynchronously (fire and forget)
            const command = `curl -X POST -H 'Content-Type: application/json' -H 'X-Callback-Secret: ${callbackSecret}' -d '${escapedPayload}' '${logEndpoint}' --silent --output /dev/null &`;

            // Log the command for debugging (optional)
            // console.log(`Executing log callback: ${command}`);

            // Execute curl in the background
            execSync(command);

        } catch (error) {
            // Log errors locally in the Action runner if curl fails
            console.error(`[LogCallback Error] Failed to send log for client ${clientId}:`, error);
        }
    };
}
// --- End Log Callback Function ---


// Helper function to format currency values
function formatCurrency(value: number | undefined) {
  // ... (remains the same) ...
  if (value === undefined) return "$0.00";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper function to create table rows
function formatTableRow(label: string, value: string, isHeader = false, isTotal = false): string {
  // ... (remains the same) ...
  const labelColumn = label.padEnd(20);
  const valueColumn = value.padStart(25);
  let border = "│";
  if (isHeader) border = "├"; else if (isTotal) border = "└";
  return `${border} ${labelColumn} │ ${valueColumn} │`;
}

// Helper function to create section headers
function formatSectionHeader(title: string, isFirst = false): string {
  // ... (remains the same) ...
  const topBorder = isFirst ? "┌" : "├";
  return [`${topBorder}${"─".repeat(22)}┬${"─".repeat(27)}┐`, `│ ${title.padEnd(21)} │${" ".repeat(27)}│`, `├${"─".repeat(22)}┼${"─".repeat(27)}┤`].join("\n");
}

function formatOutput(result: StipendBreakdown, format: string): string {
  // ... (remains the same, handles json, csv, table) ...
   switch (format.toLowerCase()) {
    case "json": return JSON.stringify(result, null, 2);
    case "csv": {
      const headers = Object.keys(result).join(",");
      const values = Object.values(result).join(",");
      return `${headers}\n${values}`;
    }
    case "table": default: {
      const rows: string[] = [];
      rows.push(formatSectionHeader("Conference Details", true));
      rows.push(formatTableRow("Name", result.conference));
      rows.push(formatTableRow("Origin", result.origin));
      rows.push(formatTableRow("Destination", result.destination));
      rows.push(formatTableRow("Start Date", result.conference_start));
      rows.push(formatTableRow("End Date", result.conference_end || result.conference_start));
      rows.push(formatSectionHeader("Travel Dates"));
      rows.push(formatTableRow("Departure", result.flight_departure));
      rows.push(formatTableRow("Return", result.flight_return));
      rows.push(formatSectionHeader("Travel Costs"));
      rows.push(formatTableRow("Flight", `${formatCurrency(result.flight_cost)} (${result.flight_price_source})`));
      rows.push(formatTableRow("Lodging", formatCurrency(result.lodging_cost)));
      rows.push(formatTableRow("Regular Meals", formatCurrency(result.basic_meals_cost)));
      rows.push(formatTableRow("Business Meals", formatCurrency(result.business_entertainment_cost)));
      rows.push(formatTableRow("Local Transport", formatCurrency(result.local_transport_cost)));
      rows.push(formatSectionHeader("Additional Costs"));
      rows.push(formatTableRow("Conference Ticket", formatCurrency(result.ticket_price)));
      rows.push(formatTableRow("Internet Data", formatCurrency(result.internet_data_allowance)));
      rows.push(formatTableRow("Incidentals", formatCurrency(result.incidentals_allowance)));
      rows.push(`├${"─".repeat(22)}┼${"─".repeat(27)}┤`);
      rows.push(formatTableRow("Total Stipend", formatCurrency(result.total_stipend), false, true));
      rows.push(`└${"─".repeat(22)}┴${"─".repeat(27)}┘`);
      return "\n" + rows.join("\n");
    }
  }
}

async function main() {
  try {
    console.log("Starting travel stipend calculation (Action Handler)...");

    const inputs = getActionInputs();
    const outputFileIndex = process.argv.indexOf('--output-file');
    const outputFile = outputFileIndex !== -1 ? process.argv[outputFileIndex + 1] : null;

    // Validate essential inputs read from env/matrix
    if (!inputs.origin || !inputs.location || !inputs.conferenceStart) {
      throw new Error("Missing required inputs: origin, destination, and start date are required");
    }

    // Create the log callback function
    const logCallback = createLogCallback(inputs.clientId, inputs.callbackUrl, inputs.callbackSecret);

    // Construct conference object
    const conference = await constructConference(inputs);

    // Calculate stipend, passing the callback
    logCallback?.("Handler: Calling calculateStipend...");
    const result = await calculateStipend(conference, logCallback);
    logCallback?.("Handler: calculateStipend finished.");

    // Write result JSON to file if specified (used by matrix strategy)
    if (outputFile) {
      console.log(`Writing result to ${outputFile}`);
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    }

    // Output formatted result to console logs (useful for Action logs)
    // Use the format specified by INPUT_OUTPUT_FORMAT (defaults to table)
    console.log("\n--- Stipend Calculation Result ---");
    const output = formatOutput(result, inputs.outputFormat);
    console.log(output);
    console.log("--- End Result ---");


    // Set GitHub Actions output 'result' (used by consolidate job?) - No, consolidate downloads artifacts
    // if (process.env.GITHUB_OUTPUT) {
    //   fs.appendFileSync(process.env.GITHUB_OUTPUT, `result=${JSON.stringify(result)}\n`);
    // }

  } catch (error) {
    console.error("Error calculating travel stipend in Action Handler:", error);
    // Attempt to send error via callback if possible
    const inputs = getActionInputs(); // Re-get inputs to access callback info
    const logCallback = createLogCallback(inputs.clientId, inputs.callbackUrl, inputs.callbackSecret);
    logCallback?.(`FATAL ERROR in Action Handler: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1); // Exit with error code
  } finally {
    // Close DB connection if it was opened by this process
    // DatabaseService is singleton, closing might affect parallel jobs if not careful
    // Let's assume calculateStipend handles its own connections or they close on process exit
    // await DatabaseService.getInstance().close();
  }
}

// Run the script
main().catch(console.error);
