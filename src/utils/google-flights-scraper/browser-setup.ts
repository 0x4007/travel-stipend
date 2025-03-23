import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { LOG_LEVEL } from "./config";
import { log } from "./log";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import * as path from "path";

// Define necessary types locally
interface BrowserInitOptions {
  headless?: boolean;
  executablePath?: string;
  userDataDir?: string;
  timeout?: number;
}

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Helper function to ensure debug directories exist
function ensureDebugDirectories(): void {
  const debugLogDir = path.join(process.cwd(), 'debug-logs');

  if (!existsSync(debugLogDir)) {
    mkdirSync(debugLogDir, { recursive: true });
  }
}

export async function initializeBrowser(options: BrowserInitOptions = { headless: false }): Promise<{ browser: Browser; page: Page }> {
  log(LOG_LEVEL.INFO, "Launching browser");

  // Determine if we're in GitHub Actions to enable additional debugging
  const isGitHubActions = !!process.env.GITHUB_ACTIONS;
  const isDebugMode = process.env.DEBUG_GOOGLE_FLIGHTS === "true";
  const timeout = parseInt(process.env.PUPPETEER_TIMEOUT ?? "30000", 10);

  // Enhanced logging for initialization
  log(LOG_LEVEL.INFO, `Browser initialization details:
    - Environment: ${isGitHubActions ? 'GitHub Actions' : 'Local'}
    - Debug Mode: ${isDebugMode ? 'Enabled' : 'Disabled'}
    - Headless: ${options.headless ? 'Yes' : 'No'}
    - Timeout: ${timeout}ms
  `);

  // Prepare debug directories if needed
  if (isDebugMode || isGitHubActions) {
    ensureDebugDirectories();
  }

  // Enhanced browser launch options for GitHub Actions environment
  const launchOptions = {
    headless: options.headless, // Set to true for production
    defaultViewport: { width: 1366, height: 768 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1366,768",
      "--disable-web-security", // Helps with some CORS issues
      "--disable-features=IsolateOrigins,site-per-process", // Helps with iframe issues
      "--disable-site-isolation-trials",
    ],
    timeout: timeout, // Using the timeout from env var or default
    // If in GitHub Actions, use the executable path from env
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    } : {})
  };

  // Log the launch options
  log(LOG_LEVEL.INFO, `Launch options: ${JSON.stringify(launchOptions, null, 2)}`);

  const browser = await puppeteer.launch(launchOptions);

  log(LOG_LEVEL.INFO, "Browser launched, creating new page");
  const page = await browser.newPage();

  // Get browser and page details for debugging
  const version = await browser.version();
  const userAgent = await browser.userAgent();
  log(LOG_LEVEL.INFO, `Browser version: ${version}`);
  log(LOG_LEVEL.INFO, `Default user agent: ${userAgent}`);

  // Set user agent - more recent one for better compatibility
  const customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  await page.setUserAgent(customUserAgent);
  log(LOG_LEVEL.INFO, `Set custom user agent: ${customUserAgent}`);

  // Set extra HTTP headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
  });

  // Set default navigation timeout
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  log(LOG_LEVEL.INFO, `Set navigation timeout to ${timeout}ms`);

  // Create log collectors
  const requests: Array<{method: string; url: string; timestamp: string}> = [];
  const responses: Array<{status: number; url: string; timestamp: string}> = [];
  const consoleMessages: Array<{type: string; text: string; timestamp: string}> = [];
  const errors: Array<{message: string; timestamp: string}> = [];

  // Enable request interception for logging
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const timestamp = new Date().toISOString();
    const entry = {
      method: request.method(),
      url: request.url(),
      timestamp
    };
    requests.push(entry);

    // Log to console
    log(LOG_LEVEL.NETWORK, `Request: ${request.method()} ${request.url()}`);

    // Write to debug log file if in debug mode
    if (isDebugMode || isGitHubActions) {
      const logFile = path.join(process.cwd(), 'debug-logs', 'requests.json');
      try {
        writeFileSync(logFile, JSON.stringify(requests, null, 2));
      } catch (error) {
        console.error("Error writing to requests log:", error);
      }
    }

    void request.continue();
  });

  // Log responses
  page.on("response", (response) => {
    const timestamp = new Date().toISOString();
    const entry = {
      status: response.status(),
      url: response.url(),
      timestamp
    };
    responses.push(entry);

    log(LOG_LEVEL.NETWORK, `Response: ${response.status()} ${response.url()}`);

    // Write to debug log file if in debug mode
    if (isDebugMode || isGitHubActions) {
      const logFile = path.join(process.cwd(), 'debug-logs', 'responses.json');
      try {
        writeFileSync(logFile, JSON.stringify(responses, null, 2));
      } catch (error) {
        console.error("Error writing to responses log:", error);
      }
    }
  });

  // Log console messages from the page
  page.on("console", (msg) => {
    const timestamp = new Date().toISOString();
    const entry = {
      type: msg.type(),
      text: msg.text(),
      timestamp
    };
    consoleMessages.push(entry);

    log(LOG_LEVEL.DEBUG, `Console [${msg.type()}]: ${msg.text()}`);

    // Write to debug log file if in debug mode
    if (isDebugMode || isGitHubActions) {
      const logFile = path.join(process.cwd(), 'debug-logs', 'console.json');
      try {
        writeFileSync(logFile, JSON.stringify(consoleMessages, null, 2));
      } catch (error) {
        console.error("Error writing to console log:", error);
      }
    }
  });

  // Log errors
  page.on("error", (error) => {
    const timestamp = new Date().toISOString();
    const entry = {
      message: error.message || String(error),
      stack: error.stack,
      timestamp
    };
    errors.push(entry);

    log(LOG_LEVEL.ERROR, "Page error:", error);

    // Write to debug log file if in debug mode
    if (isDebugMode || isGitHubActions) {
      const logFile = path.join(process.cwd(), 'debug-logs', 'errors.json');
      try {
        writeFileSync(logFile, JSON.stringify(errors, null, 2));
      } catch (error) {
        console.error("Error writing to errors log:", error);
      }
    }
  });

  // Log page errors
  page.on("pageerror", (error) => {
    const timestamp = new Date().toISOString();
    const entry = {
      message: error.message || String(error),
      stack: error.stack,
      timestamp
    };
    errors.push(entry);

    log(LOG_LEVEL.ERROR, "Page JavaScript error:", error);

    // Write to debug log file if in debug mode
    if (isDebugMode || isGitHubActions) {
      const logFile = path.join(process.cwd(), 'debug-logs', 'errors.json');
      try {
        writeFileSync(logFile, JSON.stringify(errors, null, 2));
      } catch (error) {
        console.error("Error writing to errors log:", error);
      }
    }
  });

  log(LOG_LEVEL.INFO, "Browser and page initialized");
  return { browser, page };
}

export async function closeBrowser(browser: Browser): Promise<void> {
  log(LOG_LEVEL.INFO, "Closing browser");
  if (browser) {
    try {
      await browser.close();
      log(LOG_LEVEL.INFO, "Browser closed successfully");
    } catch (error) {
      log(LOG_LEVEL.ERROR, "Error closing browser:", error instanceof Error ? error.message : String(error));
    }
  } else {
    log(LOG_LEVEL.WARN, "No browser instance to close");
  }
}
