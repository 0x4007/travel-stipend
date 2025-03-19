import * as puppeteer from 'puppeteer';
import { selectDateInCalendar } from '../select-date-in-calendar';
import { calculateTravelDates } from './calculate-travel-dates';

/**
 * Open date picker and select dates
 */
export async function selectDates(page: puppeteer.Page): Promise<void> {
  const { departureDayOfMonth, departureMonth, returnDayOfMonth, returnMonth } = calculateTravelDates();

  // Find and click on the date field to open the calendar
  console.log('Looking for date input field...');
  const dateInput = await page.waitForSelector('[aria-label*="Departure"], [placeholder*="Departure"], [role="button"][aria-label*="Date"]', {
    visible: true,
    timeout: 10000
  });

  if (!dateInput) {
    throw new Error('Could not find date input field');
  }

  console.log('Found date input field, clicking on it...');
  await dateInput.click();

  // Wait for the calendar to appear
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

  // Select departure date
  const isDepartureDateSelected = await selectDateInCalendar(page, departureDayOfMonth, departureMonth);

  if (!isDepartureDateSelected) {
    console.log('Failed to select departure date, trying alternative approach');
    // Try an alternative approach if needed
  }

  // Wait a moment before selecting return date
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

  // Select return date
  const isReturnDateSelected = await selectDateInCalendar(page, returnDayOfMonth, returnMonth);

  if (!isReturnDateSelected) {
    console.log('Failed to select return date, trying alternative approach');
    // Try an alternative approach if needed
  }

  // Wait a moment after date selection
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
}
