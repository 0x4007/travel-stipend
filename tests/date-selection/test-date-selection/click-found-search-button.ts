import * as puppeteer from "puppeteer";

export async function clickFoundSearchButton(page: puppeteer.Page, searchButton: puppeteer.ElementHandle<Element>): Promise<void> {
  console.log("Found search button, clicking it...");

  try {
    // Take screenshot before clicking
    await page.screenshot({ path: `./logs/screenshots/before-search-button-click-${Date.now()}.png` });

    // Try standard click first
    await searchButton.click().catch(async (error) => {
      console.log("Standard click failed:", error instanceof Error ? error.message : String(error));

      // If standard click fails, try JavaScript click
      console.log("Trying JavaScript click as fallback...");
      await page.evaluate((element: Element) => {
        (element as HTMLElement).click();

        // Also dispatch events for good measure
        const clickEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(clickEvent);
      }, searchButton);
    });

    console.log("Clicked search button");

    // Wait for results to load
    console.log("Waiting for search results to load...");
    await page
      .waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
      .catch(() => console.log("Navigation timeout waiting for results, continuing anyway"));

    console.log("Search results loaded or timeout occurred");
  } catch (clickError) {
    console.log("Error clicking search button:", clickError instanceof Error ? clickError.message : String(clickError));

    // If clicking fails, try pressing Enter as a last resort
    console.log("Click failed, trying to press Enter as fallback...");
    await page.keyboard.press("Enter");
    console.log("Pressed Enter key");

    // Wait for possible navigation
    try {
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {
        console.log("No navigation occurred after pressing Enter");
      });
    } catch (navError) {
      console.log("Error waiting for navigation after pressing Enter:", navError instanceof Error ? navError.message : String(navError));
    }
  }
}
