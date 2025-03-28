#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define the directory and pattern to watch
WORKFLOW_DIR=".github/workflows"
FILE_PATTERN="*.yml"
COMMIT_MESSAGE="Auto-commit workflow changes"

# Check if running inside a Git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "Error: Not inside a Git repository."
  exit 1
fi

echo "Checking for changes in $WORKFLOW_DIR/$FILE_PATTERN..."

# Use git status --porcelain to check for changes in the specific path
# It outputs lines like ' M .github/workflows/file.yml' for modified files
# or '?? .github/workflows/newfile.yml' for untracked files in that path.
if git status --porcelain "$WORKFLOW_DIR" | grep --quiet "$FILE_PATTERN"; then
  echo "Changes detected in workflow files. Staging, committing, and pushing..."

  # Add all changes (modified, new, deleted) within the workflows directory
  git add "$WORKFLOW_DIR"

  # Commit the changes
  echo "Committing changes..."
  git commit -m "$COMMIT_MESSAGE"

  # Push the changes to the remote repository (current branch to origin)
  echo "Pushing changes..."
  git push origin HEAD

  echo "Workflow changes successfully committed and pushed."
else
  echo "No changes detected in workflow files."
fi

exit 0
