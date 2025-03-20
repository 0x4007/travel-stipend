import * as puppeteer from "puppeteer";
import { ClickableElementInfo } from "./clickable-element-info";



export async function logClickableElements(page: puppeteer.Page): Promise<ClickableElementInfo[]> {
  console.log("Logging all buttons and clickable elements on the page...");
  const allElements = await page.$$eval('button, [role="button"], a, [tabindex="0"]', (elements: Element[]) => {
    return elements.map((element: Element) => {
      const rect = element.getBoundingClientRect();
      const htmlElement = element as HTMLElement;
      return {
        tag: element.tagName,
        text: element.textContent?.trim() ?? "",
        ariaLabel: element.getAttribute("aria-label") ?? "",
        classes: element.className,
        id: element.id ?? "",
        role: element.getAttribute("role") ?? "",
        jsname: element.getAttribute("jsname") ?? "",
        jscontroller: element.getAttribute("jscontroller") ?? "",
        jsaction: element.getAttribute("jsaction") ?? "",
        isVisible: !!(htmlElement.offsetWidth || htmlElement.offsetHeight || element.getClientRects().length),
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      };
    });
  });

  console.log(`Found ${allElements.length} potential clickable elements:`, allElements);
  return allElements;
}
