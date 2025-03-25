import { calculateStipend } from "../src/travel-stipend-calculator";
import { DatabaseService } from "../src/utils/database";

describe("Single Conference Complete Calculation Test", () => {
  jest.setTimeout(30000); // Increase timeout for API calls

  it("should calculate complete stipend for next conference", async () => {
    // Get conferences from database
    const conferences = await DatabaseService.getInstance().getConferences();

    // Get the first upcoming conference
    const currentDate = new Date();
    const conference = conferences.find(conf => {
      const startDate = new Date(`${conf.start_date} ${currentDate.getFullYear()}`);
      const nextYearDate = new Date(`${conf.start_date} ${currentDate.getFullYear() + 1}`);
      const conferenceDate = startDate < currentDate ? nextYearDate : startDate;
      return conferenceDate >= currentDate;
    });

    if (!conference) {
      throw new Error("No upcoming conferences found");
    }

    // Add origin for testing
    const conferenceWithOrigin = {
      ...conference,
      origin: "Seoul, South Korea" // Test with fixed origin
    };

    console.log("\nNext conference details:");
    console.table({
      name: conferenceWithOrigin.conference,
      location: conferenceWithOrigin.location,
      start: conferenceWithOrigin.start_date,
      end: conferenceWithOrigin.end_date ?? conferenceWithOrigin.start_date,
    });

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
    const calculatedTotal = parseFloat((
      result.flight_cost +
      result.lodging_cost +
      result.meals_cost +
      result.local_transport_cost +
      result.ticket_price +
      result.internet_data_allowance +
      result.incidentals_allowance
    ).toFixed(2));

    expect(result.total_stipend).toBe(calculatedTotal);

    // Validate dates
    expect(Date.parse(result.flight_departure)).toBeLessThanOrEqual(Date.parse(result.conference_start));
    expect(Date.parse(result.flight_return)).toBeGreaterThanOrEqual(Date.parse(result.conference_end));
  });
});
