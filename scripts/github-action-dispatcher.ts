#!/usr/bin/env bun
import * as core from "@actions/core";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Page } from "puppeteer";

// Types for enhanced screenshot options
interface ScreenshotOptions {
  fullPage?: boolean;
  captureHtml?: boolean;
  logDOM?: boolean;
  highlightElements?: string[];
  dumpConsole?: boolean;
}

// Types for browser environment setup
interface BrowserSetupOptions {
  timeout: number;
  debugMode: boolean;
  screenshotMode: "disabled" | "enabled" | "error-only";
}

// Constants for browser setup
const ARTIFACT_DIRS = {
  screenshots: "test-screenshots",
  logs: "debug-logs",
  html: "html-captures",
};

// Enhanced screenshot handler
async function enhancedScreenshot(
  page: Page,
  description: string,
  options: ScreenshotOptions = {}
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseFilename = `${timestamp}-${description.replace(/[^a-z0-9]/gi, "-")}`;

  try {
    // Ensure directories exist
    Object.values(ARTIFACT_DIRS).forEach(dir => {
      mkdirSync(dir, { recursive: true });
    });

    // Take screenshot
    await page.screenshot({
      path: join(ARTIFACT_DIRS.screenshots, `${baseFilename}.png`),
      fullPage: options.fullPage ?? false,
    });

    // Capture HTML if requested
    if (options.captureHtml) {
      const html = await page.content();
      appendFileSync(
        join(ARTIFACT_DIRS.html, `${baseFilename}.html`),
        html
      );
    }

    // Log DOM structure if requested
    if (options.logDOM) {
      const domStructure = await page.evaluate(() => document.documentElement.outerHTML);
      appendFileSync(
        join(ARTIFACT_DIRS.logs, `${baseFilename}-dom.txt`),
        domStructure
      );
    }

    // Capture console logs if requested
    if (options.dumpConsole) {
      const logs: string[] = [];
      page.on("console", (msg) => {
        logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      });

      // Wait a bit to collect logs
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the collected logs
      const consoleLogs = logs;

      appendFileSync(
        join(ARTIFACT_DIRS.logs, `${baseFilename}-console.log`),
        consoleLogs.join("\n")
      );
    }

    // Log screenshot capture
    core.info(`Captured ${description} screenshot and artifacts`);

  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Failed to capture ${description} artifacts: ${error.message}`);
    } else {
      core.warning(`Failed to capture ${description} artifacts: Unknown error`);
    }
  }
}

// Environment configuration
function setupEnvironment(): BrowserSetupOptions {
  let screenshotMode: BrowserSetupOptions["screenshotMode"] = "disabled";

  if (process.env.CAPTURE_SCREENSHOTS === "true") {
    screenshotMode = "enabled";
  } else if (process.env.ENABLE_ERROR_SCREENSHOTS === "true") {
    screenshotMode = "error-only";
  }

  return {
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT ?? "60000", 10),
    debugMode: process.env.DEBUG_GOOGLE_FLIGHTS === "true",
    screenshotMode,
  };
}

// Puppeteer launch arguments for GitHub Actions
function getBrowserLaunchArgs() {
  return [
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-setuid-sandbox",
    "--no-sandbox",
    "--window-size=1920,1080",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--disable-extensions",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-site-isolation-trials",
  ];
}

// Enhanced error handler
async function handleError(page: Page, error: Error, context: string): Promise<void> {
  try {
    await enhancedScreenshot(page, `error-${context}`, {
      fullPage: true,
      captureHtml: true,
      logDOM: true,
      dumpConsole: true,
    });

    const errorDetails = {
      message: error.message,
      stack: error.stack,
      pageUrl: page.url(),
      timestamp: new Date().toISOString(),
    };

    appendFileSync(
      join(ARTIFACT_DIRS.logs, "error-log.json"),
      JSON.stringify(errorDetails, null, 2) + "\n"
    );

    core.error(`Error in ${context}: ${error.message}`);
  } catch (captureError) {
    if (captureError instanceof Error) {
      core.error(`Failed to capture error details: ${captureError.message}`);
    } else {
      core.error("Failed to capture error details: Unknown error");
    }
  }
}

// Browser session recovery
async function attemptSessionRecovery(page: Page): Promise<boolean> {
  try {
    // Clear cookies and cache using CDP
    const cdpClient = await page.createCDPSession();
    await cdpClient.send('Network.clearBrowserCookies');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload the page
    await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });

    return true;
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Session recovery failed: ${error.message}`);
    } else {
      core.warning("Session recovery failed: Unknown error");
    }
    return false;
  }
}

// Retry mechanism with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error("Unknown error during retry");
      }
      if (attempt === maxAttempts) break;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      core.warning(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Operation failed after max attempts");
}

export {
  ARTIFACT_DIRS, attemptSessionRecovery, enhancedScreenshot, getBrowserLaunchArgs,
  handleError, setupEnvironment, withRetry, type BrowserSetupOptions,
  type ScreenshotOptions
};
