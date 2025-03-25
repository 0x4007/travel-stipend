import { CURRENT_LOG_LEVEL, LOG_LEVEL, errorSummary, logFile } from "./config";

// Define a more specific type for the log arguments
type LogArg = string | number | boolean | object | Error | null | undefined;

/**
 * Logs a message based on the current log level
 * - In GitHub Actions, only WARN and ERROR logs will be shown in console by default
 * - All logs are still written to the log file regardless of console output
 * - ERROR logs are collected in errorSummary for end-of-run reporting
 */
export function log(level: number, ...args: LogArg[]): void {
  const timestamp = new Date().toISOString();
  const levelName = Object.keys(LOG_LEVEL).find((key) => LOG_LEVEL[key as keyof typeof LOG_LEVEL] === level) ?? "UNKNOWN";

  // Format the message
  const message = `[${timestamp}] [${levelName}] ${args.map((arg) => {
    if (arg instanceof Error) {
      return `${arg.message} ${arg.stack ?? ''}`;
    }
    return typeof arg === "object" ? JSON.stringify(arg) : arg;
  }).join(" ")}`;

  // Always write to log file regardless of level
  logFile.write(message + "\n");

  // Only output to console based on level
  if (level >= CURRENT_LOG_LEVEL) {
    // In GitHub Actions environment, we further restrict console output
    const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);
    const shouldSkipInGitHub = isGitHubActions && level < LOG_LEVEL.WARN;

    if (!shouldSkipInGitHub) {
      // Check if the first argument is an Error
      const hasError = args.some(arg => arg instanceof Error);

      // Use appropriate console method based on level
      if (level === LOG_LEVEL.ERROR) {
        console.error(message);

        // Store errors for summary
        errorSummary.push(message);
      } else if (level === LOG_LEVEL.WARN) {
        console.warn(message);
      } else if (hasError) {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }
}

/**
 * Get formatted error summary for end of execution
 */
export function getErrorSummary(): string {
  if (errorSummary.length === 0) {
    return "No errors encountered during execution";
  }

  return `${errorSummary.length} error(s) encountered:\n${errorSummary.join("\n")}`;
}
