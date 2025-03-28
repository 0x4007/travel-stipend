import fs from "fs";
import path from "path";
import { calculateStipend } from "../src/travel-stipend-calculator";
import { Conference } from "../src/types";

console.log("Starting API server...");

const DURATION_CACHE_PATH = path.join(process.cwd(), "ui", "duration-cache.json");
const DEFAULT_DURATION_MS = 53000; // Default if no cache exists or cache is small
const MAX_HISTORY_SIZE = 20; // Keep the last 20 durations

// --- Duration Cache Functions ---
function readDurationHistory(): number[] {
  try {
    if (fs.existsSync(DURATION_CACHE_PATH)) {
      const data = JSON.parse(fs.readFileSync(DURATION_CACHE_PATH, "utf-8"));
      if (Array.isArray(data.durationsMs) && data.durationsMs.every((d: any) => typeof d === 'number')) {
        console.log(`Read ${data.durationsMs.length} durations from cache.`);
        return data.durationsMs;
      }
    }
  } catch (error) {
    console.error("Error reading duration cache:", error);
  }
  console.log("No valid duration history found in cache.");
  return [];
}

function addDurationToHistory(durationMs: number): void {
  try {
    let history = readDurationHistory();
    history.push(durationMs);
    if (history.length > MAX_HISTORY_SIZE) {
      history = history.slice(history.length - MAX_HISTORY_SIZE);
    }
    const data = { durationsMs: history };
    fs.writeFileSync(DURATION_CACHE_PATH, JSON.stringify(data, null, 2));
    console.log(`Wrote duration to cache (${history.length} total): ${durationMs}ms`);
  } catch (error) {
    console.error("Error writing duration cache:", error);
  }
}

// Changed from Median to Average, added rounding up
function calculateAverageDuration(durations: number[]): number {
    if (durations.length === 0) {
        return DEFAULT_DURATION_MS;
    }
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const average = sum / durations.length;
    const roundedUpAverage = Math.ceil(average); // Round up to nearest millisecond
    console.log(`Calculated average duration: ${average.toFixed(2)}ms, Rounded up to: ${roundedUpAverage}ms from ${durations.length} samples.`);
    return roundedUpAverage > 0 ? roundedUpAverage : DEFAULT_DURATION_MS; // Ensure positive
}
// --- End Duration Cache Functions ---

const server = Bun.serve({
  port: 3000,
  idleTimeout: 255, // Seconds

  async fetch(req) {
    const url = new URL(req.url);
    const now = new Date().toLocaleTimeString();

    // --- Static File Serving ---
    if (url.pathname === "/") return new Response(Bun.file("ui/index.html"));
    if (url.pathname === "/style.css") return new Response(Bun.file("ui/style.css"));
    if (url.pathname === "/script.js") return new Response(Bun.file("ui/script.js"));
    // --- End Static File Serving ---

    // --- API Endpoint: Get Estimated Duration (Average) ---
    if (url.pathname === "/estimated-duration") {
        const history = readDurationHistory();
        const duration = calculateAverageDuration(history); // Use average function
        return new Response(JSON.stringify({ durationMs: duration }), {
            headers: { "Content-Type": "application/json" },
        });
    }
    // --- End API Endpoint: Get Estimated Duration ---

    // --- API Endpoint: Calculate Stipend ---
    if (url.pathname === "/calculate") {
      console.log(`[${now}] Received calculation request: ${url.search}`);
      const startTime = Date.now();
      try {
        const params = url.searchParams;
        const origin = params.get("origin");
        const destination = params.get("destination");
        const departureDate = params.get("departureDate");
        const returnDate = params.get("returnDate");
        const ticketPrice = params.get("ticketPrice");

        if (!origin || !destination || !departureDate || !returnDate) {
          console.error("API Error: Missing required parameters");
          return new Response(
            JSON.stringify({ message: "Missing required parameters: origin, destination, departureDate, returnDate" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const conference: Conference = {
          category: "UI Request",
          conference: `Trip to ${destination}`,
          location: destination,
          origin: origin,
          start_date: departureDate,
          end_date: returnDate,
          ticket_price: ticketPrice ?? undefined,
        };

        console.log(`[${now}] Starting calculation for:`, conference);
        const result = await calculateStipend(conference);
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        console.log(`[${new Date(endTime).toLocaleTimeString()}] Calculation successful (Duration: ${durationMs}ms)`);
        addDurationToHistory(durationMs);

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });

      } catch (error) {
         const endTime = Date.now();
         const durationMs = endTime - startTime;
        console.error(`[${new Date(endTime).toLocaleTimeString()}] API Calculation Error (Duration: ${durationMs}ms):`, error);
        addDurationToHistory(durationMs);

        return new Response(
          JSON.stringify({ message: error instanceof Error ? error.message : "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    // --- End API Endpoint: Calculate Stipend ---

    // Fallback for other paths
    console.log(`[${now}] 404 Not Found for path: ${url.pathname}`);
    return new Response("Not Found", { status: 404 });
  },
  error(error) {
    console.error(`[${new Date().toLocaleTimeString()}] Server Error:`, error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`API server listening on http://localhost:${server.port}`);
