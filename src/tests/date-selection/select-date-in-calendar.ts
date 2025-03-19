import * as puppeteer from 'puppeteer';

// Helper function to find and click a specific date in the calendar
export async function selectDateInCalendar(page: puppeteer.Page, day: number, month: string): Promise<boolean> {
  console.log(`Looking for ${month} ${day} in calendar...`);

  // First, find the month section
  const monthSections = await page.$$('div[role="rowgroup"]');

  for (const section of monthSections) {
    const monthName = await section.$eval('div:first-child', el => el.textContent?.trim() ?? '');

    if (monthName.includes(month)) {
      console.log(`Found ${month} section`);

      // Find the day button within this month section
      const dayButtons = await section.$$('div[role="button"]');

      for (const button of dayButtons) {
        const dayText = await button.$eval('div:first-child', el => el.textContent?.trim() ?? '');

        if (dayText === String(day)) {
          console.log(`Found day ${day}, clicking it...`);
          await button.click();
          return true;
        }
      }
    }
  }

  console.log(`Could not find ${month} ${day} in calendar`);
  return false;
}
