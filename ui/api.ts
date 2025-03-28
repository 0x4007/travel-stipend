import { calculateStipend } from "../src/travel-stipend-calculator";
import { Conference } from "../src/types";
import { DatabaseService } from "../src/utils/database";

console.log("Starting API server...");

const server = Bun.serve({
  port: 3000,
  idleTimeout: 255, // Keep increased timeout from previous step
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

    // API endpoint for calculation (HTTP GET)
    if (url.pathname === "/calculate") {
      try {
        const params = url.searchParams;
        const origin = params.get("origin");
        const destination = params.get("destination");
        const departureDate = params.get("departureDate");
        const returnDate = params.get("returnDate");
        const ticketPrice = params.get("ticketPrice");

        if (!origin || !destination || !departureDate || !returnDate) {
          return new Response(
            JSON.stringify({ message: "Missing required parameters: origin, destination, departureDate, returnDate" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Construct Conference object
        const conference: Conference = {
          category: "UI Request",
          conference: `Trip to ${destination}`,
          location: destination,
          origin: origin,
          start_date: departureDate,
          end_date: returnDate,
          ticket_price: ticketPrice ?? undefined,
        };

        console.log("Calculating for:", conference);
        // Call original calculateStipend (no callback)
        const result = await calculateStipend(conference);
        console.log("Calculation successful");

        // Close DB connection after calculation
        // Consider if this is the best place in a server context
        await DatabaseService.getInstance().close();

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("API Calculation Error:", error);
        // Ensure DB is closed on error too
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
