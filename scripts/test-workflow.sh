#!/bin/bash

# Script to automatically commit and push any file changes.

COMMIT_MESSAGE="${1:-Auto-commit changes}" # Use provided message or default

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

echo "Adding all changes to staging..."
git add .

# Check if there are any staged changes
if ! git diff --staged --quiet; then
    echo "Committing changes with message: '$COMMIT_MESSAGE'"
    git commit -m "$COMMIT_MESSAGE"

    echo "Pushing changes..."
    git push

    if [ $? -ne 0 ]; then
      echo "Push failed."
      exit 1
    else
      echo "Push completed successfully. Waiting for CI run..."
      sleep 15 # Wait for GitHub Actions to detect the push and start the run

      COMMIT_SHA=$(git rev-parse HEAD)
      TARGET_WORKFLOW="batch-travel-stipend.yml" # Specify the workflow file name
      echo "Fetching latest '$TARGET_WORKFLOW' run for commit $COMMIT_SHA..."

      # Fetch the latest run ID for the specific workflow associated with the commit SHA
      RUN_ID=$(gh run list --workflow "$TARGET_WORKFLOW" --commit "$COMMIT_SHA" --limit 1 --json databaseId --jq '.[0].databaseId')

      if [ -z "$RUN_ID" ] || [ "$RUN_ID" == "null" ]; then
          echo "Could not find a recent run ID for workflow '$TARGET_WORKFLOW' on commit '$COMMIT_SHA'."
          echo "Please check GitHub Actions manually."
          # Don't exit, as the push itself was successful
      else
          echo "Watching run ID: $RUN_ID"
          gh run watch "$RUN_ID" --exit-status
          WATCH_EXIT_CODE=$? # Capture the exit code of gh run watch

          if [ $WATCH_EXIT_CODE -ne 0 ]; then
            echo "Workflow run failed. Fetching logs for failed jobs..."
            gh run view "$RUN_ID" --log-failed
            # Optionally exit here if a failed CI run should stop the script
            # exit 1
          else
            echo "Workflow run completed successfully."
          fi
      fi
    fi
else
    echo "No changes detected. Nothing to commit or push."
fi

echo "Script finished."
