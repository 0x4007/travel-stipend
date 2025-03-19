import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

/**
 * Opens the date picker and selects the departure and return dates
 */
export async function selectDates(page: Page, departureDate: string, returnDate?: string): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "STEP 3: Selecting dates in calendar");

  // Parse the dates
  const departureDateObj = new Date(departureDate);
  const departureDayOfMonth = departureDateObj.getDate();
  const departureMonth = departureDateObj.toLocaleString("en-US", { month: "long" });
  const departureYear = departureDateObj.getFullYear();

  log(LOG_LEVEL.INFO, `Selecting departure date: ${departureMonth} ${departureDayOfMonth}, ${departureYear}`);

  let returnDayOfMonth: number | undefined;
  let returnMonth: string | undefined;
  let returnYear: number | undefined;

  if (returnDate) {
    const returnDateObj = new Date(returnDate);
    returnDayOfMonth = returnDateObj.getDate();
    returnMonth = returnDateObj.toLocaleString("en-US", { month: "long" });
    returnYear = returnDateObj.getFullYear();
    log(LOG_LEVEL.INFO, `Selecting return date: ${returnMonth} ${returnDayOfMonth}, ${returnYear}`);
  }

  // Take a screenshot before opening date picker

  // Find and click on the date field to open the calendar
  log(LOG_LEVEL.INFO, "Looking for date input field...");

  const dateSelectors = [
    '[aria-label*="Departure"]',
    '[placeholder*="Departure"]',
    '[role="button"][aria-label*="Date"]',
    // Add more selectors based on the current Google Flights UI
    'div[jsname="d3NNxc"]',
    'div[jsname="haAclf"]',
    'div[jscontroller="Pgogge"]',
    'div[role="button"][jsname="gYlYcf"]',
  ];

  let dateInput: ElementHandle<Element> | null = null;

  for (const selector of dateSelectors) {
    try {
      log(LOG_LEVEL.DEBUG, `Trying date selector: ${selector}`);
      const element = await page.$(selector);
      if (element) {
        dateInput = element;
        log(LOG_LEVEL.INFO, `Found date input with selector: ${selector}`);
        break;
      }
    } catch (error) {
      log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error}`);
    }
  }

  if (!dateInput) {
    log(LOG_LEVEL.WARN, "Could not find date input with specific selectors, trying to find any clickable element that might be the date field");

    // Try to find any element that might be the date field
    const possibleDateElements = await page.$$('[role="button"], [jsname], [jscontroller]');

    if (possibleDateElements.length > 0) {
      // Use the third element (after origin and destination) as a guess for the date field
      if (possibleDateElements.length >= 3) {
        dateInput = possibleDateElements[2];
        log(LOG_LEVEL.INFO, "Using third clickable element as date field");
      } else {
        dateInput = possibleDateElements[0];
        log(LOG_LEVEL.INFO, "Using first clickable element as date field");
      }
    }
  }

  if (!dateInput) {
    log(LOG_LEVEL.ERROR, "Could not find date input field");
    throw new Error("Could not find date input field");
  }

  // Click on the date field to open the calendar
  log(LOG_LEVEL.INFO, "Clicking on date input field");
  await dateInput.click();

  // Wait for the calendar to appear
  log(LOG_LEVEL.INFO, "Waiting for calendar to appear");
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Select departure date
  const isDepartureDateSelected = await selectDateInCalendar(page, departureDayOfMonth, departureMonth);

  if (!isDepartureDateSelected) {
    log(LOG_LEVEL.WARN, "Failed to select departure date with primary method, trying alternative approach");
    // Try an alternative approach - navigate to the correct month first
    await navigateToMonth(page, departureMonth, departureYear);
    await selectDateInCalendar(page, departureDayOfMonth, departureMonth);
  }

  // If we have a return date, select it
  if (returnDate && returnDayOfMonth && returnMonth) {
    // Wait a moment before selecting return date
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    const isReturnDateSelected = await selectDateInCalendar(page, returnDayOfMonth, returnMonth);

    if (!isReturnDateSelected) {
      log(LOG_LEVEL.WARN, "Failed to select return date with primary method, trying alternative approach");
      // Try an alternative approach - navigate to the correct month first
      if (returnYear) {
        await navigateToMonth(page, returnMonth, returnYear);
      }
      await selectDateInCalendar(page, returnDayOfMonth, returnMonth);
    }
  }

  // Click the Done button to confirm date selection
  await clickDoneButton(page);
}

/**
 * Helper function to find and click a specific date in the calendar
 */
async function selectDateInCalendar(page: Page, day: number, month: string): Promise<boolean> {
  log(LOG_LEVEL.INFO, `Looking for ${month} ${day} in calendar...`);

  try {
    // First, find the month section
    const monthSections = await page.$$('div[role="rowgroup"]');
    log(LOG_LEVEL.DEBUG, `Found ${monthSections.length} month sections`);

    for (const section of monthSections) {
      try {
        const monthName = await section.$eval("div:first-child", (el) => el.textContent?.trim() ?? "");
        log(LOG_LEVEL.DEBUG, `Found month section: ${monthName}`);

        if (monthName.includes(month)) {
          log(LOG_LEVEL.INFO, `Found ${month} section`);

          // Find the day button within this month section
          const dayButtons = await section.$$('div[role="button"]');
          log(LOG_LEVEL.DEBUG, `Found ${dayButtons.length} day buttons in ${month}`);

          for (const button of dayButtons) {
            try {
              const dayText = await button.$eval("div:first-child", (el) => el.textContent?.trim() ?? "");

              if (dayText === String(day)) {
                log(LOG_LEVEL.INFO, `Found day ${day}, clicking it...`);
                await button.click();
                return true;
              }
            } catch (error) {
              // Continue to next button if there's an error with this one
              log(LOG_LEVEL.DEBUG, `Error getting day text: ${error}`);
            }
          }
        }
      } catch (error) {
        // Continue to next section if there's an error with this one
        log(LOG_LEVEL.DEBUG, `Error processing month section: ${error}`);
      }
    }

    log(LOG_LEVEL.WARN, `Could not find ${month} ${day} in calendar`);
    return false;
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Error in selectDateInCalendar: ${error}`);
    return false;
  }
}

/**
 * Navigate to a specific month in the calendar
 */
async function navigateToMonth(page: Page, targetMonth: string, targetYear: number): Promise<void> {
  log(LOG_LEVEL.INFO, `Navigating to ${targetMonth} ${targetYear} in calendar`);

  try {
    // Find the current month and year displayed
    const monthYearText = await page.$eval('div[role="heading"]', (el) => el.textContent?.trim() ?? "");
    log(LOG_LEVEL.DEBUG, `Current month/year in calendar: ${monthYearText}`);

    // Extract current month and year
    const monthYearMatch = monthYearText.match(/([A-Za-z]+)\s+(\d{4})/);
    if (!monthYearMatch) {
      log(LOG_LEVEL.WARN, `Could not parse month/year from: ${monthYearText}`);
      return;
    }

    const currentMonth = monthYearMatch[1];
    const currentYear = parseInt(monthYearMatch[2], 10);

    // Determine if we need to go forward or backward
    const currentDate = new Date(`${currentMonth} 1, ${currentYear}`);
    const targetDate = new Date(`${targetMonth} 1, ${targetYear}`);

    // Find the navigation buttons
    const prevButton = await page.$('div[aria-label="Previous month"]');
    const nextButton = await page.$('div[aria-label="Next month"]');

    if (!prevButton || !nextButton) {
      log(LOG_LEVEL.WARN, "Could not find month navigation buttons");
      return;
    }

    // Navigate to the target month
    if (targetDate > currentDate) {
      // Need to go forward
      log(LOG_LEVEL.INFO, `Navigating forward from ${currentMonth} ${currentYear} to ${targetMonth} ${targetYear}`);

      let attempts = 0;
      const maxAttempts = 24; // Maximum 2 years forward

      while (attempts < maxAttempts) {
        const monthYearText = await page.$eval('div[role="heading"]', (el) => el.textContent?.trim() ?? "");
        if (monthYearText.includes(targetMonth) && monthYearText.includes(String(targetYear))) {
          log(LOG_LEVEL.INFO, `Reached target month: ${monthYearText}`);
          break;
        }

        log(LOG_LEVEL.DEBUG, `Clicking next month button, current: ${monthYearText}`);
        await nextButton.click();
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
        attempts++;
      }
    } else if (targetDate < currentDate) {
      // Need to go backward
      log(LOG_LEVEL.INFO, `Navigating backward from ${currentMonth} ${currentYear} to ${targetMonth} ${targetYear}`);

      let attempts = 0;
      const maxAttempts = 24; // Maximum 2 years backward

      while (attempts < maxAttempts) {
        const monthYearText = await page.$eval('div[role="heading"]', (el) => el.textContent?.trim() ?? "");
        if (monthYearText.includes(targetMonth) && monthYearText.includes(String(targetYear))) {
          log(LOG_LEVEL.INFO, `Reached target month: ${monthYearText}`);
          break;
        }

        log(LOG_LEVEL.DEBUG, `Clicking previous month button, current: ${monthYearText}`);
        await prevButton.click();
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
        attempts++;
      }
    } else {
      log(LOG_LEVEL.INFO, `Already at target month: ${targetMonth} ${targetYear}`);
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Error in navigateToMonth: ${error}`);
  }
}

/**
 * Click the Done button in the date picker
 */
async function clickDoneButton(page: Page): Promise<void> {
  log(LOG_LEVEL.INFO, "Looking for Done button...");

  const doneButtonSelectors = [
    'button[jsname="McfNlf"]',
    'button[aria-label*="Done"]',
    'button:has-text("Done")',
    "button.done-button",
    ".gws-flights__calendar-done-button",
    'button[aria-label*="Search for"]',
    "button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ.VfPpkd-LgbsSe-OWXEXe-dgl2Hf.nCP5yc.AjY5Oe.DuMIQc.LQeN7",
  ];

  // Try to find the Done button
  let doneButton: ElementHandle<Element> | null = null;
  let usedSelector = "";

  for (const selector of doneButtonSelectors) {
    try {
      log(LOG_LEVEL.DEBUG, `Trying Done button selector: ${selector}`);
      const button = await page.$(selector);
      if (button) {
        doneButton = button;
        usedSelector = selector;
        log(LOG_LEVEL.INFO, `Found Done button with selector: ${selector}`);
        break;
      }
    } catch (error) {
      log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error}`);
    }
  }

  log(LOG_LEVEL.INFO, `Clicking Done button with selector: ${usedSelector}`);

  // try {
  // Approach 2: Click with JavaScript
  await page.evaluate((el) => {
    if (el instanceof HTMLElement) {
      el.click();
    }
  }, doneButton);
  log(LOG_LEVEL.INFO, "Clicked Done button with JavaScript");

  // Wait a moment after clicking Done button
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
  // } catch (clickError) {
  // log(LOG_LEVEL.ERROR, `All click attempts failed: ${clickError}`);
  // log(LOG_LEVEL.WARN, "Continuing without clicking Done button...");
  // }

  // Alternative approach: Press Enter key
  log(LOG_LEVEL.INFO, "Pressing Enter key as alternative to clicking Done");
  await page.keyboard.press("Enter");
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
}
