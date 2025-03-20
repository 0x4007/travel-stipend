import * as puppeteer from "puppeteer";

export async function initializeBrowser(): Promise<puppeteer.Browser> {
  console.log("Starting Google Flights date selection test...");

  // Launch browser in headful mode
  return puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1366,768"],
  });
}
