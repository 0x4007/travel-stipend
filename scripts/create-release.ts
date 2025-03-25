#!/usr/bin/env bun
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { prompt } from "enquirer";

function runGitCommand(args: string[]): void {
  const gitBinary = process.env.GIT_BINARY ?? "git";
  const result = spawnSync(gitBinary, args, {
    stdio: "inherit",
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(`Git command failed: ${gitBinary} ${args.join(" ")}`);
  }
}

async function createRelease() {
  try {
    // Ensure we're in a clean git state
    const gitBinary = process.env.GIT_BINARY ?? "git";
    const status = spawnSync(gitBinary, ["status", "--porcelain"], {
      encoding: "utf-8",
      env: process.env,
    });

    if (status.error) {
      throw new Error(`Failed to check git status: ${status.error.message}`);
    }

    if (status.stdout?.trim()) {
      console.error("Working directory is not clean. Please commit or stash changes first.");
      process.exit(1);
    }

    // Read current version from package.json
    const pkgPath = resolve(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) {
      console.error("package.json not found");
      process.exit(1);
    }

    const pkg = await Bun.file(pkgPath).json();
    const currentVersion = pkg.version;
    console.log("Current version:", currentVersion);

    // Ask user what type of release this is
    const releaseType = await prompt<{ type: string }>({
      type: "select",
      name: "type",
      message: "What type of release is this?",
      choices: ["patch", "minor", "major"],
    });

    // Calculate new version
    const [major, minor, patch] = currentVersion.split(".").map(Number);
    let newVersion: string;

    switch (releaseType.type) {
      case "major":
        newVersion = `${major + 1}.0.0`;
        break;
      case "minor":
        newVersion = `${major}.${minor + 1}.0`;
        break;
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
    }

    // Confirm the version
    const { shouldProceed } = await prompt<{ shouldProceed: boolean }>({
      type: "confirm",
      name: "shouldProceed",
      message: `Create release v${newVersion}?`,
    });

    if (!shouldProceed) {
      console.log("Release cancelled");
      process.exit(0);
    }

    // Update package.json
    pkg.version = newVersion;
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`Updated package.json to version ${newVersion}`);

    // Create git tag
    const tag = `v${newVersion}`;

    try {
      // Stage, commit, and tag
      runGitCommand(["add", "package.json"]);
      runGitCommand(["commit", "-m", `Release ${tag}`]);
      runGitCommand(["tag", "-a", tag, "-m", `Release ${tag}`]);
      console.log(`Created git tag ${tag}`);

      // Push changes and tag
      console.log("Pushing changes and tag...");
      runGitCommand(["push", "origin", "main"]);
      runGitCommand(["push", "origin", tag]);
    } catch (error) {
      console.error("Git operation failed:", error);
      process.exit(1);
    }

    console.log(`
Release ${tag} created and pushed!
The release workflow will now:
1. Build the action
2. Create release notes from commits
3. Create a GitHub release
4. Upload the action files

You can monitor the progress at:
https://github.com/${process.env.GITHUB_REPOSITORY}/actions
    `);
  } catch (error) {
    console.error("Error creating release:", error);
    process.exit(1);
  }
}

createRelease().catch(console.error);
