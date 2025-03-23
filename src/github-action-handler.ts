#!/usr/bin/env bun
import * as core from '@actions/core';
import { Conference } from './utils/types';
import { calculateStipend } from './travel-stipend-calculator';
import { DatabaseService } from './utils/database';
import { GoogleFlightsStrategy } from './strategies/google-flights-strategy';
import { FlightPricingContextImpl } from './strategies/flight-pricing-context';
import { findBestMatchingConference } from './utils/conference-matcher';

// Split into smaller functions to reduce cognitive complexity
async function getConferenceDetails(
  conferenceName: string | undefined,
  location: string
): Promise<{ name: string; category: string; description: string }> {
  const defaultName = `Business Trip to ${location}`;
  const defaultCategory = "Github Action";
  const defaultDescription = "";

  if (!conferenceName) {
    return { name: defaultName, category: defaultCategory, description: defaultDescription };
  }

  const matchResult = await findBestMatchingConference(conferenceName);

  if (matchResult.found) {
    if (matchResult.similarity && matchResult.similarity < 1.0) {
      core.info(`Using closest matching conference: "${matchResult.conference?.conference}" (${Math.round(matchResult.similarity * 100)}% match)`);
    }
    return {
      name: matchResult.conference?.conference ?? conferenceName,
      category: matchResult.conference?.category ?? defaultCategory,
      description: matchResult.conference?.description ?? defaultDescription
    };
  }

  if (matchResult.suggestions?.length) {
    core.info('Conference not found in database. Similar conferences:');
    matchResult.suggestions.forEach((conf, i) => {
      core.info(`  ${i + 1}. ${conf.conference}`);
    });
    core.info('Using provided conference name.');
  }

  return { name: conferenceName, category: defaultCategory, description: defaultDescription };
}

async function run(): Promise<void> {
  let flightContext: FlightPricingContextImpl | undefined;

  try {
    // Get inputs
    const location = core.getInput('location', { required: true });
    const conferenceStart = core.getInput('conference_start', { required: true });
    const conferenceEnd = core.getInput('conference_end') || conferenceStart;
    const conferenceName = core.getInput('conference_name');
    const daysBefore = parseInt(core.getInput('days_before') || '1', 10);
    const daysAfter = parseInt(core.getInput('days_after') || '1', 10);
    const ticketPrice = core.getInput('ticket_price');

    // Safety check: require at least 1 day before AND 1 day after for flights
    if (daysBefore < 1) {
      core.warning('Cannot fly on conference start day - you would miss the beginning!');
      core.warning('Using minimum 1 day before conference');
    }

    if (daysAfter < 1) {
      core.warning('Cannot fly on conference end day - you would miss the conclusion!');
      core.warning('Using minimum 1 day after conference');
    }

    // Get conference details using helper function
    const { name, category, description } = await getConferenceDetails(conferenceName, location);

    // Create conference record
    const conference: Conference = {
      conference: name,
      location,
      start_date: conferenceStart,
      end_date: conferenceEnd,
      ticket_price: ticketPrice ? `$${ticketPrice}` : '',
      category,
      description,
      buffer_days_before: Math.max(1, daysBefore),
      buffer_days_after: Math.max(1, daysAfter)
    };

    // Use Google Flights strategy for accurate pricing
    const strategy = new GoogleFlightsStrategy();
    flightContext = new FlightPricingContextImpl(strategy);

    // Calculate stipend
    const result = await calculateStipend(conference);
    const nights = Math.ceil((new Date(result.flight_return).getTime() - new Date(result.flight_departure).getTime()) / (1000 * 60 * 60 * 24));
    const days = nights + 1;

    // Set outputs
    core.setOutput('stipend', {
      conference: result.conference,
      location: result.location,
      conference_start: result.conference_start,
      conference_end: result.conference_end,
      flight_departure: result.flight_departure,
      flight_return: result.flight_return,
      flight_cost: result.flight_cost,
      flight_price_source: result.flight_price_source,
      lodging_cost: result.lodging_cost,
      meals_cost: result.meals_cost,
      local_transport_cost: result.local_transport_cost,
      ticket_price: result.ticket_price,
      total_stipend: result.total_stipend,
      stay_duration: {
        nights,
        days
      }
    });

    // Build summary table
    const summaryTable = [
      [
        { data: 'Item', header: true },
        { data: 'Details', header: true },
        { data: 'Cost', header: true }
      ],
      ['Conference', `${result.conference} in ${result.location}`, ''],
      ['Dates', `${result.conference_start} to ${result.conference_end}`, ''],
      ['Travel', `${result.flight_departure} to ${result.flight_return}`, ''],
      ['Flight', result.flight_price_source, `$${result.flight_cost}`],
      ['Lodging', `${nights} nights`, `$${result.lodging_cost}`],
      ['Meals', `${days} days`, `$${result.meals_cost}`],
      ['Local Transport', `${days} days`, `$${result.local_transport_cost}`],
      ['Conference Ticket', '', `$${result.ticket_price}`],
      ['Total Stipend', '', `$${result.total_stipend}`]
    ];

    // Write summary
    await core.summary
      .addHeading('Travel Stipend Calculation')
      .addTable(summaryTable)
      .addBreak()
      .write();

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  } finally {
    // Clean up resources
    if (flightContext) {
      await flightContext.cleanup();
    }
    await DatabaseService.getInstance().close();
  }
}

// Handle errors in the top-level async function
run().catch(error => {
  core.setFailed(`Unhandled error in run(): ${error}`);
});
