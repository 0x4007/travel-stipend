#!/usr/bin/env bun
import { Conference, LogCallback, MealCosts, StipendBreakdown } from "./types"; // Import LogCallback
import { createHashKey, PersistentCache } from "./utils/cache";
import { TRAVEL_STIPEND } from "./utils/constants";
import { getCostOfLivingFactor } from "./utils/cost-of-living";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { scrapeFlightPrice } from "./utils/flights"; // Assuming scrapeFlightPrice accepts logCallback now
import { calculateLocalTransportCost } from "./utils/taxi-fares";

// Setup debug logging based on CLI verbose flag
const isVerbose = process.argv.includes("--verbose") || process.argv.includes("-v");
const log = {
  debug: (message: string) => isVerbose && console.log(`[DEBUG] ${message}`),
  info: (message: string) => console.log(message),
};

// Initialize cache
const stipendCache = new PersistentCache<StipendBreakdown>("fixtures/cache/stipend-cache.json");

// Helper function to calculate flight cost
async function calculateFlightCostForConference(
  origin: string,
  destination: string,
  flightDates: { outbound: string; return: string },
  isOriginCity: boolean,
  includeBudget: boolean = false,
  logCallback?: LogCallback // Added callback
): Promise<{ cost: number; source: string }> {
  logCallback?.(`Checking flight cost: ${origin} -> ${destination}`);
  if (isOriginCity) {
    const msg = `No flight cost for ${destination} (same as origin)`;
    log.info(msg);
    logCallback?.(msg);
    return { cost: 0, source: "No flight needed" };
  }

  log.debug(`Searching flights from ${origin} to ${destination}`);
  log.debug(`Dates: ${flightDates.outbound} to ${flightDates.return}`);
  logCallback?.(`Searching flights: ${origin} -> ${destination} (${flightDates.outbound} to ${flightDates.return})`);

  try {
    logCallback?.(`Calling flight scraper...`);
    // Call original scrapeFlightPrice (without logCallback)
    const scrapedResult = await scrapeFlightPrice(origin, destination, flightDates, includeBudget);
    // Log completion from adapter (scrapeFlightPrice doesn't accept callback)
    logCallback?.(`Flight scraper finished. Source: ${scrapedResult.source}`);

    if (scrapedResult.price === null) {
      const msg = `Scraping returned null price for ${destination}. Setting cost to 0.`;
      log.info(msg);
      logCallback?.(msg);
      return { cost: 0, source: "Scraping returned null" };
    }

    const msg = `Flight cost for ${destination}: ${scrapedResult.price} (from ${scrapedResult.source})`;
    log.info(msg);
    logCallback?.(msg);
    log.debug(`Flight details: ${JSON.stringify(scrapedResult, null, 2)}`);
    return { cost: scrapedResult.price, source: scrapedResult.source };
  } catch (error) {
    console.error(`Error scraping flight price for ${destination}:`, error);
    const msg = `Setting flight cost to 0 due to scraping error for ${destination}.`;
    log.info(msg);
    logCallback?.(`ERROR scraping flights: ${error instanceof Error ? error.message : 'Unknown scraping error'}`);
    return { cost: 0, source: "Scraping failed" };
  }
}

async function calculateFlightDetails(
  origin: string,
  destination: string,
  isOriginCity: boolean,
  record: Conference & { includeBudget?: boolean },
  logCallback?: LogCallback // Pass callback down
): Promise<{
  flightCost: number;
  flightPriceSource: string;
  flightDates: { outbound: string; return: string };
}> {
  logCallback?.("Generating flight dates...");
  const flightDates = generateFlightDates(record, isOriginCity);
  logCallback?.(`Generated dates: Depart ${flightDates.outbound}, Return ${flightDates.return}`);

  // Pass callback down
  const flightResult = await calculateFlightCostForConference(origin, destination, flightDates, isOriginCity, record.includeBudget, logCallback);

  return {
    flightCost: flightResult.cost,
    flightPriceSource: flightResult.source,
    flightDates,
  };
}

function calculateNights(startDate: string, totalDays: number, preConferenceDays: number): { weekdayNights: number; weekendNights: number } {
  const currentYear = new Date().getFullYear();
  const start = new Date(startDate);
  start.setFullYear(currentYear);
  let weekendNights = 0;
  const numberOfNights = totalDays - 1;

  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() - preConferenceDays + i);
    if ([0, 6].includes(currentDate.getDay())) {
      weekendNights++;
    }
  }

  return {
    weekdayNights: numberOfNights - weekendNights,
    weekendNights,
  };
}

function calculateMealsCosts(totalDays: number, conferenceDays: number, colFactor: number, logCallback?: LogCallback): MealCosts {
  logCallback?.(`Calculating meal costs for ${totalDays} days...`);
  let basicMealsCost = 0;
  for (let i = 0; i < totalDays; i++) {
    const dailyMealCost = i < 3 ? TRAVEL_STIPEND.costs.meals * colFactor : TRAVEL_STIPEND.costs.meals * colFactor * 0.85;
    basicMealsCost += dailyMealCost;
  }

  const businessEntertainmentCost = TRAVEL_STIPEND.costs.businessEntertainment * conferenceDays;
  logCallback?.(`Basic Meals: ${basicMealsCost.toFixed(2)}, Business Entertainment: ${businessEntertainmentCost.toFixed(2)}`);
  return {
    basicMealsCost,
    businessEntertainmentCost,
  };
}

// Re-add optional log callback parameter and calls
export async function calculateStipend(
    record: Conference & { origin?: string },
    logCallback?: LogCallback // Added optional callback
): Promise<StipendBreakdown> {
  logCallback?.("Starting stipend calculation...");

  if (!record.origin) {
    logCallback?.("ERROR: Origin city is required.");
    throw new Error("Origin city is required for travel stipend calculation");
  }
  const origin = record.origin;
  const cacheKey = createHashKey([
    record.conference, record.location, record.start_date, record.end_date, origin,
    TRAVEL_STIPEND.costs.hotel, TRAVEL_STIPEND.costs.meals, record.ticket_price ?? TRAVEL_STIPEND.costs.ticket,
    "v11", // Cache version
  ]);

  const destination = record.location;
  log.debug(`Calculating stipend for ${record.conference}`);
  log.debug(`Cache key: ${cacheKey}`);
  log.info(`Processing conference: ${record.conference}`);
  logCallback?.(`Processing: ${record.conference} (${origin} -> ${destination})`);

  const cachedResult = stipendCache.get(cacheKey);
  if (cachedResult) {
      log.info("Returning cached result.");
      logCallback?.("Found cached result.");
      return cachedResult;
  }
  logCallback?.("No cached result found, proceeding with calculation.");

  const isOriginCity = origin === destination;
  logCallback?.(isOriginCity ? "Destination is the same as origin." : "Destination differs from origin.");

  logCallback?.("Calculating flight details...");
  // Pass callback down
  const { flightCost, flightPriceSource, flightDates } = await calculateFlightDetails(origin, destination, isOriginCity, record, logCallback);

  logCallback?.(`Fetching cost of living factor for ${destination}...`);
  const colFactor = await getCostOfLivingFactor(destination);
  logCallback?.(`Cost of living factor: ${colFactor}`);

  logCallback?.("Calculating travel duration...");
  const conferenceDays = calculateDateDiff(record.start_date, record.end_date) + 1;
  const preConferenceDays = isOriginCity ? 0 : (record.buffer_days_before ?? TRAVEL_STIPEND.conference.preDays);
  const postConferenceDays = isOriginCity ? 0 : (record.buffer_days_after ?? TRAVEL_STIPEND.conference.postDays);
  const totalDays = conferenceDays + preConferenceDays + postConferenceDays;
  const numberOfNights = totalDays - 1;
  const durationMsg = `Conference: ${conferenceDays} days, Total Stay: ${totalDays} days (${numberOfNights} nights)`;
  log.info(durationMsg); logCallback?.(durationMsg);
  const travelDatesMsg = `Travel dates: ${flightDates.outbound} to ${flightDates.return}`;
  log.info(travelDatesMsg); logCallback?.(travelDatesMsg);
  log.debug(`Cost of living factor for ${destination}: ${colFactor}`);

  logCallback?.("Calculating lodging nights breakdown...");
  const { weekdayNights, weekendNights } = calculateNights(record.start_date, totalDays, preConferenceDays);
  logCallback?.(`Lodging: ${weekdayNights} weekday nights, ${weekendNights} weekend nights.`);

  const baseWeekdayRate = TRAVEL_STIPEND.costs.hotel * colFactor;
  const baseWeekendRate = baseWeekdayRate * TRAVEL_STIPEND.rules.weekendRateMultiplier;
  log.debug(`Base rates: Weekday=${baseWeekdayRate}, Weekend=${baseWeekendRate}`);

  logCallback?.("Calculating lodging cost...");
  const lodgingCost = isOriginCity ? 0 : weekdayNights * baseWeekdayRate + weekendNights * baseWeekendRate;
  logCallback?.(`Lodging cost: ${lodgingCost.toFixed(2)}`);

  logCallback?.("Calculating meals cost...");
  // Pass callback down
  const { basicMealsCost, businessEntertainmentCost } = calculateMealsCosts(totalDays, conferenceDays, colFactor, logCallback);

  logCallback?.("Calculating local transport cost...");
  const localTransportCost = await calculateLocalTransportCost(destination, totalDays, colFactor, TRAVEL_STIPEND.costs.transport);
  logCallback?.(`Local transport cost: ${localTransportCost.toFixed(2)}`);

  const ticketPrice = record.ticket_price ? parseFloat(record.ticket_price.replace("$", "")) : TRAVEL_STIPEND.costs.ticket;
  logCallback?.(`Ticket price: ${ticketPrice.toFixed(2)}`);

  logCallback?.("Calculating allowances...");
  const isInternational = !isOriginCity;
  const internetDataAllowance = isInternational ? TRAVEL_STIPEND.rules.internationalInternet * totalDays : 0;
  const incidentalsAllowance = totalDays * TRAVEL_STIPEND.costs.incidentals;
  logCallback?.(`Allowances: Internet=${internetDataAllowance.toFixed(2)}, Incidentals=${incidentalsAllowance.toFixed(2)}`);

  logCallback?.("Calculating total stipend...");
  const totalStipend = (flightCost || 0) + (lodgingCost || 0) + (basicMealsCost || 0) + (businessEntertainmentCost || 0) +
                       (localTransportCost || 0) + (ticketPrice || 0) + (internetDataAllowance || 0) + (incidentalsAllowance || 0);
  logCallback?.(`Total Stipend Calculated: ${totalStipend.toFixed(2)}`);

  function formatDate(dateStr: string) { /* ... (formatDate remains the same) ... */
    const currentYear = new Date().getFullYear();
    const date = new Date(dateStr);
    date.setFullYear(currentYear);
    return date.getDate() + " " + date.toLocaleString("en-US", { month: "long" });
  }

  const result: StipendBreakdown = {
    conference: record.conference, origin: origin, destination: destination,
    conference_start: record.start_date, conference_end: record.end_date ?? record.start_date,
    flight_departure: formatDate(flightDates.outbound), flight_return: formatDate(flightDates.return),
    flight_cost: parseFloat(flightCost.toFixed(2)), flight_price_source: flightPriceSource,
    lodging_cost: parseFloat(lodgingCost.toFixed(2)),
    meals_cost: parseFloat((basicMealsCost + businessEntertainmentCost).toFixed(2)),
    basic_meals_cost: parseFloat(basicMealsCost.toFixed(2)),
    business_entertainment_cost: parseFloat(businessEntertainmentCost.toFixed(2)),
    local_transport_cost: parseFloat(localTransportCost.toFixed(2)),
    ticket_price: ticketPrice,
    internet_data_allowance: parseFloat(internetDataAllowance.toFixed(2)),
    incidentals_allowance: parseFloat(incidentalsAllowance.toFixed(2)),
    total_stipend: parseFloat(totalStipend.toFixed(2)),
  };

  log.debug("Final stipend breakdown:"); log.debug(JSON.stringify(result, null, 2));

  logCallback?.("Saving result to cache...");
  stipendCache.set(cacheKey, result);
  logCallback?.("Calculation complete."); // Final log sent before returning
  return result;
}
