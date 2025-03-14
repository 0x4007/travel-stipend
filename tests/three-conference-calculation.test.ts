import { calculateStipend } from "../src/travel-stipend-calculator";
import { findUpcomingConferences } from "../src/utils/flights";

describe("Three Conference Complete Calculation Test", () => {
  jest.setTimeout(60000); // Increase timeout for multiple API calls

  it("should calculate complete stipend for next three conferences", async () => {
    const conferences = findUpcomingConferences(3);
    const results = [];

    for (const conference of conferences) {
      console.log("\nConference details:");
      console.table({
        name: conference.Conference,
        location: conference.Location,
        start: conference.Start,
        end: conference.End,
      });

      const result = await calculateStipend(conference);
      results.push(result);

      // Display complete breakdown for each conference
      console.log("\nStipend breakdown:");
      console.table({
        conference: result.conference,
        location: result.location,
        distance_km: `${result.distance_km} km`,
        flight_cost: `$${result.flight_cost}`,
        lodging_cost: `$${result.lodging_cost}`,
        meals_cost: `$${result.meals_cost}`,
        ticket_price: `$${result.ticket_price}`,
        total_stipend: `$${result.total_stipend}`,
      });
    }

    // Validate we got results for all conferences
    expect(results.length).toBe(conferences.length);

    // Validate each conference calculation
    results.forEach((result, index) => {
      const conference = conferences[index];
      expect(result.conference).toBe(conference.Conference);
      expect(result.location).toBe(conference.Location);
      expect(result.distance_km).toBeGreaterThan(0);
      expect(result.flight_cost).toBeGreaterThan(0);
      expect(result.lodging_cost).toBeGreaterThan(0);
      expect(result.meals_cost).toBeGreaterThan(0);
      expect(result.ticket_price).toBeGreaterThan(0);
      expect(result.total_stipend).toBe(result.flight_cost + result.lodging_cost + result.meals_cost + result.ticket_price);
    });

    // Display total cost for all three conferences
    const totalCost = results.reduce((sum, result) => sum + result.total_stipend, 0);
    console.log(`\nTotal cost for all three conferences: $${totalCost.toFixed(2)}`);
  });
});
