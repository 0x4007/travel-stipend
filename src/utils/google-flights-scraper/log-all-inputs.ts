import { Page } from "puppeteer";
import { LOG_LEVEL } from "./google-flights-scraper";
import { log } from "./log";

// Helper function to log all form inputs on the page
export async function logAllInputs(page: Page): Promise<void> {
  log(LOG_LEVEL.DEBUG, "Logging all input elements on the page");

  const inputs = await page.evaluate(() => {
    const inputElements = Array.from(document.querySelectorAll("input, textarea, select, button"));
    return inputElements.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        type: (el as HTMLInputElement).type ?? "N/A",
        id: el.id ?? "N/A",
        name: (el as HTMLInputElement).name ?? "N/A",
        placeholder: (el as HTMLInputElement).placeholder ?? "N/A",
        value: (el as HTMLInputElement).value ?? "N/A",
        className: el.className ?? "N/A",
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

  log(LOG_LEVEL.DEBUG, "All input elements:", inputs);
}
