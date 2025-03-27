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
      echo "Push completed successfully."
    fi
else
    echo "No changes detected. Nothing to commit or push."
fi

echo "Script finished."
