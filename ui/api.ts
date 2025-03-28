import { calculateStipend } from "../src/travel-stipend-calculator";
import { Conference } from "../src/types";
import { DatabaseService } from "../src/utils/database";

console.log("Starting API server...");

const server = Bun.serve({
  port: 3000,
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve static files (HTML, CSS, JS) from ui directory
    if (url.pathname === "/") {
      return new Response(Bun.file("ui/index.html"));
    }
    if (url.pathname === "/style.css") {
      return new Response(Bun.file("ui/style.css"));
    }
    if (url.pathname === "/script.js") { // Serve compiled JS
      return new Response(Bun.file("ui/script.js"));
    }

    // API endpoint for calculation
    if (url.pathname === "/calculate") {
      try {
        const params = url.searchParams;
        const origin = params.get("origin");
        const destination = params.get("destination");
        const departureDate = params.get("departureDate"); // Corresponds to conference start for calculation logic
        const returnDate = params.get("returnDate"); // Corresponds to conference end for calculation logic
        const ticketPrice = params.get("ticketPrice");

        if (!origin || !destination || !departureDate || !returnDate) {
          return new Response(
            JSON.stringify({ message: "Missing required parameters: origin, destination, departureDate, returnDate" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Construct a Conference object similar to CLI/Action handler
        // Note: We might need more sophisticated date parsing/handling here eventually
        const conference: Conference = {
          category: "UI Request",
          conference: `Trip to ${destination}`, // Simple name
          location: destination, // Destination city
          origin: origin, // Origin city
          start_date: departureDate, // Map departure to conference start
          end_date: returnDate, // Map return to conference end
          ticket_price: ticketPrice ?? undefined, // Use provided price or undefined
          // Using default buffer days from constants for simplicity
        };

        console.log("Calculating for:", conference);
        const result = await calculateStipend(conference);
        console.log("Calculation successful");

        // Close DB connection after calculation (important for long-running server)
        await DatabaseService.getInstance().close();

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("API Calculation Error:", error);
        // Close DB connection in case of error too
        await DatabaseService.getInstance().close().catch(dbErr => console.error("DB close error:", dbErr));

        return new Response(
          JSON.stringify({ message: error instanceof Error ? error.message : "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback for other paths
    return new Response("Not Found", { status: 404 });
  },
  error(error) {
    console.error("Server Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`API server listening on http://localhost:${server.port}`);
