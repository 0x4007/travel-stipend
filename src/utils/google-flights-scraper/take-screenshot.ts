import * as path from "path";
import { Page } from "puppeteer";
import { LOG_LEVEL, SCREENSHOTS_DIR } from "./google-flights-scraper";
import { log } from "./log";

// Helper function to take screenshots
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}-${new Date().getTime()}.png`);
  log(LOG_LEVEL.DEBUG, `Taking screenshot: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}
