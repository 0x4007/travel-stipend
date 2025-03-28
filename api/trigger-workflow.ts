// Deno Deploy Function - Serves Static UI and Proxies Workflow Trigger

import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts"; // For serving static files
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import * as path from "https://deno.land/std@0.192.0/path/mod.ts";
import * as djwt from "https://deno.land/x/djwt@v2.8/mod.ts";

// --- Helper to get required environment variables ---
function getEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    console.error(`Error: Environment variable ${key} is not set.`);
    throw new Error(`Server configuration error: Missing ${key}`);
  }
  return value;
}

// --- GitHub App Authentication ---
async function getInstallationToken(appId: string, installationId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + (10 * 60);
  const payload = { iat: now - 60, exp: expiration, iss: appId };
  let privateKey: CryptoKey;
  try {
    // Use the key directly from env var, assuming Deno Deploy handles newlines correctly
    privateKey = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch (e) {
    console.error("Error importing private key:", e);
    let errMsg = "Failed to import GitHub App private key.";
    if (e instanceof Error && (e.message.includes("ASN.1") || e.message.includes("decode base64"))) { // Check for common errors
        errMsg += " Ensure the key is in correct PKCS8 PEM format and newlines are preserved correctly in the environment variable. Check for extra whitespace.";
    } else if (e instanceof Error) {
        errMsg += ` (${e.message})`;
    }
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

// Helper to convert PEM key to ArrayBuffer - More robust handling
function pemToArrayBuffer(pem: string): ArrayBuffer {
    // 1. Replace literal '\n' if present (e.g., from single-line env var)
    // 2. Remove header/footer
    // 3. Remove ALL whitespace (including actual newlines)
    const base64 = pem
        .replace(/\\n/g, "\n") // Ensure actual newlines first
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s/g, ""); // Remove ALL whitespace (newlines, spaces, etc.)
    try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
        return bytes.buffer;
    } catch (e) {
        console.error("Failed to decode base64 content of the private key.", e);
        throw new Error("Failed to decode base64 content of the private key. Ensure the key content is valid.");
    }
}
// --- End GitHub App Authentication ---


// --- Main Request Handler ---
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  console.log(`Request: ${req.method} ${pathname}`);

  // --- CORS Headers ---
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // --- API Endpoint: Trigger Workflow ---
  if (pathname === "/api/trigger-workflow" && req.method === "POST") {
    // Get App Config from Environment
    let appId: string, installationId: string, privateKey: string, owner: string, repo: string, workflowId: string;
    try {
      appId = getEnv("GITHUB_APP_ID");
      installationId = getEnv("GITHUB_APP_INSTALLATION_ID");
      privateKey = getEnv("GITHUB_APP_PRIVATE_KEY");
      owner = getEnv("GITHUB_OWNER");
      repo = getEnv("GITHUB_REPO");
      workflowId = getEnv("WORKFLOW_ID");
    } catch (error) {
      return new Response(JSON.stringify({ message: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse Request Body
    let inputs: Record<string, string>;
    try {
      const requestData = await req.json();
      if (!requestData || typeof requestData !== 'object') throw new Error("Invalid request body.");
      inputs = {
          origins: requestData.origin || "", destinations: requestData.destination || "",
          start_dates: requestData.startDate || "", end_dates: requestData.endDate || "",
          ticket_prices: requestData.price || "0",
      };
       if (!inputs.origins || !inputs.destinations || !inputs.start_dates) throw new Error("Missing required fields.");
    } catch (error) {
      return new Response(JSON.stringify({ message: `Bad Request: ${error.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Trigger Workflow
    try {
      console.log("Generating installation token...");
      const installationToken = await getInstallationToken(appId, installationId, privateKey);
      const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
      const body = JSON.stringify({ ref: "main", inputs: inputs });
      console.log(`Triggering workflow ${workflowId}...`);
      const response = await fetch(dispatchUrl, { method: "POST", headers: { Authorization: `token ${installationToken}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" }, body: body });
      if (!response.ok) { let err = `GitHub API Error: ${response.status}`; try { const ghErr = await response.json(); err += `: ${ghErr.message || JSON.stringify(ghErr)}`; } catch(e){} console.error(err); throw new Error(err); }
      console.log(`Workflow dispatch successful (Status: ${response.status})`);
      return new Response(JSON.stringify({ message: "Workflow triggered successfully!" }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
      console.error("Error triggering workflow:", error);
      return new Response(JSON.stringify({ message: `Failed to trigger workflow: ${error.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
  // --- End API Endpoint ---

  // --- Static File Serving ---
  try {
      const scriptDir = path.dirname(path.fromFileUrl(import.meta.url));
      const uiDir = path.join(scriptDir, "..", "ui");
      return await serveDir(req, { fsRoot: uiDir, urlRoot: "", showDirListing: false, quiet: true });
  } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
          console.log(`Static file not found for path: ${pathname}`);
          return new Response("Not Found", { status: 404, headers: corsHeaders });
      }
      console.error(`Error serving static file for path ${pathname}:`, error);
      return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
  }
  // --- End Static File Serving ---
}

// --- Start Deno Server ---
console.log("Proxy server with static UI listening on http://localhost:8000");
serve(handler);
