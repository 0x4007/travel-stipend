#!/usr/bin/env bun
import fs from "fs";
import path from "path";
import { Conference, MealCosts, StipendBreakdown } from "./types";
import { createHashKey, PersistentCache } from "./utils/cache";
import {
  BASE_LOCAL_TRANSPORT_PER_DAY,
  BASE_LODGING_PER_NIGHT,
  BASE_MEALS_PER_DAY,
  BUSINESS_ENTERTAINMENT_PER_DAY,
  DEFAULT_TICKET_PRICE,
  INCIDENTALS_PER_DAY,
  INTERNATIONAL_INTERNET_ALLOWANCE,
  POST_CONFERENCE_DAYS,
  PRE_CONFERENCE_DAYS,
  WEEKEND_RATE_MULTIPLIER,
} from "./utils/constants";
import { getCostOfLivingFactor } from "./utils/cost-of-living";
import { DatabaseService } from "./utils/database";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { scrapeFlightPrice } from "./utils/flights";
import { calculateLocalTransportCost } from "./utils/taxi-fares";

// Initialize caches
const costOfLivingCache = new PersistentCache<number>("fixtures/cache/col-cache.json");
const stipendCache = new PersistentCache<StipendBreakdown>("fixtures/cache/stipend-cache.json");

// Helper function to calculate flight cost
async function calculateFlightCostForConference(
  origin: string,
  destination: string,
  flightDates: { outbound: string; return: string },
  isOriginCity: boolean
): Promise<{ cost: number; source: string }> {
  if (isOriginCity) {
    console.log(`No flight cost for ${destination} (same as origin)`);
    return { cost: 0, source: "No flight needed" };
  }

  const scrapedResult = await scrapeFlightPrice(origin, destination, flightDates);

  if (scrapedResult.price === null) {
    throw new Error(`Failed to get flight price for ${destination} from Google Flights`);
  }

  console.log(`Flight cost for ${destination}: ${scrapedResult.price} (from ${scrapedResult.source})`);
  return { cost: scrapedResult.price, source: scrapedResult.source };
}

async function calculateFlightDetails(
  origin: string,
  destination: string,
  isOriginCity: boolean,
  record: Conference
): Promise<{
  flightCost: number;
  flightPriceSource: string;
  flightDates: { outbound: string; return: string };
}> {
  const flightDates = generateFlightDates(record, isOriginCity);
  const flightResult = await calculateFlightCostForConference(origin, destination, flightDates, isOriginCity);

  return {
    flightCost: flightResult.cost,
    flightPriceSource: flightResult.source,
    flightDates,
  };
}

function calculateNights(startDate: string, totalDays: number, preConferenceDays: number): { weekdayNights: number; weekendNights: number } {
  const start = new Date(startDate);
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
    const dailyMealCost = i < 3 ? BASE_MEALS_PER_DAY * colFactor : BASE_MEALS_PER_DAY * colFactor * 0.85;
    basicMealsCost += dailyMealCost;
  }

  const businessEntertainmentCost = BUSINESS_ENTERTAINMENT_PER_DAY * conferenceDays;
  return {
    basicMealsCost,
    mealsCost: basicMealsCost + businessEntertainmentCost,
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
    BASE_LODGING_PER_NIGHT,
    BASE_MEALS_PER_DAY,
    record.ticket_price ?? DEFAULT_TICKET_PRICE,
    "v11",
  ]);

  const destination = record.location;
  console.log(`Processing conference: ${record.conference} in ${destination}`);

  // Check if conference is in origin city
  const isOriginCity = origin === destination;

  // Get flight details
  const { flightCost, flightPriceSource, flightDates } = await calculateFlightDetails(origin, destination, isOriginCity, record);

  // Get cost-of-living multiplier for the destination
  const colFactor = await getCostOfLivingFactor(destination);

  // Calculate conference and travel days
  const conferenceDays = calculateDateDiff(record.start_date, record.end_date) + 1;

  // Use custom buffer days if provided, otherwise use defaults
  const preConferenceDays = isOriginCity ? 0 : (record.buffer_days_before ?? PRE_CONFERENCE_DAYS);
  const postConferenceDays = isOriginCity ? 0 : (record.buffer_days_after ?? POST_CONFERENCE_DAYS);
  const totalDays = conferenceDays + preConferenceDays + postConferenceDays;
  const numberOfNights = totalDays - 1;

  console.log(`Conference duration: ${conferenceDays} days, Total stay: ${totalDays} days (${numberOfNights} nights)`);
  console.log(`Travel dates: ${flightDates.outbound} to ${flightDates.return}`);

  // Calculate nights breakdown
  const { weekdayNights, weekendNights } = calculateNights(record.start_date, totalDays, preConferenceDays);

  // Adjust lodging rates with cost of living factor and weekend rates
  const baseWeekdayRate = BASE_LODGING_PER_NIGHT * colFactor;
  const baseWeekendRate = baseWeekdayRate * WEEKEND_RATE_MULTIPLIER;

  // Calculate costs
  const lodgingCost = isOriginCity ? 0 : weekdayNights * baseWeekdayRate + weekendNights * baseWeekendRate;
  const { basicMealsCost, mealsCost, businessEntertainmentCost } = calculateMealsCosts(totalDays, conferenceDays, colFactor);
  const localTransportCost = await calculateLocalTransportCost(destination, totalDays, colFactor, BASE_LOCAL_TRANSPORT_PER_DAY);
  const ticketPrice = record.ticket_price ? parseFloat(record.ticket_price.replace("$", "")) : DEFAULT_TICKET_PRICE;

  // International travel allowances
  const isInternational = !isOriginCity && origin.toLowerCase().includes("korea") && !destination.toLowerCase().includes("korea");
  const internetDataAllowance = isInternational ? INTERNATIONAL_INTERNET_ALLOWANCE * totalDays : 0;
  const incidentalsAllowance = totalDays * INCIDENTALS_PER_DAY;

  // Calculate total stipend
  const totalStipend = flightCost + lodgingCost + mealsCost + localTransportCost + ticketPrice + internetDataAllowance + incidentalsAllowance;

  // Format dates consistently
  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
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
    basic_meals_cost: parseFloat(basicMealsCost.toFixed(2)),
    business_entertainment_cost: parseFloat(businessEntertainmentCost.toFixed(2)),
    local_transport_cost: parseFloat(localTransportCost.toFixed(2)),
    ticket_price: ticketPrice,
    internet_data_allowance: internetDataAllowance,
    incidentals_allowance: incidentalsAllowance,
    total_stipend: parseFloat(totalStipend.toFixed(2)),
    meals_cost: parseFloat(mealsCost.toFixed(2)),
  };

  stipendCache.set(cacheKey, result);
  return result;
}

function parseArgs(): { sortBy?: keyof StipendBreakdown; reverse: boolean } {
  const args = process.argv.slice(2);
  const validColumns = new Set<keyof StipendBreakdown>([
    "conference",
    "location",
    "conference_start",
    "conference_end",
    "flight_departure",
    "flight_return",
    "flight_cost",
    "flight_price_source",
    "lodging_cost",
    "basic_meals_cost",
    "business_entertainment_cost",
    "local_transport_cost",
    "ticket_price",
    "internet_data_allowance",
    "incidentals_allowance",
    "total_stipend",
  ]);

  const options = { reverse: args.includes("-r") || args.includes("--reverse") };

  const sortFlagIndex = args.findIndex((arg) => arg === "--sort" || arg === "-s");
  if (sortFlagIndex !== -1 && sortFlagIndex < args.length - 1) {
    const sortColumn = args[sortFlagIndex + 1] as keyof StipendBreakdown;
    if (validColumns.has(sortColumn)) {
      return { ...options, sortBy: sortColumn };
    }
    console.warn(`Invalid sort column: ${sortColumn}. Valid columns are: ${Array.from(validColumns).join(", ")}`);
  }

  return options;
}

async function main() {
  console.log("Starting travel stipend calculation...");

  try {
    const options = parseArgs();
    console.log("Reading conferences from database...");
    const records = await DatabaseService.getInstance().getConferences();
    console.log(`Loaded ${records.length} conference records`);

    // Get future conferences
    const currentDate = new Date();
    const futureRecords = records.filter((record) => {
      try {
        const startDate = new Date(`${record.start_date} ${currentDate.getFullYear()}`);
        const nextYearDate = new Date(`${record.start_date} ${currentDate.getFullYear() + 1}`);
        const conferenceDate = startDate < currentDate ? nextYearDate : startDate;
        return conferenceDate >= currentDate;
      } catch (error) {
        console.error(`Error parsing date for conference "${record.conference}":`, error);
        return false;
      }
    });

    console.log(`Found ${futureRecords.length} upcoming conferences`);

    const results: StipendBreakdown[] = [];
    for (const record of futureRecords) {
      try {
        results.push(await calculateStipend(record));
      } catch (error) {
        console.error(`Error processing conference "${record.conference}":`, error);
      }
    }

    if (options.sortBy) {
      const sortDirection = options.reverse ? "descending" : "ascending";
      console.log(`Sorting results by ${options.sortBy} (${sortDirection})`);

      results.sort((a, b) => {
        if (!options.sortBy) return 0;
        const valueA = a[options.sortBy];
        const valueB = b[options.sortBy];
        let comparison = 0;
        if (typeof valueA === "string" && typeof valueB === "string") {
          comparison = valueA.localeCompare(valueB);
        } else {
          comparison = (valueA as number) - (valueB as number);
        }
        return options.reverse ? -comparison : comparison;
      });
    }

    // Save caches
    costOfLivingCache.saveToDisk();
    stipendCache.saveToDisk();

    // Create output directory
    const outputsDir = "outputs";
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir);
    }

    // Generate filename with timestamp and sort info
    const timestamp = Math.floor(Date.now() / 1000);
    let sortInfo = "";
    if (options.sortBy) {
      const direction = options.reverse ? "_desc" : "_asc";
      sortInfo = `_sorted_by_${options.sortBy}${direction}`;
    }
    const outputFile = path.join(outputsDir, `stipends_${timestamp}${sortInfo}.csv`);

    // Generate CSV
    const header = [
      "conference",
      "location",
      "conference_start",
      "conference_end",
      "flight_departure",
      "flight_return",
      "flight_cost",
      "flight_price_source",
      "lodging_cost",
      "basic_meals_cost",
      "business_entertainment_cost",
      "local_transport_cost",
      "ticket_price",
      "internet_data_allowance",
      "incidentals_allowance",
      "total_stipend",
    ].join(",");

    const rows = results.map((r) =>
      [
        `"${r.conference}"`,
        `"${r.location}"`,
        `"${r.conference_start}"`,
        `"${r.conference_end ?? ""}"`,
        `"${r.flight_departure}"`,
        `"${r.flight_return}"`,
        r.flight_cost,
        `"${r.flight_price_source}"`,
        r.lodging_cost,
        r.basic_meals_cost,
        r.business_entertainment_cost,
        r.local_transport_cost,
        r.ticket_price,
        r.internet_data_allowance,
        r.incidentals_allowance,
        r.total_stipend,
      ].join(",")
    );

    fs.writeFileSync(outputFile, [header, ...rows].join("\n"));
    console.log("Calculation complete. Results saved to:", outputFile);

    console.table(
      results.map((r) => ({
        conference: r.conference,
        location: r.location,
        dates: `${r.conference_start} - ${r.conference_end ?? r.conference_start}`,
        flight_cost: r.flight_cost,
        lodging_cost: r.lodging_cost,
        total_stipend: r.total_stipend,
      }))
    );
  } catch (error) {
    console.error("Error calculating travel stipends:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Execution error:", err);
    process.exit(1);
  });
}
