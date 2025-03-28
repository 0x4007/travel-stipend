# Active Context: Travel Stipend Calculator

## Current Status

The project has undergone a significant architectural shift. The primary method for triggering calculations is now intended to be a static Web UI (`ui/`) that communicates with a serverless proxy function (`api/trigger-workflow.ts`). This proxy authenticates using a GitHub App and triggers the main calculation workflow (`batch-travel-stipend.yml`) via `workflow_dispatch`. The workflow then runs the calculations and posts the results back to the proxy, which relays them to the UI via WebSockets.

The CLI (`src/travel-stipend-cli.ts`) and direct GitHub Actions triggers (`push`, `workflow_dispatch` without UI) remain as alternative usage methods.

## Recent Work

Development has focused heavily on implementing and troubleshooting the new UI-driven workflow:

1.  **Web UI Implementation (`ui/`):**
    *   Created `index.html` with input form and status/results display areas.
    *   Added dark mode styling (`style.css`).
    *   Developed frontend logic (`script.ts`) to:
        *   Handle form submission.
        *   Establish WebSocket connection to the proxy.
        *   Send calculation requests with a unique client ID.
        *   Receive and display status updates and final results table via WebSocket messages.
    *   Added a build script (`build:ui`) to compile `script.ts` to `script.js`.

2.  **Proxy Function (`api/trigger-workflow.ts`):**
    *   Created a Deno function designed for serverless deployment (e.g., Deno Deploy).
    *   Serves the static UI files (`ui/index.html`, `ui/style.css`, `ui/script.js`).
    *   Manages WebSocket connections, mapping client IDs to sockets.
    *   Handles incoming WebSocket calculation requests:
        *   Authenticates with GitHub using GitHub App credentials (App ID, Installation ID, Private Key from env vars).
        *   Generates JWT and obtains installation token.
        *   Triggers the `batch-travel-stipend.yml` workflow via `workflow_dispatch`, passing trip details and `clientId`.
    *   Includes an HTTP endpoint (`/api/workflow-complete`) to receive results posted back from the completed GitHub Action.
    *   Authenticates the callback using a shared secret (`CALLBACK_SECRET`).
    *   Forwards results to the correct client via WebSocket.
    *   Created a Bun/Node-compatible version for local testing (`start:proxy` script).

3.  **GitHub Actions Workflow (`batch-travel-stipend.yml`):**
    *   Added `clientId` to `workflow_dispatch` inputs.
    *   Ensured unique filenames and artifact names using origin, destination, and job index to prevent overwrites/conflicts.
    *   Added a final step to the `consolidate` job to POST results back to the proxy's callback URL (`PROXY_CALLBACK_URL`), including the `clientId` and authenticating with `PROXY_CALLBACK_SECRET`.

4.  **Authentication:** Switched proxy authentication method from PAT to GitHub App. Added script (`convert-key-to-pkcs8.sh`) to help ensure correct private key format (PKCS#8).

5.  **Documentation (`README.md`, etc.):** Updated significantly to reflect the new architecture, GitHub App setup, deployment procedures for UI and proxy (especially Deno Deploy), environment variable requirements, and local testing steps.

6.  **Troubleshooting:** Addressed various issues related to GitHub Actions filename/artifact conflicts, Deno Deploy errors (private key import, `deployctl` installation), and UI functionality (page reloads, timeouts).

## Current Focus

The immediate focus is on ensuring the newly implemented UI -> Proxy -> Actions -> Proxy -> UI flow works reliably in a deployed environment. This includes:

1.  Verifying the Deno Deploy deployment of `api/trigger-workflow.ts`.
2.  Confirming the static UI deployment.
3.  Testing the end-to-end calculation trigger and result callback via WebSockets.
4.  Ensuring secure handling of credentials (GitHub App key, callback secret).

## Active Decisions

-   **Callback Payload:** Currently sending the full consolidated `results` array back. Consider if a different format or subset of data is more appropriate.
-   **Error Handling:** Refine error reporting back to the UI via WebSockets for both proxy errors and potential calculation errors reported by the Action callback.
-   **Local Testing Callback:** The current local testing setup notes that the GitHub Action runner might not be able to reach `localhost:8000` for the callback. Need to confirm if tools like `ngrok` are necessary or if alternative testing strategies exist.

## Known Issues

-   **Proxy Deployment:** Potential issues deploying `api/trigger-workflow.ts` related to environment variable handling (especially the multi-line private key) or Deno Deploy specifics.
-   **Callback Reliability:** Network issues could prevent the GitHub Action from successfully POSTing results back to the proxy. Need robust error handling/logging around the `curl` step in the workflow.
-   **WebSocket State:** The current server implementation has basic WebSocket connection management; more robust handling (e.g., heartbeats, reconnection logic) might be needed for production.
-   **Scraper Reliability:** The underlying issues with Google Flights UI changes potentially breaking the scraper still exist.

## Next Steps

1.  **Complete Deployment:** Ensure the static UI and Deno Deploy proxy function are correctly deployed and configured with all necessary environment variables/secrets.
2.  **End-to-End Test:** Thoroughly test the flow: submit via UI -> verify Action trigger -> verify Action completion -> verify callback to proxy -> verify results appear in UI.
3.  **Refine Error Handling:** Improve how errors from the GitHub API calls, workflow execution, or callback are communicated back to the user via the UI/WebSocket.
4.  **Update Documentation:** Finalize documentation based on successful deployment and testing.
5.  **(Future)** Address other known issues like currency conversion, city name matching, etc., as prioritized.
