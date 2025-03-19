import * as puppeteer from 'puppeteer';
import { tryJavaScriptClick } from '../tryJavaScriptClick';

/**
 * Try JavaScript click approach when button element not found
 */

export async function tryJavaScriptClickApproach(page: puppeteer.Page): Promise<void> {
  console.log('Could not find search button with previous approaches, trying JavaScript click...');

  const searchTexts = ['search', 'Search', 'SEARCH', 'find', 'Find', 'FIND', 'go', 'Go', 'GO'];
  const isJsClickSuccessful = await tryJavaScriptClick(page, searchTexts);

  if (isJsClickSuccessful) {
    console.log('Successfully clicked search button via JavaScript');

    // Wait for possible navigation
    try {
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {
        console.log('No navigation occurred after JavaScript click');
      });
    } catch (navError) {
      console.log('Error waiting for navigation after JavaScript click:', navError instanceof Error ? navError.message : String(navError));
    }
  } else {
    // Last resort: press Enter key
    console.log('JavaScript click failed, trying to press Enter as last resort...');
    await page.keyboard.press('Enter');
    console.log('Pressed Enter key');

    // Wait for possible navigation
    try {
      await page.waitForNavigation({ timeout: 5000 }).catch(() => {
        console.log('No navigation occurred after pressing Enter');
      });
    } catch (navError) {
      console.log('Error waiting for navigation after pressing Enter:', navError instanceof Error ? navError.message : String(navError));
    }
  }
}
