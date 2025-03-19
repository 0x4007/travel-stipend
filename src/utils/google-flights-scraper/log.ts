import { CURRENT_LOG_LEVEL, LOG_LEVEL, logFile } from "./google-flights-scraper";

// Logger function

export function log(level: number, message: string, data?: unknown) {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVEL).find((key) => LOG_LEVEL[key as keyof typeof LOG_LEVEL] === level) ?? "UNKNOWN";
    const logMessage = `[${timestamp}] [${levelName}] ${message}`;

    console.log(logMessage);
    if (data) {
      console.log(data);
    }

    logFile.write(logMessage + "\n");
    if (data) {
      logFile.write(JSON.stringify(data, null, 2) + "\n");
    }
  }
}
