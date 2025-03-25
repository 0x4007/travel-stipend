#!/usr/bin/env bun

/**
 * Test script to demonstrate the buffer day parameter functionality
 * Shows how the CLI can be used with custom days for arrival before and departure after
 */

import { spawn } from "child_process";
import fs from "fs";

// Create a directory for test outputs
const outputDir = "test-outputs";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Helper function to run CLI with different parameters and save output
async function runTest(description: string, location: string, conferenceStart: string, daysBefore?: number, daysAfter?: number): Promise<void> {
  return new Promise((resolve) => {
    // Build command with parameters
    const args = ["src/travel-stipend-cli.ts", location, "--conference-start", conferenceStart];

    // Add optional parameters
    if (daysBefore !== undefined) {
      args.push("--days-before", daysBefore.toString());
    }

    if (daysAfter !== undefined) {
      args.push("--days-after", daysAfter.toString());
    }

    // Add output format
    args.push("-o", "table");

    // Create log file name
    const filename = `${outputDir}/${location.replace(/\W+/g, "-")}-before${daysBefore ?? "default"}-after${daysAfter ?? "default"}.log`;
    const logStream = fs.createWriteStream(filename);

    console.log(`\n\n${"-".repeat(80)}`);
    console.log(`RUNNING TEST: ${description}`);
    console.log(`COMMAND: bun ${args.join(" ")}`);
    console.log(`OUTPUT SAVED TO: ${filename}`);
    console.log(`${"-".repeat(80)}\n`);

    // Execute process - use full path to the bun executable for security
    const bunPath = process.execPath; // Get the path to the current bun executable
    console.log(`Using bun at: ${bunPath}`);
    const proc = spawn(bunPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    proc.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output);
      logStream.write(output);
    });

    proc.stderr.on("data", (data) => {
      const output = data.toString();
      console.error(output);
      logStream.write(output);
    });

    proc.on("close", () => {
      logStream.end();
      console.log(`\nTest complete. Output saved to ${filename}`);
      resolve();
    });
  });
}

// Main function to run tests
async function main() {
  console.log("TESTING TRAVEL STIPEND CLI WITH DIFFERENT BUFFER DAY SETTINGS");

  // Test destination
  const location = "Dubai";
  const conferenceStart = "1 April";

  // Run different buffer day configurations
  await runTest("Default buffer (1 day before, 1 day after)", location, conferenceStart);

  await runTest("2 days before, 1 day after", location, conferenceStart, 2);

  await runTest("1 day before, 3 days after", location, conferenceStart, 1, 3);

  await runTest("3 days before, 2 days after", location, conferenceStart, 3, 2);

  await runTest("0 days before, 0 days after (same-day travel)", location, conferenceStart, 0, 0);

  console.log("\nAll tests completed");
}

// Run main function
main().catch((err) => {
  console.error("Error running tests:", err);
  process.exit(1);
});
