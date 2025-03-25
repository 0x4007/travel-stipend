import { searchFlightPrices } from "./flexible-flight-search";

describe("Flexible Flight Search", () => {
  jest.setTimeout(120000); // 2 minutes timeout for flight searches

  // Define test routes based on distance ranges rather than specific cities
  const testRoutes = [
    {
      name: "Short distance route (800-1500km)",
      params: {
        from: "Origin City A, Country A",
        to: "Destination City B, Country B",
        departureDate: "2024-05-20",
        returnDate: "2024-05-27",
      },
    },
    {
      name: "Medium distance route (2500-4000km)",
      params: {
        from: "Origin City C, Country C",
        to: "Destination City D, Country D",
        departureDate: "2024-06-01",
        returnDate: "2024-06-07",
      },
    },
    {
      name: "Long distance route (5000-8000km)",
      params: {
        from: "Origin City E, Country E",
        to: "Destination City F, Country F",
        departureDate: "2024-06-15",
        returnDate: "2024-06-22",
      },
    },
  ];

  test.each(testRoutes)("$name", async ({ name, params }) => {
    console.log(`\nExecuting test: ${name}`);

    // Use generic location format for testing
    const result = await searchFlightPrices({
      ...params,
    });

    // Basic validation
    expect(result).toBeTruthy();
    expect(result?.success).toBe(true);

    // Log search parameters
    console.log("\nSearch parameters:");
    console.table(params);

    if (result && "prices" in result && result.prices) {
      // Multiple prices returned
      expect(result.prices.length).toBeGreaterThan(0);

      // Calculate average price (excluding invalid prices)
      const validPrices = result.prices.filter((p) => p.price > 0);
      console.log(`Found ${validPrices.length} valid prices out of ${result.prices.length} total`);

      if (validPrices.length > 0) {
        const avgPrice = validPrices.reduce((sum, p) => sum + p.price, 0) / validPrices.length;
        console.log(`Average price: $${avgPrice.toFixed(2)}`);

        // Show sample of prices
        console.log("\nSample of flight options:");
        console.table(
          validPrices.slice(0, 3).map((p) => ({
            price: `$${p.price}`,
            departure: p.departureTime,
            arrival: p.arrivalTime,
            duration: p.duration,
            stops: p.stops,
          }))
        );

        // Verify price data structure for valid prices
        const validPrice = validPrices[0];
        expect(validPrice).toBeTruthy();
        expect(validPrice.price).toBeGreaterThan(0);
        expect(validPrice.departureTime).toBeTruthy();
        expect(validPrice.arrivalTime).toBeTruthy();
        expect(validPrice.duration).toBeTruthy();
        expect(typeof validPrice.stops).toBe("number");
      }
    } else if (result && "price" in result) {
      // Single price returned
      expect(result.price).toBeGreaterThan(0);
      console.log(`Found single price $${result.price} for ${params.from} to ${params.to}`);
      console.log("Source:", result.source);
    }

    console.log("\n" + "-".repeat(50));
  });
});
