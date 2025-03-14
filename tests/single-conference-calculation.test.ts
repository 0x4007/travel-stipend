import { calculateStipend } from "../src/travel-stipend-calculator";
import { findUpcomingConferences } from "../src/utils/flights";

describe("Single Conference Complete Calculation Test", () => {
  jest.setTimeout(30000); // Increase timeout for API calls

  it("should calculate complete stipend for next conference", async () => {
    const conference = findUpcomingConferences(1)[0];
    console.log("\nNext conference details:");
    console.table({
      name: conference.Conference,
      location: conference.Location,
      start: conference.Start,
      end: conference.End,
    });

    const result = await calculateStipend(conference);

    // Display complete breakdown
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

    // Validate the stipend calculation
    expect(result.conference).toBe(conference.Conference);
    expect(result.location).toBe(conference.Location);
    expect(result.distance_km).toBeGreaterThan(0);
    expect(result.flight_cost).toBeGreaterThan(0);
    expect(result.lodging_cost).toBeGreaterThan(0);
    expect(result.meals_cost).toBeGreaterThan(0);
    expect(result.ticket_price).toBeGreaterThan(0);
    expect(result.total_stipend).toBe(result.flight_cost + result.lodging_cost + result.meals_cost + result.ticket_price);
  });
});
