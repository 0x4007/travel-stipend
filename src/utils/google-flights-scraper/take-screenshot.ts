import * as fs from "fs";
import * as path from "path";
import { Page } from "puppeteer";
import { LOG_LEVEL, SCREENSHOTS_DIR } from "./config";
import { log } from "./log";

export async function takeScreenshot(page: Page | null, name: string): Promise<void> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot take screenshot: page is null");
    return;
  }

  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    // Generate a filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    // Take the screenshot
    await page.screenshot({ path: filepath, fullPage: false });
    log(LOG_LEVEL.DEBUG, `Screenshot saved: ${filepath}`);
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error taking screenshot:", error);
  }
}
