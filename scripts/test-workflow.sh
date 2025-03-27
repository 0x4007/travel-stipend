#!/bin/bash

# Script to automatically commit, push, and watch changes to the batch travel stipend workflow.

WORKFLOW_FILE=".github/workflows/batch-travel-stipend.yml"
COMMIT_MESSAGE="${1:-Test workflow changes}" # Use provided message or default

# Check if gh is installed
if ! command -v gh &> /dev/null
then
    echo "GitHub CLI (gh) could not be found. Please install it: https://cli.github.com/"
    exit 1
fi

# Check if gh is authenticated
gh auth status &> /dev/null
if [ $? -ne 0 ]; then
    echo "GitHub CLI not authenticated. Please run 'gh auth login'."
    exit 1
fi


# Check if the workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

echo "Adding workflow file to staging..."
git add "$WORKFLOW_FILE"

# Check if there are staged changes for the workflow file
if ! git diff --staged --quiet -- "$WORKFLOW_FILE"; then
    echo "Committing changes with message: '$COMMIT_MESSAGE'"
    git commit -m "$COMMIT_MESSAGE"

    echo "Pushing changes..."
    git push

    echo "Waiting 10 seconds for the workflow to trigger on GitHub Actions..."
    sleep 10

    echo "Fetching the latest run ID for the workflow on branch '$CURRENT_BRANCH'..."
    # Extract the filename from the path for the gh command
    WORKFLOW_FILENAME=$(basename "$WORKFLOW_FILE")
    # Get current branch name
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

    # Fetch the latest run ID for the workflow on the current branch
    RUN_ID=$(gh run list --workflow "$WORKFLOW_FILENAME" --branch "$CURRENT_BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')

    if [ -z "$RUN_ID" ] || [ "$RUN_ID" == "null" ]; then
        echo "Could not find a recent run ID for workflow '$WORKFLOW_FILENAME' on branch '$CURRENT_BRANCH'."
        echo "Please check GitHub Actions manually."
        exit 1
    fi

    echo "Watching run ID: $RUN_ID"
    gh run watch "$RUN_ID" --exit-status

    if [ $? -ne 0 ]; then
      echo "Workflow run failed."
      exit 1
    else
      echo "Workflow run completed successfully."
    fi

else
    echo "No changes detected in $WORKFLOW_FILE. Nothing to commit or push."
fi

echo "Script finished."
