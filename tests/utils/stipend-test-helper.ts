import { Conference, StipendBreakdown } from "../../src/utils/types";
import { calculateStipend } from "../../src/travel-stipend-calculator";
import { DEFAULT_TEST_ORIGIN } from "./test-constants";

/**
 * Helper function for calculating travel stipend in tests
 */
export async function calculateTestStipend(
  record: Partial<Conference> & { location: string },
  origin: string = DEFAULT_TEST_ORIGIN
): Promise<StipendBreakdown> {
  // Default values for test calculations
  const defaultRecord: Conference = {
    conference: `Business Trip to ${record.location}`,
    location: record.location,
    start_date: record.start_date ?? "15 April",
    end_date: record.end_date ?? record.start_date ?? "15 April",
    category: "Test",
    description: "",
    ticket_price: "",
    buffer_days_before: 1,
    buffer_days_after: 1
  };

  // Merge provided record with defaults
  const finalRecord: Conference & { origin: string } = {
    ...defaultRecord,
    ...record,
    origin
  };

  return calculateStipend(finalRecord);
}

/**
 * Helper function to generate a test conference record
 */
export function createTestConferenceRecord(
  location: string,
  options: Partial<Conference & { origin?: string }> = {}
): Conference & { origin: string } {
  return {
    conference: options.conference ?? `Business Trip to ${location}`,
    location,
    origin: options.origin ?? DEFAULT_TEST_ORIGIN,
    start_date: options.start_date ?? "15 April",
    end_date: options.end_date ?? options.start_date ?? "15 April",
    category: options.category ?? "Test",
    description: options.description ?? "",
    ticket_price: options.ticket_price ?? "",
    buffer_days_before: options.buffer_days_before ?? 1,
    buffer_days_after: options.buffer_days_after ?? 1
  };
}

/**
 * Helper function for testing flight prices to multiple destinations
 */
export async function calculateTestStipends(
  destinations: string[],
  origin: string = DEFAULT_TEST_ORIGIN
): Promise<StipendBreakdown[]> {
  const results: StipendBreakdown[] = [];

  for (const destination of destinations) {
    try {
      const result = await calculateTestStipend({ location: destination }, origin);
      results.push(result);
    } catch (error) {
      console.error(`Error processing destination "${destination}":`, error);
    }
  }

  return results;
}
