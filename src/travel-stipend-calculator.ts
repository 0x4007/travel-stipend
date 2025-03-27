#!/usr/bin/env bun
import { Conference, MealCosts, StipendBreakdown } from "./types";
import { createHashKey, PersistentCache } from "./utils/cache";
import { TRAVEL_STIPEND } from "./utils/constants";
import { getCostOfLivingFactor } from "./utils/cost-of-living";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { scrapeFlightPrice } from "./utils/flights";
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
  includeBudget: boolean = false
): Promise<{ cost: number; source: string }> {
  if (isOriginCity) {
    log.info(`No flight cost for ${destination} (same as origin)`);
    return { cost: 0, source: "No flight needed" };
  }

  log.debug(`Searching flights from ${origin} to ${destination}`);
  log.debug(`Dates: ${flightDates.outbound} to ${flightDates.return}`);
  try {
    const scrapedResult = await scrapeFlightPrice(origin, destination, flightDates, includeBudget);

    // Flight data is now logged directly from the flights.ts file

    // Defensive check in case scrapeFlightPrice resolves with null instead of rejecting
    if (scrapedResult.price === null) {
      log.info(`Scraping returned null price for ${destination}. Setting cost to 0.`);
      return { cost: 0, source: "Scraping returned null" };
    }

    log.info(`Flight cost for ${destination}: ${scrapedResult.price} (from ${scrapedResult.source})`);
    log.debug(`Flight details: ${JSON.stringify(scrapedResult, null, 2)}`);
    return { cost: scrapedResult.price, source: scrapedResult.source };
  } catch (error) {
    console.error(`Error scraping flight price for ${destination}:`, error);
    log.info(`Setting flight cost to 0 due to scraping error for ${destination}.`);
    return { cost: 0, source: "Scraping failed" };
  }
}

async function calculateFlightDetails(
  origin: string,
  destination: string,
  isOriginCity: boolean,
  record: Conference & { includeBudget?: boolean }
): Promise<{
  flightCost: number;
  flightPriceSource: string;
  flightDates: { outbound: string; return: string };
}> {
  const flightDates = generateFlightDates(record, isOriginCity);
  const flightResult = await calculateFlightCostForConference(origin, destination, flightDates, isOriginCity, record.includeBudget);

  return {
    flightCost: flightResult.cost,
    flightPriceSource: flightResult.source,
    flightDates,
  };
}

function calculateNights(startDate: string, totalDays: number, preConferenceDays: number): { weekdayNights: number; weekendNights: number } {
  const currentYear = new Date().getFullYear();
  // Parse the start date using our custom parseDate function from dates.ts
  const start = new Date(startDate);
  // Ensure we're using the current or next year
  start.setFullYear(currentYear);
  let weekendNights = 0;
  const numberOfNights = totalDays - 1; // One less night than days

  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() - preConferenceDays + i);
    if ([0, 6].includes(currentDate.getDay())) {
      // 0 = Sunday, 6 = Saturday
      weekendNights++;
    }
  }

  return {
    weekdayNights: numberOfNights - weekendNights,
    weekendNights,
  };
}

function calculateMealsCosts(totalDays: number, conferenceDays: number, colFactor: number): MealCosts {
  let basicMealsCost = 0;
  for (let i = 0; i < totalDays; i++) {
    // Apply duration-based scaling (100% for days 1-3, 85% for days 4+)
    const dailyMealCost = i < 3 ? TRAVEL_STIPEND.costs.meals * colFactor : TRAVEL_STIPEND.costs.meals * colFactor * 0.85;
    basicMealsCost += dailyMealCost;
  }

  const businessEntertainmentCost = TRAVEL_STIPEND.costs.businessEntertainment * conferenceDays;
  return {
    basicMealsCost,
    businessEntertainmentCost,
  };
}

export async function calculateStipend(record: Conference & { origin?: string }): Promise<StipendBreakdown> {
  if (!record.origin) {
    throw new Error("Origin city is required for travel stipend calculation");
  }
  const origin = record.origin;
  const cacheKey = createHashKey([
    record.conference,
    record.location,
    record.start_date,
    record.end_date,
    origin,
    TRAVEL_STIPEND.costs.hotel,
    TRAVEL_STIPEND.costs.meals,
    record.ticket_price ?? TRAVEL_STIPEND.costs.ticket,
    "v11",
  ]);

  const destination = record.location;
  log.debug(`Calculating stipend for ${record.conference}`);
  log.debug(`Cache key: ${cacheKey}`);
  log.info(`Processing conference: ${record.conference}`);

  // Check if conference is in origin city
  const isOriginCity = origin === destination;

  // Get flight details
  const { flightCost, flightPriceSource, flightDates } = await calculateFlightDetails(origin, destination, isOriginCity, record);

  // Get cost-of-living multiplier for the destination
  const colFactor = await getCostOfLivingFactor(destination);

  // Calculate conference and travel days
  const conferenceDays = calculateDateDiff(record.start_date, record.end_date) + 1;

  // Use custom buffer days if provided, otherwise use defaults
  const preConferenceDays = isOriginCity ? 0 : (record.buffer_days_before ?? TRAVEL_STIPEND.conference.preDays);
  const postConferenceDays = isOriginCity ? 0 : (record.buffer_days_after ?? TRAVEL_STIPEND.conference.postDays);
  const totalDays = conferenceDays + preConferenceDays + postConferenceDays;
  const numberOfNights = totalDays - 1;

  log.info(`Conference duration: ${conferenceDays} days, Total stay: ${totalDays} days (${numberOfNights} nights)`);
  log.info(`Travel dates: ${flightDates.outbound} to ${flightDates.return}`);
  log.debug(`Cost of living factor for ${destination}: ${colFactor}`);

  // Calculate nights breakdown
  const { weekdayNights, weekendNights } = calculateNights(record.start_date, totalDays, preConferenceDays);

  // Adjust lodging rates with cost of living factor and weekend rates
  const baseWeekdayRate = TRAVEL_STIPEND.costs.hotel * colFactor;
  const baseWeekendRate = baseWeekdayRate * TRAVEL_STIPEND.rules.weekendRateMultiplier;

  log.debug(`Nights breakdown: ${weekdayNights} weekday, ${weekendNights} weekend`);
  log.debug(`Base rates: Weekday=${baseWeekdayRate}, Weekend=${baseWeekendRate}`);

  // Calculate costs
  const lodgingCost = isOriginCity ? 0 : weekdayNights * baseWeekdayRate + weekendNights * baseWeekendRate;
  const { basicMealsCost, businessEntertainmentCost } = calculateMealsCosts(totalDays, conferenceDays, colFactor);
  const localTransportCost = await calculateLocalTransportCost(destination, totalDays, colFactor, TRAVEL_STIPEND.costs.transport);
  const ticketPrice = record.ticket_price ? parseFloat(record.ticket_price.replace("$", "")) : TRAVEL_STIPEND.costs.ticket;

  // International travel allowances
  const isInternational = !isOriginCity;
  const internetDataAllowance = isInternational ? TRAVEL_STIPEND.rules.internationalInternet * totalDays : 0;
  const incidentalsAllowance = totalDays * TRAVEL_STIPEND.costs.incidentals;

  // Calculate total stipend
  const totalStipend = flightCost + lodgingCost + localTransportCost + ticketPrice + internetDataAllowance + incidentalsAllowance;

  // Format dates consistently
  function formatDate(dateStr: string) {
    const currentYear = new Date().getFullYear();
    const date = new Date(dateStr);
    date.setFullYear(currentYear);
    return date.getDate() + " " + date.toLocaleString("en-US", { month: "long" });
  }

  const result: StipendBreakdown = {
    conference: record.conference,
    location: destination,
    conference_start: record.start_date,
    conference_end: record.end_date ?? record.start_date,
    flight_departure: formatDate(flightDates.outbound),
    flight_return: formatDate(flightDates.return),
    flight_cost: parseFloat(flightCost.toFixed(2)),
    flight_price_source: flightPriceSource,
    lodging_cost: parseFloat(lodgingCost.toFixed(2)),
    meals_cost: parseFloat((basicMealsCost + businessEntertainmentCost).toFixed(2)),
    basic_meals_cost: parseFloat(basicMealsCost.toFixed(2)),
    business_entertainment_cost: parseFloat(businessEntertainmentCost.toFixed(2)),
    local_transport_cost: parseFloat(localTransportCost.toFixed(2)),
    ticket_price: ticketPrice,
    internet_data_allowance: internetDataAllowance,
    incidentals_allowance: incidentalsAllowance,
    total_stipend: parseFloat(totalStipend.toFixed(2)),
  };

  log.debug("Final stipend breakdown:");
  log.debug(JSON.stringify(result, null, 2));

  stipendCache.set(cacheKey, result);
  return result;
}
