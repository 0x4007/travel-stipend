// Deno Deploy / Serverless Function Example using GitHub App Auth
// Handles POST requests from the UI to trigger the GitHub Actions workflow

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// Import djwt for JWT generation - Ensure this URL is stable or use a pinned version
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
  const expiration = now + (10 * 60); // JWT valid for 10 minutes
  const payload = {
    iat: now - 60, // Issued 60 seconds ago
    exp: expiration,
    iss: appId,
  };

  // Import the private key
  let privateKey: CryptoKey;
  try {
      // Ensure PEM format has correct line breaks if stored as single line secret
      const pemFormatted = privateKeyPem.replace(/\\n/g, '\n');
      privateKey = await crypto.subtle.importKey(
          "pkcs8",
          pemToArrayBuffer(pemFormatted),
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["sign"]
      );
  } catch (e) {
      console.error("Error importing private key:", e);
      throw new Error("Failed to import GitHub App private key. Ensure it's in correct PKCS8 PEM format.");
  }


  // Create the JWT
  const jwt = await djwt.create({ alg: "RS256", typ: "JWT" }, payload, privateKey);

  // Request installation token
  const tokenUrl = `https://api.github.com/app/installations/${installationId}/access_tokens`;
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to get installation token: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    if (!data.token) {
        throw new Error("Installation token not found in GitHub API response.");
    }
    console.log("Successfully obtained GitHub App installation token.");
    return data.token;
  } catch (error) {
      console.error("Error fetching installation token:", error);
      throw error; // Re-throw after logging
  }
}

// Helper to convert PEM key to ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s/g, ""); // Remove whitespace and headers/footers
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
// --- End GitHub App Authentication ---


// --- Main Request Handler ---
async function handler(req: Request): Promise<Response> {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get App Config from Environment
  let appId: string;
  let installationId: string;
  let privateKey: string;
  let owner: string;
  let repo: string;
  let workflowId: string;
  try {
    appId = getEnv("GITHUB_APP_ID");
    installationId = getEnv("GITHUB_APP_INSTALLATION_ID");
    privateKey = getEnv("GITHUB_APP_PRIVATE_KEY");
    owner = getEnv("GITHUB_OWNER");
    repo = getEnv("GITHUB_REPO");
    workflowId = getEnv("WORKFLOW_ID");
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse Request Body
  let inputs: Record<string, string>;
  try {
    const requestData = await req.json();
    if (!requestData || typeof requestData !== 'object') throw new Error("Invalid request body.");
    inputs = {
        origins: requestData.origin || "",
        destinations: requestData.destination || "",
        start_dates: requestData.startDate || "",
        end_dates: requestData.endDate || "",
        ticket_prices: requestData.price || "0",
    };
     if (!inputs.origins || !inputs.destinations || !inputs.start_dates) {
        throw new Error("Missing required fields: origin, destination, startDate");
     }
  } catch (error) {
    return new Response(JSON.stringify({ message: `Bad Request: ${error.message}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Trigger Workflow
  try {
    console.log("Generating installation token...");
    const installationToken = await getInstallationToken(appId, installationId, privateKey);

    const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
    const body = JSON.stringify({ ref: "main", inputs: inputs });

    console.log(`Triggering workflow ${workflowId} with inputs:`, inputs);
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `token ${installationToken}`, // Use Installation Token
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: body,
    });

    if (!response.ok) {
      let errorDetails = `GitHub API responded with status ${response.status}`;
      try { const githubError = await response.json(); errorDetails += `: ${githubError.message || JSON.stringify(githubError)}`; } catch (e) { /* Ignore */ }
      console.error("GitHub API Error:", errorDetails);
      throw new Error(`Failed to trigger workflow. ${errorDetails}`);
    }

    console.log(`Workflow dispatch successful (Status: ${response.status})`);
    return new Response(JSON.stringify({ message: "Workflow triggered successfully!" }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error triggering workflow:", error);
    return new Response(JSON.stringify({ message: `Failed to trigger workflow: ${error.message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// --- Start Deno Server ---
console.log("Proxy server listening on http://localhost:8000");
serve(handler);
