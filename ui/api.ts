import type { ServerWebSocket } from "bun";
import { calculateStipend } from "../src/travel-stipend-calculator";
import { Conference } from "../src/types";
import { DatabaseService } from "../src/utils/database";

console.log("Starting WebSocket server...");

// Type for WebSocket messages from server
interface WebSocketMessage {
    type: 'log' | 'result' | 'error';
    payload: any;
}

// Helper to send structured messages
function sendWsMessage(ws: ServerWebSocket<any>, type: WebSocketMessage['type'], payload: any) {
    const message: WebSocketMessage = { type, payload };
    ws.send(JSON.stringify(message));
}


const server = Bun.serve({ // Removed incorrect type argument
  port: 3000,
  idleTimeout: 255, // Keep increased timeout

  // --- HTTP Fetch Handler (for static files) ---
  fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade to WebSocket if requested
    if (url.pathname === "/ws") {
      const success = server.upgrade(req, {
          data: { startTime: Date.now() } // Pass initial data if needed
      });
      if (success) {
        // Bun automatically handles the response for successful upgrades
        return;
      } else {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
    }

    // Serve static files
    if (url.pathname === "/") {
      return new Response(Bun.file("ui/index.html"));
    }
    if (url.pathname === "/style.css") {
      return new Response(Bun.file("ui/style.css"));
    }
    if (url.pathname === "/script.js") { // Serve compiled JS
      return new Response(Bun.file("ui/script.js"));
    }

    // Fallback for other HTTP paths
    return new Response("Not Found", { status: 404 });
  },

  // --- WebSocket Handler ---
  websocket: {
    open(ws) {
      console.log(`WebSocket opened by ${ws.remoteAddress}`);
      sendWsMessage(ws, 'log', 'Connection established. Ready for calculation request.');
    },
    async message(ws, message) {
        console.log(`Received message: ${message}`);
        let requestData: any;

        try {
            requestData = JSON.parse(message.toString());
        } catch (e) {
            console.error("Failed to parse incoming WebSocket message:", e);
            sendWsMessage(ws, 'error', 'Invalid request format. Please send JSON.');
            return;
        }

        const { origin, destination, departureDate, returnDate, ticketPrice } = requestData;

        if (!origin || !destination || !departureDate || !returnDate) {
            sendWsMessage(ws, 'error', 'Missing required parameters: origin, destination, departureDate, returnDate');
            return;
        }

        try {
            sendWsMessage(ws, 'log', `Received request: ${origin} -> ${destination} (${departureDate} - ${returnDate})`);

            // Construct Conference object
            const conference: Conference = {
                category: "UI Request",
                conference: `Trip to ${destination}`,
                location: destination,
                origin: origin,
                start_date: departureDate,
                end_date: returnDate,
                ticket_price: ticketPrice || undefined,
            };

            sendWsMessage(ws, 'log', 'Ensuring database is initialized...');
            // Call a DB method to trigger initialization if not already done
            await DatabaseService.getInstance().getCostOfLiving(origin); // Using origin, but any valid call works
            sendWsMessage(ws, 'log', 'Database ready. Starting stipend calculation...');

            // Define the log callback function for this specific WebSocket connection
            const logCallback = (logMessage: string) => {
                sendWsMessage(ws, 'log', logMessage);
            };

            // --- Call the core calculation logic ---
            const result = await calculateStipend(conference, logCallback); // Pass the callback
            // ---------------------------------------

            // Send final log message (calculateStipend sends its own final one now)
            // sendWsMessage(ws, 'log', 'Calculation finished successfully.');
            sendWsMessage(ws, 'result', result); // Send the final result

            // Note: Not closing DB connection here to allow reuse for subsequent requests
            // await DatabaseService.getInstance().close();

        } catch (error) {
            console.error("WebSocket Calculation Error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown calculation error occurred";
            sendWsMessage(ws, 'error', errorMessage);
            // Ensure DB connection is potentially closed or handled on error if necessary
            // await DatabaseService.getInstance().close().catch(dbErr => console.error("DB close error:", dbErr));
        }
    },
    close(ws, code, reason) {
      console.log(`WebSocket closed by ${ws.remoteAddress}. Code: ${code}, Reason: ${reason}`);
    }
    // Removed invalid 'error' property specific to websocket handler
  }, // End of websocket handler

  // --- General Server Error Handler ---
  error(error) {
    console.error("Server Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`WebSocket server listening on http://localhost:${server.port}`);
