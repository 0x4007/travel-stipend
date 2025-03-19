import { CURRENT_LOG_LEVEL, LOG_LEVEL, logFile } from "./config";

export function log(level: number, ...args: any[]): void {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVEL).find(key => LOG_LEVEL[key as keyof typeof LOG_LEVEL] === level) || "UNKNOWN";

    const message = `[${timestamp}] [${levelName}] ${args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : arg
    ).join(" ")}`;

    console.log(message);
    logFile.write(message + "\n");
  }
}
