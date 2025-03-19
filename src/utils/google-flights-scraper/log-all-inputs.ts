import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

export async function logAllInputs(page: Page): Promise<void> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot log inputs: page is null");
    return;
  }

  try {
    log(LOG_LEVEL.DEBUG, "Logging all input elements on the page");

    const inputElements = await page.evaluate(() => {
      // Find all input elements
      const elements = Array.from(document.querySelectorAll(
        'input, textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"]'
      ));

      // Extract information about each element
      return elements.map(el => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";

        return {
          tag: el.tagName.toLowerCase(),
          id: el.id ?? "",
          name: (el as HTMLInputElement).name ?? "",
          type: (el as HTMLInputElement).type ?? "",
          placeholder: (el as HTMLInputElement).placeholder ?? "",
          value: (el as HTMLInputElement).value ?? "",
          classes: (el as HTMLElement).className ?? "",
          isVisible,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(", "),
          position: `x: ${Math.round(rect.left)}, y: ${Math.round(rect.top)}, width: ${Math.round(rect.width)}, height: ${Math.round(rect.height)}`
        };
      });
    });

    // Log each input element
    log(LOG_LEVEL.DEBUG, `Found ${inputElements.length} input elements`);
    inputElements.forEach((el, index) => {
      if (el.isVisible) {
        log(LOG_LEVEL.DEBUG, `Input element ${index + 1}:`, {
          tag: el.tag,
          id: el.id,
          name: el.name,
          type: el.type,
          placeholder: el.placeholder,
          classes: el.classes,
          attributes: el.attributes,
          position: el.position
        });
      }
    });
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error logging input elements:", error);
  }
}
