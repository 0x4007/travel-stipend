import * as fs from "fs";
import * as path from "path";

// Configure logging
export const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export const CURRENT_LOG_LEVEL = LOG_LEVEL.INFO; // Set to DEBUG for more detailed logging
export const SCREENSHOTS_DIR = path.join(process.cwd(), "logs", "screenshots");
const LOGS_DIR = path.join(process.cwd(), "logs");

// Ensure log directories exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Create log file stream
export const logFile = fs.createWriteStream(path.join(LOGS_DIR, `google-flights-${new Date().toISOString().replace(/:/g, "-")}.log`));
