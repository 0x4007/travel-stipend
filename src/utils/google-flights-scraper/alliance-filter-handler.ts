import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";


export async function applyAllianceFilters(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Attempting to apply alliance filters");

  try {
    // Step 1: Click the Airlines filter button
    const isAirlinesButtonFound = await clickAirlinesFilterButton(page);

    // If we couldn't find the Airlines button, skip alliance filtering
    if (!isAirlinesButtonFound) {
      log(LOG_LEVEL.WARN, "Airlines filter button not found, skipping alliance filtering");
      return false;
    }

    // Wait a moment for the filter panel to appear
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // Step 2: Wait for alliance options to appear
    const hasAllianceOptions = await waitForAllianceOptions(page);

    // If no alliance options were found, skip the rest of the steps
    if (!hasAllianceOptions) {
      log(LOG_LEVEL.WARN, "No alliance options found, skipping alliance filtering");
      return false;
    }

    // Step 3: Check all alliance checkboxes
    const checkboxesChecked = await checkAllAllianceCheckboxes(page);

    // If no checkboxes were checked, we might not need to wait for results to update
    if (checkboxesChecked > 0) {
      // Step 4: Wait for results to update
      await waitForResultsUpdate(page);
      log(LOG_LEVEL.INFO, "Successfully applied alliance filters");
    } else {
      log(LOG_LEVEL.INFO, "No alliance checkboxes needed to be checked (they might already be checked)");
    }

    return true;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error applying alliance filters:", error);
    // Continue despite error - we don't want to fail the entire search if filters can't be applied
    log(LOG_LEVEL.WARN, "Continuing search despite filter error");
    return false;
  }
}


async function clickAirlinesFilterButton(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Clicking Airlines filter button");

  // Try multiple selectors for the Airlines filter button
  const airlinesFilterSelectors = [
    // Based on the provided DOM snippet
    'div[jscontroller="aDULAf"][data-chiptype="1"][data-filtertype="6"] button',
    'button[aria-label="Airlines, Not selected"]',
    'button span.m1GHmf:contains("Airlines")',
    // More generic selectors
    'button:contains("Airlines")',
    '[role="button"]:contains("Airlines")',
    // Class-based selectors from the DOM snippet
    '.wpMGDb.Vz4hIc.cwYgqc button',
    '.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-INsAgc',
  ];

  let airlinesButton = null;

  // Try each selector
  for (const selector of airlinesFilterSelectors) {
    try {
      log(LOG_LEVEL.DEBUG, `Trying Airlines filter button selector: ${selector}`);

      // For :contains selectors, use page.evaluate
      if (selector.includes(":contains")) {
        const buttonText = selector.match(/:contains\("([^"]+)"\)/)
          ? selector.match(/:contains\("([^"]+)"\)/)?.[1] ?? "Airlines"
          : "Airlines";

        airlinesButton = await page.evaluateHandle((text) => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          return buttons.find((element) => element.textContent?.includes(text)) || null;
        }, buttonText);

        if (airlinesButton) {
          const isNull = await airlinesButton.evaluate((element) => element === null);
          if (!isNull) {
            log(LOG_LEVEL.INFO, `Found Airlines filter button with text: ${buttonText}`);
            break;
          }
        }
      } else {
        // For standard selectors, use page.$
        airlinesButton = await page.$(selector);
        if (airlinesButton) {
          log(LOG_LEVEL.INFO, `Found Airlines filter button with selector: ${selector}`);
          break;
        }
      }
    } catch (error) {
      log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error}`);
    }
  }

  // If button not found with specific selectors, try to find by text content
  if (!airlinesButton) {
    log(LOG_LEVEL.WARN, "Could not find Airlines filter button with specific selectors, trying to find by text content");

    try {
      // Find all buttons or elements with role="button"
      const buttons = await page.$$('button, [role="button"]');

      for (const button of buttons) {
        try {
          const textContent = await button.evaluate((element) => element.textContent?.toLowerCase() ?? "");
          const ariaLabel = await button.evaluate((element) => element.getAttribute("aria-label")?.toLowerCase() ?? "");

          if (textContent.includes("airline") || ariaLabel.includes("airline")) {
            airlinesButton = button;
            log(LOG_LEVEL.INFO, `Found Airlines filter button by text content: ${textContent}`);
            break;
          }
        } catch (error) {
          // Continue to next button if there's an error with this one
          log(LOG_LEVEL.DEBUG, `Error getting button text: ${error}`);
        }
      }
    } catch (error) {
      log(LOG_LEVEL.ERROR, `Error finding button by text content: ${error}`);
    }
  }

  // If a button was found, try to click it
  if (airlinesButton) {
    log(LOG_LEVEL.INFO, "Found Airlines filter button, attempting to click it");

    try {
      // Try standard click first
      await airlinesButton.click({ delay: 100 });
      log(LOG_LEVEL.INFO, "Clicked Airlines filter button with standard click");

      // Wait a moment for the filter panel to appear
      try {
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
      } catch (error) {
        log(LOG_LEVEL.DEBUG, "Error in waiting:", error);
      }

      return true;
    } catch (error) {
      log(LOG_LEVEL.WARN, `Standard click failed: ${error}`);

      try {
        // If standard click fails, try JavaScript click
        log(LOG_LEVEL.INFO, "Trying JavaScript click as fallback");
        await page.evaluate((element) => {
          if (element instanceof HTMLElement) {
            element.click();

            // Also dispatch events for good measure
            const clickEvent = new MouseEvent("click", {
              view: window,
              bubbles: true,
              cancelable: true,
            });
            element.dispatchEvent(clickEvent);
          }
        }, airlinesButton);

        log(LOG_LEVEL.INFO, "Clicked Airlines filter button with JavaScript");

        // Wait a moment for the filter panel to appear
        try {
          await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
        } catch (error) {
          log(LOG_LEVEL.DEBUG, "Error in waiting:", error);
        }

        return true;
      } catch (jsError) {
        log(LOG_LEVEL.ERROR, `JavaScript click failed: ${jsError}`);
        return false;
      }
    }
  } else {
    log(LOG_LEVEL.WARN, "Could not find Airlines filter button");
    return false;
  }
}


async function waitForAllianceOptions(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Waiting for alliance options to appear");

  try {
    // First, try to find the "Alliances" section header using JavaScript
    const hasFoundAlliances = await page.evaluate(() => {
      // Look for elements containing "Alliances" text
      const elements = Array.from(document.querySelectorAll('div, span, h3, h4, label'));
      const allianceHeader = elements.find(el =>
        el.textContent?.includes("Alliances") &&
        el.textContent?.trim() === "Alliances"
      );

      if (allianceHeader) {
        return true;
      }

      // Look for alliance names
      const allianceNames = ["Oneworld", "SkyTeam", "Star Alliance"];
      for (const name of allianceNames) {
        const isAllianceFound = elements.some(el => el.textContent?.includes(name));
        if (isAllianceFound) return true;
      }

      // Look for checkboxes
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      return checkboxes.length > 0;
    });

    if (hasFoundAlliances) {
      log(LOG_LEVEL.INFO, "Found alliance options using JavaScript");
      return true;
    }

    // If JavaScript approach didn't find anything, wait a bit longer
    log(LOG_LEVEL.WARN, "Could not find alliance options with JavaScript, waiting additional time");
    try {
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
    } catch (error) {
      log(LOG_LEVEL.DEBUG, "Error in waiting:", error);
    }

    // Check again for checkboxes as a last resort
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      log(LOG_LEVEL.INFO, `Found ${checkboxes.length} checkboxes, assuming alliance options are visible`);
      return true;
    }

    log(LOG_LEVEL.WARN, "Could not confirm alliance options are visible");
    return false;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error waiting for alliance options:", error);
    return false;
  }
}


async function checkAllAllianceCheckboxes(page: Page): Promise<number> {
  log(LOG_LEVEL.INFO, "Checking all alliance checkboxes");

  try {
    // Use JavaScript to find and check all checkboxes
    const checkboxCount = await page.evaluate(() => {
      // First try to find checkboxes related to alliances
      const allianceValues = ["Oneworld", "SkyTeam", "Star Alliance"];
      let count = 0;

      // Try to find by label text first
      const labels = Array.from(document.querySelectorAll('label'));
      for (const label of labels) {
        for (const alliance of allianceValues) {
          if (label.textContent?.includes(alliance)) {
            // Try to find checkbox by 'for' attribute
            const forId = label.getAttribute('for');
            if (forId) {
              const checkbox = document.getElementById(forId) as HTMLInputElement | null;
              if (checkbox && checkbox.type === 'checkbox') {
                if (!checkbox.checked) {
                  checkbox.click();
                  count++;
                }
                break;
              }
            }

            // Try to find checkbox inside the label
            const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
            if (checkbox) {
              if (!checkbox.checked) {
                checkbox.click();
                count++;
              }
              break;
            }
          }
        }
      }

      // If no alliance-specific checkboxes found, check all checkboxes
      if (count === 0) {
        const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        for (const checkbox of allCheckboxes) {
          if (!(checkbox as HTMLInputElement).checked) {
            (checkbox as HTMLInputElement).click();
            count++;
          }
        }
      }

      return count;
    });

    if (checkboxCount > 0) {
      log(LOG_LEVEL.INFO, `Checked ${checkboxCount} checkboxes with JavaScript approach`);

      // Wait a moment for the UI to update after checking checkboxes
      try {
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
      } catch (error) {
        log(LOG_LEVEL.DEBUG, "Error in waiting:", error);
      }
    } else {
      log(LOG_LEVEL.INFO, "No checkboxes were checked (they might already be checked)");
    }

    return checkboxCount;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error checking alliance checkboxes:", error);
    return 0;
  }
}


async function waitForResultsUpdate(page: Page): Promise<void> {
  log(LOG_LEVEL.INFO, "Waiting for results to update after applying filters");

  try {
    // Simple approach: just wait a fixed amount of time
    try {
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000))); // Wait 5 seconds for results to update
    } catch (error) {
      log(LOG_LEVEL.DEBUG, "Error in waiting:", error);
    }

    log(LOG_LEVEL.INFO, "Waited for results to update");
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error waiting for results update:", error);
    // Continue despite error - we don't want to fail the entire search if we can't detect updates
    log(LOG_LEVEL.WARN, "Continuing search despite error waiting for results update");
  }
}
