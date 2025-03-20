import * as puppeteer from "puppeteer";

export async function takeResultScreenshot(page: puppeteer.Page): Promise<void> {
  const screenshotPath = `./logs/screenshots/flight-search-results-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to: ${screenshotPath}`);
}
