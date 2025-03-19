import * as puppeteer from "puppeteer";

// Helper function to select dropdown item
export async function selectDropdownItem(page: puppeteer.Page): Promise<boolean> {
  // Approach 1: Try to find items with text containing Tokyo
  console.log("Approach 1: Looking for items containing Tokyo text...");
  const tokyoItems = await page.$$eval('li[role="option"]', (items: Element[]) => {
    return items
      .filter((item) => item.textContent?.includes("Tokyo"))
      .map((item) => ({
        text: item.textContent?.trim() ?? "",
        visible: !!((item as HTMLElement).offsetWidth || (item as HTMLElement).offsetHeight || item.getClientRects().length),
      }));
  });

  console.log(`Found ${tokyoItems.length} items containing Tokyo:`, tokyoItems);

  // Approach 2: Try a more specific selector
  console.log("Approach 2: Using more specific selector...");
  const specificItem = await page
    .waitForSelector('li[role="option"] div[role="presentation"]', {
      timeout: 3000,
    })
    .catch(() => null);

  if (specificItem) {
    console.log("Found item with specific selector, clicking it...");
    await specificItem.click();
    console.log("Clicked item with specific selector");
    return true;
  }

  // Approach 3: Use direct Puppeteer click on first option
  console.log("Approach 3: Using direct Puppeteer click on first option...");
  const firstOption = await page.$('li[role="option"]:first-child');

  if (firstOption) {
    try {
      console.log("Found first option, clicking it...");
      await firstOption.click();
      console.log("Clicked first option successfully");
      return true;
    } catch (error) {
      console.error("Error clicking first option:", error);

      // Try clicking with JavaScript
      console.log("Trying JavaScript click as fallback...");
      const clickResult = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('li[role="option"]'));
        if (options.length > 0) {
          try {
            // Dispatch a mouse event instead of using click()
            const event = new MouseEvent("click", {
              view: window,
              bubbles: true,
              cancelable: true,
            });
            (options[0] as HTMLElement).dispatchEvent(event);
            return { success: true, count: options.length, method: "dispatchEvent" };
          } catch (e) {
            return { success: false, count: options.length, error: String(e) };
          }
        }
        return { success: false, count: options.length };
      });

      console.log("JavaScript click result:", clickResult);

      if (!clickResult.success) {
        console.log("JavaScript click failed, trying to press Enter instead");
        await page.keyboard.press("Enter");
      }

      return clickResult.success;
    }
  }

  // Fallback to Enter key press
  console.log("Could not find first option, trying to press Enter instead");
  await page.keyboard.press("Enter");
  return false;
}
