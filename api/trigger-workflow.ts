// Deno Deploy Function - Serves Static UI, Handles WS, Triggers Actions, Receives Logs & Results

import { crypto } from "https://deno.land/std@0.192.0/crypto/mod.ts";
import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import * as path from "https://deno.land/std@0.192.0/path/mod.ts";
import * as djwt from "https://deno.land/x/djwt@v2.8/mod.ts";

// --- Types ---
interface WebSocketMessage {
    type: 'log' | 'status' | 'result' | 'error' | 'request_calculation';
    payload: any;
    clientId?: string;
}

// Store active WebSocket connections mapped by clientId
const clients = new Map<string, WebSocket>();

// --- Helper to get required environment variables ---
function getEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Server config error: Missing ${key}`);
  return value;
}

// --- GitHub App Authentication ---
async function getInstallationToken(appId: string, installationId: string, privateKeyPem: string): Promise<string> {
  // ... (getInstallationToken function remains the same) ...
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + (10 * 60);
  const payload = { iat: now - 60, exp: expiration, iss: appId };
  let privateKey: CryptoKey;
  try {
    privateKey = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch (e) {
    console.error("Error importing private key:", e);
    let errMsg = "Failed to import GitHub App private key.";
    if (e instanceof Error && (e.message.includes("ASN.1") || e.message.includes("decode base64"))) { errMsg += " Check format/newlines."; }
    else if (e instanceof Error) { errMsg += ` (${e.message})`; }
    throw new Error(errMsg);
  }
  const jwt = await djwt.create({ alg: "RS256", typ: "JWT" }, payload, privateKey);
  const tokenUrl = `https://api.github.com/app/installations/${installationId}/access_tokens`;
  try {
    const response = await fetch(tokenUrl, { method: "POST", headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github.v3+json" } });
    if (!response.ok) { const errorBody = await response.text(); throw new Error(`Failed to get installation token: ${response.status} ${response.statusText} - ${errorBody}`); }
    const data = await response.json();
    if (!data.token) throw new Error("Installation token not found.");
    console.log("Successfully obtained GitHub App installation token.");
    return data.token;
  } catch (error) { console.error("Error fetching installation token:", error); throw error; }
}
function pemToArrayBuffer(pem: string): ArrayBuffer {
    // ... (pemToArrayBuffer function remains the same) ...
    const base64 = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
    try {
        const binaryString = atob(base64);
        const len = binaryString.length; const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
        return bytes.buffer;
    } catch (e) { console.error("Failed to decode base64 key.", e); throw new Error("Failed to decode base64 key."); }
}
// --- End GitHub App Authentication ---

// --- Helper to send structured messages ---
function sendWsMessage(ws: WebSocket, type: WebSocketMessage['type'], payload: any) {
    try {
        if (ws.readyState === WebSocket.OPEN) {
            const message: WebSocketMessage = { type, payload };
            ws.send(JSON.stringify(message));
        } else { console.warn("Attempted to send message to closed WebSocket."); }
    } catch (error) { console.error("Error sending WebSocket message:", error); }
}

// --- Main Request Handler ---
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  console.log(`Request: ${req.method} ${pathname}`);

  // --- CORS Headers ---
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Callback-Secret" }; // Added X-Callback-Secret
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // --- WebSocket Upgrade ---
  if (pathname === "/ws") {
    if (req.headers.get("upgrade") !== "websocket") return new Response("Expected websocket upgrade", { status: 400 });
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onopen = () => console.log("WebSocket connected!");
    socket.onmessage = async (event) => { /* ... WebSocket message handling for request_calculation ... */
        console.log("WebSocket message received:", event.data);
        let parsedMessage: WebSocketMessage;
        try { parsedMessage = JSON.parse(event.data); }
        catch (e) { sendWsMessage(socket, 'error', 'Invalid message format.'); return; }

        if (parsedMessage.type === 'request_calculation' && parsedMessage.clientId && parsedMessage.payload) {
            const clientId = parsedMessage.clientId;
            const requestData = parsedMessage.payload;
            clients.set(clientId, socket);
            console.log(`Client registered/request received: ${clientId}`);
            sendWsMessage(socket, 'status', 'Received calculation request. Triggering workflow...');
            try {
                const { origin, destination, startDate, endDate, price } = requestData;
                 if (!origin || !destination || !startDate) throw new Error("Missing fields.");
                const inputs = { origins: origin, destinations: destination, start_dates: startDate, end_dates: endDate || "", ticket_prices: price || "0", clientId: clientId }; // Pass clientId
                const appId = getEnv("GITHUB_APP_ID"), installationId = getEnv("GITHUB_APP_INSTALLATION_ID"), privateKey = getEnv("GITHUB_APP_PRIVATE_KEY");
                const owner = getEnv("GITHUB_OWNER"), repo = getEnv("GITHUB_REPO"), workflowId = getEnv("WORKFLOW_ID");
                const installationToken = await getInstallationToken(appId, installationId, privateKey);
                const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
                const body = JSON.stringify({ ref: "main", inputs: inputs });
                console.log(`Triggering workflow ${workflowId} for client ${clientId}...`);
                const ghResponse = await fetch(dispatchUrl, { method: "POST", headers: { Authorization: `token ${installationToken}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" }, body: body });
                if (!ghResponse.ok) { let err = `GitHub API Error: ${ghResponse.status}`; try { const ghErr = await ghResponse.json(); err += `: ${ghErr.message || JSON.stringify(ghErr)}`; } catch(e){} console.error(err); throw new Error(err); }
                console.log(`Workflow dispatch successful for client ${clientId}`);
                sendWsMessage(socket, 'status', 'Workflow triggered successfully. Waiting for results...');
            } catch (error) {
                console.error(`Error triggering workflow for client ${clientId}:`, error);
                sendWsMessage(socket, 'error', `Failed to trigger workflow: ${error.message}`);
                clients.delete(clientId);
            }
        } else { sendWsMessage(socket, 'error', 'Invalid message type or missing clientId/payload.'); }
    };
    socket.onclose = (event) => { /* ... Close handling ... */
        console.log("WebSocket closed:", event.code, event.reason);
        for (const [clientId, clientSocket] of clients.entries()) { if (clientSocket === socket) { clients.delete(clientId); console.log(`Client unregistered: ${clientId}`); break; } }
    };
    socket.onerror = (error) => { /* ... Error handling ... */
        console.error("WebSocket error:", error);
         for (const [clientId, clientSocket] of clients.entries()) { if (clientSocket === socket) { clients.delete(clientId); console.log(`Client unregistered due to error: ${clientId}`); break; } }
    };
    return response;
  }
  // --- End WebSocket Upgrade ---

  // --- API Endpoint: Workflow Log Callback ---
  if (pathname === "/api/log-message" && req.method === "POST") {
      const sharedSecret = getEnv("PROXY_CALLBACK_SECRET");
      const incomingSecret = req.headers.get("X-Callback-Secret");
      if (!incomingSecret || incomingSecret !== sharedSecret) { console.warn("Unauthorized log callback."); return new Response("Unauthorized", { status: 401 }); }
      try {
          const data = await req.json();
          const clientId = data.clientId;
          const logMessage = data.message; // Expect 'message' field for logs
          if (!clientId || typeof logMessage !== 'string') throw new Error("Invalid log callback payload.");
          const clientSocket = clients.get(clientId);
          if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
              // Send timestamped log message
              const timestamp = new Date().toLocaleTimeString();
              sendWsMessage(clientSocket, 'log', `[${timestamp}] ${logMessage}`);
          } else { console.warn(`Client ${clientId} not found/closed for log message.`); }
          return new Response("Log received", { status: 200 });
      } catch (error) { console.error("Error processing log callback:", error); return new Response(`Error: ${error.message}`, { status: 400 }); }
  }
  // --- End Workflow Log Callback ---


  // --- API Endpoint: Workflow Completion Callback ---
  if (pathname === "/api/workflow-complete" && req.method === "POST") {
      const sharedSecret = getEnv("PROXY_CALLBACK_SECRET");
      const incomingSecret = req.headers.get("X-Callback-Secret");
      if (!incomingSecret || incomingSecret !== sharedSecret) { console.warn("Unauthorized result callback."); return new Response("Unauthorized", { status: 401 }); }
      try {
          const data = await req.json();
          const clientId = data.clientId; const results = data.results;
          if (!clientId || !results) throw new Error("Invalid result callback payload.");
          const clientSocket = clients.get(clientId);
          if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
              console.log(`Sending results back to client: ${clientId}`);
              sendWsMessage(clientSocket, 'result', results);
              // Optionally close socket after sending results
              // clientSocket.close(); clients.delete(clientId);
          } else { console.warn(`Client ${clientId} not found/closed for results.`); }
          return new Response("Callback received", { status: 200 });
      } catch (error) { console.error("Error processing result callback:", error); return new Response(`Error: ${error.message}`, { status: 400 }); }
  }
  // --- End Workflow Completion Callback ---


  // --- Static File Serving ---
  try {
      const scriptDir = path.dirname(path.fromFileUrl(import.meta.url));
      const uiDir = path.join(scriptDir, "..", "ui");
      const response = await serveDir(req, { fsRoot: uiDir, urlRoot: "", showDirListing: false, quiet: true });
      response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
      return response;
  } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
          console.log(`Static file not found: ${pathname}`);
          return new Response("Not Found", { status: 404, headers: corsHeaders });
      }
      console.error(`Error serving static file ${pathname}:`, error);
      return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
  }
  // --- End Static File Serving ---
}

// --- Start Deno Server ---
console.log("Proxy server with static UI and WebSocket listening on http://localhost:8000");
serve(handler);
