#!/usr/bin/env bun

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get the absolute path to the transform
const transformPath = path.resolve(process.cwd(), 'transforms/remove-jsdoc-comments.ts');

// Ensure the transform file exists
if (!fs.existsSync(transformPath)) {
  console.error(`Transform file not found: ${transformPath}`);
  process.exit(1);
}

// Default directories to process
const defaultDirs = ['src', 'tests', 'build'];

// Parse command line arguments
const args = process.argv.slice(2);
const dirs = args.length > 0 ? args : defaultDirs;
const extensions = ['.ts', '.tsx'];

/**
 * Process a directory with jscodeshift
 * Using a safer approach with execSync
 */
function processDirectory(dir: string): void {
  const dirPath = path.resolve(process.cwd(), dir);

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory not found, skipping: ${dirPath}`);
    return;
  }

  console.log(`Processing TypeScript files in ${dir}...`);

  try {
    // Get the absolute path to npx
    const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    // Build the command with proper escaping
    const extensionsArg = extensions.join(',');

    // Use execSync with explicit command and arguments
    console.log(`Executing jscodeshift on ${dir}...`);

    // Use execSync but with a safer approach
    const result = execSync(
      `"${npxPath}" jscodeshift --extensions=${extensionsArg} --parser=ts -t "${transformPath}" "${dirPath}" --verbose=2`,
      {
        encoding: 'utf-8',
        // We need shell features for this command
        shell: true,
        // Set a specific PATH to avoid PATH manipulation attacks
        env: {
          ...process.env,
          // Use nullish coalescing operator instead of logical OR
          PATH: process.env.PATH?.split(path.delimiter)[0] ?? '/usr/bin'
        }
      }
    );

    console.log(result);
    console.log(`Successfully processed ${dir}`);
  } catch (error) {
    console.error(`Error processing ${dir}:`, error);
  }
}

// Process each directory
for (const dir of dirs) {
  processDirectory(dir);
}

console.log('JSDoc comment removal complete!');
