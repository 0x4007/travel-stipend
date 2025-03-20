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

// Process each directory
for (const dir of dirs) {
  const dirPath = path.resolve(process.cwd(), dir);

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory not found, skipping: ${dirPath}`);
    continue;
  }

  console.log(`Processing TypeScript files in ${dir}...`);

  try {
    // Run jscodeshift on the directory with verbose output
    const command = `npx jscodeshift --extensions=${extensions.join(',')} --parser=ts -t ${transformPath} ${dirPath} --verbose=2`;
    console.log(`Executing: ${command}`);

    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);
  } catch (error) {
    console.error(`Error processing ${dir}:`, error);
  }
}

console.log('JSDoc comment removal complete!');
