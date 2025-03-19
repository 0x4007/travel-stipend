import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { LOG_LEVEL } from "./config";
import { log } from "./log";
import { BrowserInitOptions } from "./types";

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export async function initializeBrowser(options: BrowserInitOptions = { headless: false }): Promise<{ browser: Browser; page: Page }> {
  log(LOG_LEVEL.INFO, "Launching browser");
  const browser = await puppeteer.launch({
    headless: options.headless, // Set to true for production
    defaultViewport: { width: 1366, height: 768 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1366,768",
    ],
  });

  log(LOG_LEVEL.INFO, "Creating new page");
  const page = await browser.newPage();

  // Set user agent
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

  // Set extra HTTP headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });

  // Enable request interception for logging
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    log(LOG_LEVEL.DEBUG, `Request: ${request.method()} ${request.url()}`);
    void request.continue();
  });

  // Log responses
  page.on("response", (response) => {
    log(LOG_LEVEL.DEBUG, `Response: ${response.status()} ${response.url()}`);
  });

  // Log console messages from the page
  page.on("console", (msg) => {
    log(LOG_LEVEL.DEBUG, `Console [${msg.type()}]: ${msg.text()}`);
  });

  // Log errors
  page.on("error", (error) => {
    log(LOG_LEVEL.ERROR, "Page error:", error);
  });

  // Log page errors
  page.on("pageerror", (error) => {
    log(LOG_LEVEL.ERROR, "Page JavaScript error:", error);
  });

  log(LOG_LEVEL.INFO, "Browser and page initialized");
  return { browser, page };
}

export async function closeBrowser(browser: Browser): Promise<void> {
  log(LOG_LEVEL.INFO, "Closing browser");
  if (browser) {
    await browser.close();
  }
  log(LOG_LEVEL.INFO, "Browser closed");
}
