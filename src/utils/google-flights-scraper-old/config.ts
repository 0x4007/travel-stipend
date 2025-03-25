import * as fs from "fs";
import * as path from "path";

// Configure logging
export const LOG_LEVEL = {
  NETWORK: -1, // Lower level for network requests
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Parse log levels from environment variable
function parseLogLevel(): number {
  const envLogLevel = process.env.LOG_LEVEL ?? "";

  // Default to ERROR,WARNING in GitHub Actions, INFO locally
  if (!envLogLevel) {
    return process.env.GITHUB_ACTIONS ? LOG_LEVEL.WARN : LOG_LEVEL.INFO;
  }

  // Parse comma-separated log levels
  const levels = envLogLevel.toLowerCase().split(',');

  if (levels.includes('debug') || levels.includes('all')) {
    return LOG_LEVEL.DEBUG;
  }

  if (levels.includes('info')) {
    return LOG_LEVEL.INFO;
  }

  if (levels.includes('warning') || levels.includes('warn')) {
    return LOG_LEVEL.WARN;
  }

  if (levels.includes('error') || levels.includes('errors')) {
    return LOG_LEVEL.ERROR;
  }

  return LOG_LEVEL.WARN; // Default
}

// Use configured log level from environment
export const CURRENT_LOG_LEVEL = parseLogLevel();

// Use GitHub Action artifact directories if available
export const SCREENSHOTS_DIR = path.join(process.cwd(), "debug-screenshots");
export const LOGS_DIR = path.join(process.cwd(), "debug-logs");

// Ensure log directories exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Collected errors for summary
export const errorSummary: string[] = [];

// Create log file stream with ISO timestamp
export const logFile = fs.createWriteStream(
  path.join(LOGS_DIR, `google-flights-${new Date().toISOString().replace(/:/g, "-")}.log`)
);
