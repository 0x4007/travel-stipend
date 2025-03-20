import * as puppeteer from "puppeteer";

export async function navigateToGoogleFlights(page: puppeteer.Page): Promise<void> {
  // Set user agent
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

  // Navigate to Google Flights
  console.log("Navigating to Google Flights...");
  await page.goto("https://www.google.com/travel/flights", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  console.log("Google Flights loaded");

  // Wait for the page to be fully loaded
  await page.waitForSelector("body", { timeout: 10000 });
}
