import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

export async function logAllClickableElements(page: Page): Promise<void> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot log clickable elements: page is null");
    return;
  }

  try {
    log(LOG_LEVEL.DEBUG, "Logging all clickable elements on the page");

    const clickableElements = await page.evaluate(() => {
      // Find all potentially clickable elements
      const elements = Array.from(
        document.querySelectorAll('button, a, [role="button"], [role="link"], [onclick], input[type="submit"], input[type="button"]')
      );

      // Extract information about each element
      return elements.map((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";

        return {
          tag: el.tagName.toLowerCase(),
          id: el.id ?? "",
          classes: (el as HTMLElement).className ?? "",
          text: el.textContent?.trim() ?? "",
          isVisible,
          attributes: Array.from(el.attributes)
            .map((attr) => `${attr.name}="${attr.value}"`)
            .join(", "),
          position: `x: ${Math.round(rect.left)}, y: ${Math.round(rect.top)}, width: ${Math.round(rect.width)}, height: ${Math.round(rect.height)}`,
        };
      });
    });

    // Log each clickable element
    log(LOG_LEVEL.DEBUG, `Found ${clickableElements.length} potentially clickable elements`);
    clickableElements.forEach((el, index) => {
      if (el.isVisible) {
        log(LOG_LEVEL.DEBUG, `Clickable element ${index + 1}:`, {
          tag: el.tag,
          id: el.id,
          classes: el.classes,
          text: el.text,
          attributes: el.attributes,
          position: el.position,
        });
      }
    });
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error logging clickable elements:", error as Error);
  }
}
