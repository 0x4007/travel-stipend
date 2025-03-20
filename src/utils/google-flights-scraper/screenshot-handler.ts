import * as fs from "fs";
import * as path from "path";
import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

/**
 * Takes a screenshot of the current page state and saves it to the specified directory
 * @param page Puppeteer page object
 * @param destination Destination city for the search (used in filename)
 * @param type Type of screenshot (e.g., 'verification', 'destination', 'filters')
 * @returns Path to the saved screenshot
 */
export async function takeScreenshot(
  page: Page,
  destination: string,
  type: string
): Promise<string> {
  try {
    // Create timestamp-based directory structure
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const dirPath = path.join("test-screenshots", timestamp.split("T")[0]);

    // Ensure directory exists
    if (!fs.existsSync("test-screenshots")) {
      fs.mkdirSync("test-screenshots");
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Sanitize destination for filename
    const sanitizedDestination = destination
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-)|(-$)/g, "");

    // Create filename
    const filename = `${sanitizedDestination}-${type}.png`;
    const filePath = path.join(dirPath, filename);

    // Take screenshot
    await page.screenshot({ path: filePath, fullPage: false });

    log(LOG_LEVEL.INFO, `Screenshot saved to ${filePath}`);
    return filePath;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error taking screenshot:", error instanceof Error ? error.message : String(error));
    return "screenshot-failed";
  }
}
