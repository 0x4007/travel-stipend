import { CURRENT_LOG_LEVEL, LOG_LEVEL, logFile } from "./config";

// Define a more specific type for the log arguments
type LogArg = string | number | boolean | object | Error | null | undefined;

export function log(level: number, ...args: LogArg[]): void {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVEL).find(key => LOG_LEVEL[key as keyof typeof LOG_LEVEL] === level) ?? "UNKNOWN";

    const message = `[${timestamp}] [${levelName}] ${args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : arg
    ).join(" ")}`;

    console.log(message);
    logFile.write(message + "\n");
  }
}
