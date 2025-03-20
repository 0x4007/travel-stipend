#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';

// Function to remove JSDoc comments from a string
function removeJSDocComments(content: string): string {
  // Regex to match JSDoc comments (/** ... */)
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;

  // Replace JSDoc comments with empty string
  return content.replace(jsdocRegex, '');
}

// Get the file path from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Error: Please provide a file path');
  console.error('Usage: bun scripts/remove-jsdoc-from-file.ts <file-path>');
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), args[0]);

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Check if it's a file (not a directory)
if (!fs.statSync(filePath).isFile()) {
  console.error(`Error: ${filePath} is not a file`);
  console.error('To process a directory, use: bun scripts/remove-jsdoc-direct.ts <directory-path>');
  process.exit(1);
}

// Check if it's a TypeScript file
const ext = path.extname(filePath).toLowerCase();
if (ext !== '.ts' && ext !== '.tsx') {
  console.error(`Error: ${filePath} is not a TypeScript file (.ts or .tsx)`);
  process.exit(1);
}

console.log(`Processing file: ${filePath}`);

try {
  // Read the file content
  const content = fs.readFileSync(filePath, 'utf-8');

  // Remove JSDoc comments
  const processedContent = removeJSDocComments(content);

  // Check if any changes were made
  if (content !== processedContent) {
    // Write the processed content back to the file
    fs.writeFileSync(filePath, processedContent);
    console.log(`✓ JSDoc comments removed from ${filePath}`);
  } else {
    console.log(`✓ No JSDoc comments found in ${filePath}`);
  }
} catch (error) {
  console.error(`✗ Error processing file: ${error}`);
  process.exit(1);
}
