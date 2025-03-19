import { Page } from "puppeteer";
import { LOG_LEVEL } from "./google-flights-scraper";
import { log } from "./log";

// Helper function to log all clickable elements
export async function logAllClickableElements(page: Page): Promise<void> {
  log(LOG_LEVEL.DEBUG, "Logging all clickable elements on the page");

  const clickables = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('a, button, [role="button"], [tabindex]:not([tabindex="-1"])'));
    return elements.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: el.textContent?.trim() ?? "N/A",
        id: el.id ?? "N/A",
        className: el.className ?? "N/A",
        role: el.getAttribute("role") ?? "N/A",
        isVisible: rect.width > 0 && rect.height > 0,
        position: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        attributes: Array.from(el.attributes).map((attr) => ({ name: attr.name, value: attr.value })),
      };
    });
  });

  log(LOG_LEVEL.DEBUG, "All clickable elements:", clickables);
}
