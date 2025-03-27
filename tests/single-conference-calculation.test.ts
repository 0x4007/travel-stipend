import { calculateStipend } from "../src/travel-stipend-calculator";
import { DatabaseService } from "../src/utils/database";

describe("Single Conference Complete Calculation Test", () => {
  jest.setTimeout(60000); // Double timeout for flight scraping

  it("should calculate complete stipend for next conference", async () => {
    // Get conferences from database
    const conferences = await DatabaseService.getInstance().getConferences();

    // Find a conference in May (for testing purposes)
    const conference = conferences.find((conf) => {
      const parts = conf.start_date.split(' ');
      if (parts.length < 2) return false;
      return parts[1].toLowerCase() === "may";
    });

    if (!conference) {
      throw new Error("No upcoming conferences found");
    }

    // Add origin for testing
    const conferenceWithOrigin = {
      ...conference,
      origin: "Seoul, South Korea", // Test with fixed origin
    };

    console.log("\nNext conference details:");
    console.table({
      name: conferenceWithOrigin.conference,
      location: conferenceWithOrigin.location,
      start: conferenceWithOrigin.start_date,
      end: conferenceWithOrigin.end_date ?? conferenceWithOrigin.start_date
    });

    // Determine the appropriate year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    // Parse the conference date with current year
    const confDateParts = conferenceWithOrigin.start_date.split(' ');
    const confDate = new Date(`${confDateParts[1]} ${confDateParts[0]}, ${currentYear}`);

    // If the date has passed, use next year
    const year = confDate < currentDate ? currentYear + 1 : currentYear;

    console.log(`Using year: ${year} for conference dates`);

    // Update conference dates with determined year
    conferenceWithOrigin.start_date = `${conferenceWithOrigin.start_date} ${year}`;
    if (conferenceWithOrigin.end_date) {
      conferenceWithOrigin.end_date = `${conferenceWithOrigin.end_date} ${year}`;
    }

    const result = await calculateStipend(conferenceWithOrigin);

    // Display complete breakdown
    console.log("\nStipend breakdown:");
    console.table({
      conference: result.conference,
      location: result.location,
      dates: `${result.conference_start} - ${result.conference_end}`,
      travel: `${result.flight_departure} - ${result.flight_return}`,
      flight_cost: `$${result.flight_cost}`,
      flight_source: result.flight_price_source,
      lodging_cost: `$${result.lodging_cost}`,
      meals_cost: `$${result.meals_cost}`,
      local_transport: `$${result.local_transport_cost}`,
      ticket_price: `$${result.ticket_price}`,
      total_stipend: `$${result.total_stipend}`,
    });

    // Validate the stipend calculation
    expect(result.conference).toBe(conferenceWithOrigin.conference);
    expect(result.location).toBe(conferenceWithOrigin.location);
    expect(result.flight_cost).toBeGreaterThanOrEqual(0);
    expect(result.lodging_cost).toBeGreaterThanOrEqual(0);
    expect(result.meals_cost).toBeGreaterThanOrEqual(0);
    expect(result.ticket_price).toBeGreaterThanOrEqual(0);

    // Total stipend includes all costs
    const calculatedTotal = parseFloat(
      (
        result.flight_cost +
        result.lodging_cost +
        result.meals_cost +
        result.local_transport_cost +
        result.ticket_price +
        result.internet_data_allowance +
        result.incidentals_allowance
      ).toFixed(2)
    );

    expect(result.total_stipend).toBe(calculatedTotal);

    // Validate dates
    // Convert all dates to proper format for comparison
    const flightDep = new Date(`${result.flight_departure} ${year}`);
    const flightRet = new Date(`${result.flight_return} ${year}`);
    const confStart = new Date(`${result.conference_start}`);
    const confEnd = new Date(`${result.conference_end}`);

    // Compare dates properly
    expect(flightDep.getTime()).toBeLessThanOrEqual(confStart.getTime());
    expect(flightRet.getTime()).toBeGreaterThanOrEqual(confEnd.getTime());
  });
});
