#!/bin/bash

# Script to deploy the Deno proxy function using deployctl
# Assumes:
# 1. deployctl is installed (deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts)
# 2. Environment variables DENO_DEPLOY_TOKEN and DENO_DEPLOY_PROJECT are set.
# 3. The Deno Deploy project exists and secrets (GITHUB_APP_*) are already configured via the dashboard.

set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
ENTRY_POINT="api/trigger-workflow.ts"
# Read project name from environment variable, fallback to a default if needed
DENO_PROJECT_NAME="${DENO_DEPLOY_PROJECT:-your-deno-project-name}" # Replace default if desired

# --- Check Prerequisites ---
if ! command -v deployctl &> /dev/null
then
    echo "Error: deployctl command could not be found."
    echo "Please install it using: deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts"
    exit 1
fi

if [ -z "$DENO_DEPLOY_TOKEN" ]; then
    echo "Error: DENO_DEPLOY_TOKEN environment variable is not set."
    echo "Please create an access token at https://dash.deno.com/account#access-tokens and set the variable."
    exit 1
fi

if [ "$DENO_PROJECT_NAME" == "your-deno-project-name" ]; then
     echo "Warning: DENO_DEPLOY_PROJECT environment variable not set, using default placeholder."
     echo "Deployment might fail or target the wrong project."
     # Optionally exit here if project name is mandatory:
     # echo "Error: DENO_DEPLOY_PROJECT environment variable must be set."
     # exit 1
fi

echo "Deploying $ENTRY_POINT to Deno Deploy project '$DENO_PROJECT_NAME'..."

# --- Run Deployment ---
# The --prod flag deploys to the production deployment. Remove it for preview deployments.
# --no-static prevents deployctl from uploading static assets from the root, which we don't need for the API.
# Link project to GitHub repo via Deno Deploy dashboard for automatic builds on push, or add --include/--exclude flags here if needed.
deployctl deploy --project="$DENO_PROJECT_NAME" --prod --no-static "$ENTRY_POINT"

echo "Deployment command executed."
echo "Check the Deno Deploy dashboard for status: https://dash.deno.com/projects/$DENO_PROJECT_NAME"
