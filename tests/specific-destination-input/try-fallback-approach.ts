import * as puppeteer from "puppeteer";

// Helper function for fallback approach
export async function tryFallbackApproach(page: puppeteer.Page): Promise<void> {
  console.log("Trying fallback approach: Using more general selector + Arrow down + Enter");

  try {
    // Find any input field that might be for destination
    const generalInputSelector = 'input[placeholder*="to"], input[aria-label*="to"], input[role="combobox"]';
    await page.waitForSelector(generalInputSelector, { timeout: 3000 });
    await page.click(generalInputSelector);

    // Clear the field first
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");

    // Type Tokyo again
    await page.keyboard.type("Tokyo", { delay: 100 });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Try arrow down and enter
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Take another screenshot after fallback approach
    const fallbackScreenshotPath = `./logs/screenshots/after-fallback-selection-${Date.now()}.png`;
    await page.screenshot({ path: fallbackScreenshotPath, fullPage: true });
    console.log(`Fallback screenshot saved to: ${fallbackScreenshotPath}`);
  } catch (error) {
    console.error("Error during fallback approach:", error);
    console.log("Fallback approach failed, continuing with debugging");
  }
}
