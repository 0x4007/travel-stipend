#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';

// Function to remove JSDoc comments from a string
function removeJsDocComments(content: string): string {
  // Regex to match JSDoc comments (/** ... */)
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;

  // Replace JSDoc comments with empty string
  return content.replace(jsdocRegex, '');
}

// Function to process a single file
function processFile(filePath: string): void {
  console.log(`Processing file: ${filePath}`);

  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Remove JSDoc comments
    const processedContent = removeJsDocComments(content);

    // Check if any changes were made
    if (content !== processedContent) {
      // Write the processed content back to the file
      fs.writeFileSync(filePath, processedContent);
      console.log(`  ✓ JSDoc comments removed`);
    } else {
      console.log(`  ✓ No JSDoc comments found`);
    }
  } catch (error) {
    console.error(`  ✗ Error processing file: ${error}`);
  }
}

// Function to recursively process files in a directory
function processDirectory(dirPath: string, extensions: string[]): void {
  // Read the directory contents
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(entryPath, extensions);
    } else if (entry.isFile()) {
      // Check if the file has a matching extension
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        processFile(entryPath);
      }
    }
  }
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

  console.log(`\nProcessing TypeScript files in ${dir}...`);
  processDirectory(dirPath, extensions);
}

console.log('\nJSDoc comment removal complete!');
