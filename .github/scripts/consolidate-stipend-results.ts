#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import { StipendBreakdown } from "../../src/types";

interface ConsolidatedResults {
  results: StipendBreakdown[];
  totals: {
    conferences: number;
    flight_cost: number;
    lodging_cost: number;
    meals_cost: number;
    local_transport_cost: number;
    ticket_price: number;
    internet_data_allowance: number;
    incidentals_allowance: number;
    total_stipend: number;
  };
}

// Helper function to format currency values
const formatCurrency = (value: number | undefined) => {
  if (value === undefined) return "$0.00";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format consolidated results as a markdown table
function formatMarkdownTable(consolidatedResults: ConsolidatedResults): string {
  const { results, totals } = consolidatedResults;

  // Sort results by conference start date
  results.sort((a, b) => {
    const dateA = new Date(a.conference_start);
    const dateB = new Date(b.conference_start);
    return dateA.getTime() - dateB.getTime();
  });

  let markdown = "# Travel Stipend Calculations Summary\n\n";

  // Add summary info
  markdown += `**Total Conferences:** ${totals.conferences}\n`;
  markdown += `**Total Stipend Amount:** ${formatCurrency(totals.total_stipend)}\n\n`;

  // Create the main table
  markdown += "## Detailed Results\n\n";
  markdown += "| Conference | Origin | Destination | Dates | Flight | Lodging | Meals | Transport | Ticket | Internet | Incidentals | Total |\n"; // Replaced Misc. with individual columns
  markdown += "|------------|--------|-------------|-------|--------|---------|-------|-----------|--------|----------|-------------|-------|\n"; // Adjusted separator lengths

  // Add a row for each result
  for (const result of results) {
    const dates = `${result.flight_departure} - ${result.flight_return}`;
    // Removed misc calculation

    markdown += `| ${result.conference} | ${result.origin} | ${result.destination} | ${dates} | ` + // Added result.origin
      `${formatCurrency(result.flight_cost)} | ${formatCurrency(result.lodging_cost)} | ` +
      `${formatCurrency(result.meals_cost)} | ${formatCurrency(result.local_transport_cost)} | ` +
      `${formatCurrency(result.ticket_price)} | ${formatCurrency(result.internet_data_allowance)} | ${formatCurrency(result.incidentals_allowance)} | ` + // Added individual columns
      `${formatCurrency(result.total_stipend)} |\n`;
  }

  // Add a totals row
  markdown += `| **TOTALS** | | | | ${formatCurrency(totals.flight_cost)} | ` + // Added empty cell for Origin column
    `${formatCurrency(totals.lodging_cost)} | ${formatCurrency(totals.meals_cost)} | ` +
    `${formatCurrency(totals.local_transport_cost)} | ` +
    `${formatCurrency(totals.ticket_price)} | ${formatCurrency(totals.internet_data_allowance)} | ${formatCurrency(totals.incidentals_allowance)} | ` + // Added individual totals
    `${formatCurrency(totals.total_stipend)} |\n\n`;

  // Add detailed section for each trip
  markdown += "## Individual Trip Details\n\n";

  for (const result of results) {
    markdown += `### ${result.conference} (${result.destination})\n\n`; // Changed result.location to result.destination

    markdown += "| Category | Amount |\n";
    markdown += "|----------|--------|\n";
    markdown += `| Conference | ${result.conference} |\n`;
    markdown += `| Origin | ${result.origin} |\n`; // Added Origin row
    markdown += `| Destination | ${result.destination} |\n`; // Changed Location to Destination and result.location to result.destination
    markdown += `| Conference Start | ${result.conference_start} |\n`;
    markdown += `| Conference End | ${result.conference_end} |\n`;
    markdown += `| Flight Departure | ${result.flight_departure} |\n`;
    markdown += `| Flight Return | ${result.flight_return} |\n`;
    markdown += `| Flight Cost | ${formatCurrency(result.flight_cost)} (${result.flight_price_source}) |\n`;
    markdown += `| Lodging Cost | ${formatCurrency(result.lodging_cost)} |\n`;
    markdown += `| Meals Cost | ${formatCurrency(result.meals_cost)} |\n`;
    markdown += `| Local Transport | ${formatCurrency(result.local_transport_cost)} |\n`;
    markdown += `| Ticket Price | ${formatCurrency(result.ticket_price)} |\n`;
    markdown += `| Internet/Data | ${formatCurrency(result.internet_data_allowance)} |\n`;
    markdown += `| Incidentals | ${formatCurrency(result.incidentals_allowance)} |\n`;
    markdown += `| **Total Stipend** | **${formatCurrency(result.total_stipend)}** |\n\n`;
  }

  return markdown;
}

// Format consolidated results as JSON
function formatJSON(consolidatedResults: ConsolidatedResults): string {
  return JSON.stringify(consolidatedResults, null, 2);
}

// Format consolidated results as CSV
function formatCSV(consolidatedResults: ConsolidatedResults): string {
  const { results } = consolidatedResults;

  // Create header row
  const headers = [
    "Conference",
    "Origin", // Added Origin
    "Destination", // Changed Location to Destination
    "Start Date",
    "End Date",
    "Flight Departure",
    "Flight Return",
    "Flight Cost",
    "Flight Source",
    "Lodging Cost",
    "Meals Cost",
    "Transport Cost",
    "Ticket Price",
    "Internet/Data",
    "Incidentals",
    "Total Stipend"
  ];

  let csv = headers.join(",") + "\n";

  // Add data rows
  for (const result of results) {
    const row = [
      `"${result.conference}"`,
      `"${result.origin}"`, // Added result.origin
      `"${result.destination}"`, // Changed result.location to result.destination
      `"${result.conference_start}"`,
      `"${result.conference_end}"`,
      `"${result.flight_departure}"`,
      `"${result.flight_return}"`,
      result.flight_cost,
      `"${result.flight_price_source}"`,
      result.lodging_cost,
      result.meals_cost,
      result.local_transport_cost,
      result.ticket_price,
      result.internet_data_allowance,
      result.incidentals_allowance,
      result.total_stipend
    ];

    csv += row.join(",") + "\n";
  }

  return csv;
}

async function consolidateResults() {
  try {
    console.log("Reading GitHub step outputs...");

    // In GitHub Actions, we can read output from previous jobs
    // This will be accessed through the GITHUB_OUTPUT files
    // But for testing and development, we'll use sample data or read from files

    const results: StipendBreakdown[] = [];

    // Here we have two approaches:
    // 1. In GitHub Actions: access outputs from needs.calculate.outputs
    // 2. For local testing/development: read from files

    // Check if running in GitHub Actions
    if (process.env.GITHUB_STEP_SUMMARY) {
      // Get the workflow json
      // This check was incorrect - GITHUB_OUTPUT points to a file for setting outputs,
      // not the directory containing results. We should always try to read if in Actions.
      // const workflowJsonPath = process.env.GITHUB_OUTPUT || "";
      // if (fs.existsSync(workflowJsonPath)) {

      const resultsDir = path.join(process.cwd(), "matrix-results");
      if (fs.existsSync(resultsDir)) { // Check if the results directory exists
        const files = fs.readdirSync(resultsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(resultsDir, file); // Use resultsDir variable
            console.log(`Processing file: ${filePath}`); // Log file being processed
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const result = JSON.parse(content); // Parse first, then validate type

              // More detailed validation
              const isValid = result &&
                              typeof result.conference === 'string' &&
                              typeof result.origin === 'string' &&
                              typeof result.destination === 'string' &&
                              typeof result.total_stipend === 'number';

              if (isValid) {
                console.log(`Validation PASSED for ${file}`);
                results.push(result as StipendBreakdown);
              } else {
                console.error(`Validation FAILED for ${file}. Missing/invalid fields:`);
                if (!result) console.error(' - Result object is null or undefined');
                if (typeof result?.conference !== 'string') console.error(' - Invalid or missing conference');
                if (typeof result?.origin !== 'string') console.error(' - Invalid or missing origin');
                if (typeof result?.destination !== 'string') console.error(' - Invalid or missing destination');
                if (typeof result?.total_stipend !== 'number') console.error(' - Invalid or missing total_stipend');
              }
            } catch (e) {
              console.error(`Failed to read or parse ${file}:`, e);
            }
          }
        }
      } else {
        console.warn(`Warning: Results directory not found at ${resultsDir}`);
      }
      // } // End of original incorrect if block
    } else {
      // Dev/test mode - check for files in a specific directory
      console.log("Running in development/testing mode");

      // Create a sample directory for development/testing
      const sampleDir = path.join(process.cwd(), "sample-results");
      if (!fs.existsSync(sampleDir)) {
        fs.mkdirSync(sampleDir, { recursive: true });
      }

      // Look for result files
      const files = fs.readdirSync(sampleDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(sampleDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const result = JSON.parse(content) as StipendBreakdown;
            results.push(result);
          } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
          }
        }
      }

      // If no files found, use a sample result for testing
      if (results.length === 0) {
        console.log("No result files found, using sample data");
        results.push({
          conference: "Sample Conference",
          origin: "Seoul, South Korea", // Added missing origin
          destination: "Tokyo, Japan", // Changed location to destination
          conference_start: "May 15",
          conference_end: "May 17",
          flight_departure: "14 May",
          flight_return: "18 May",
          flight_cost: 450,
          flight_price_source: "Google Flights",
          lodging_cost: 800,
          meals_cost: 350,
          basic_meals_cost: 200,
          business_entertainment_cost: 150,
          local_transport_cost: 100,
          ticket_price: 300,
          internet_data_allowance: 25,
          incidentals_allowance: 125,
          total_stipend: 2150
        });

        results.push({
          conference: "Sample Conference 2",
          origin: "Seoul, South Korea", // Added missing origin
          destination: "San Francisco, USA", // Changed location to destination
          conference_start: "Jun 20",
          conference_end: "Jun 22",
          flight_departure: "19 June",
          flight_return: "23 June",
          flight_cost: 950,
          flight_price_source: "Google Flights",
          lodging_cost: 1200,
          meals_cost: 450,
          basic_meals_cost: 300,
          business_entertainment_cost: 150,
          local_transport_cost: 150,
          ticket_price: 500,
          internet_data_allowance: 25,
          incidentals_allowance: 125,
          total_stipend: 3400
        });
      }
    }

    console.log(`Found ${results.length} result(s)`);

    // Calculate totals
    const totals = {
      conferences: results.length,
      flight_cost: 0,
      lodging_cost: 0,
      meals_cost: 0,
      local_transport_cost: 0,
      ticket_price: 0,
      internet_data_allowance: 0,
      incidentals_allowance: 0,
      total_stipend: 0
    };

    for (const result of results) {
      totals.flight_cost += result.flight_cost;
      totals.lodging_cost += result.lodging_cost;
      totals.meals_cost += result.meals_cost;
      totals.local_transport_cost += result.local_transport_cost;
      totals.ticket_price += result.ticket_price;
      totals.internet_data_allowance += result.internet_data_allowance;
      totals.incidentals_allowance += result.incidentals_allowance;
      totals.total_stipend += result.total_stipend;
    }

    const consolidatedResults: ConsolidatedResults = {
      results,
      totals
    };

    // Create output directory
    const outputDir = path.join(process.cwd(), "consolidated-results");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate outputs in different formats
    const markdown = formatMarkdownTable(consolidatedResults);
    const json = formatJSON(consolidatedResults);
    const csv = formatCSV(consolidatedResults);

    // Write outputs to files
    fs.writeFileSync(path.join(outputDir, "results.md"), markdown);
    fs.writeFileSync(path.join(outputDir, "results.json"), json);
    fs.writeFileSync(path.join(outputDir, "results.csv"), csv);

    // Also write the main result to the project root for easier access
    fs.writeFileSync("consolidated-results.md", markdown);

    // If running in GitHub Actions, write to step summary
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    }

    console.log("Consolidated results written to:");
    console.log("- consolidated-results.md (Markdown table)");
    console.log("- consolidated-results/results.json (JSON format)");
    console.log("- consolidated-results/results.csv (CSV format)");

  } catch (error) {
    console.error("Error consolidating results:", error);
    process.exit(1);
  }
}

// Run the script
consolidateResults().catch(console.error);
