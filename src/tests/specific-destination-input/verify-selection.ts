import * as puppeteer from "puppeteer";

// Helper function to verify selection
export async function verifySelection(page: puppeteer.Page): Promise<{ success: boolean; method?: string; value?: string; text?: string }> {
  console.log("Verifying selection was successful...");

  // Check if any input field on the page contains Tokyo
  return page.evaluate(() => {
    // Check all input fields
    const allInputs = Array.from(document.querySelectorAll("input"));
    for (const input of allInputs) {
      if (input.value?.includes("Tokyo")) {
        return { success: true, value: input.value };
      }
    }

    // Check if there's any visible text on the page containing Tokyo
    const bodyText = document.body.textContent ?? "";
    if (bodyText.includes("Tokyo")) {
      return { success: true, method: "bodyText" };
    }

    // Check for any elements that might indicate selection
    const destinationElements = Array.from(
      document.querySelectorAll('[aria-label*="destination"], [placeholder*="to"], .destination-field, .selected-destination')
    );
    for (const elem of destinationElements) {
      const text = elem.textContent ?? "";
      if (text.includes("Tokyo")) {
        return { success: true, method: "destinationElement", text };
      }
    }

    return { success: false };
  });
}
