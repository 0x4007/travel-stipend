#!/usr/bin/env bun
import { build } from 'esbuild';
import { resolve } from 'path';
import { mkdir } from 'fs/promises';

async function buildAction() {
  try {
    // First ensure the output directory exists
    const outputDir = resolve(process.cwd(), '.github/actions/calculate-stipend');

    // Create directory structure recursively
    try {
      await mkdir(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    } catch (err) {
      console.error(`Failed to create directory: ${err}`);
      throw err;
    }

    // Build the action
    await build({
      entryPoints: [resolve(process.cwd(), 'src/github-action-handler.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: resolve(outputDir, 'index.js'),
      external: ['@actions/core', 'puppeteer-core'],
      sourcemap: true,
      format: 'esm',
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    // Create action.yml file
    const actionYml = `
name: 'Travel Stipend Calculator'
description: 'Calculate travel stipend for conference and business trips'
inputs:
  location:
    description: 'Destination location (e.g. "Singapore, SG")'
    required: true
  conference_start:
    description: 'Conference start date (e.g. "20 May 2025")'
    required: true
  conference_end:
    description: 'Conference end date'
    required: false
  conference_name:
    description: 'Conference name'
    required: false
  days_before:
    description: 'Days to arrive before conference'
    required: false
    default: '1'
  days_after:
    description: 'Days to leave after conference'
    required: false
    default: '1'
  ticket_price:
    description: 'Conference ticket price'
    required: false
outputs:
  stipend:
    description: 'Travel stipend calculation results'
runs:
  using: 'node20'
  main: 'index.js'
`.trim();

    // Write action.yml
    await Bun.write(resolve(outputDir, 'action.yml'), actionYml);

    // Write README
    const readmeContent = `
# Travel Stipend Calculator Action

This action calculates travel stipends for conferences and business trips.

## Features

- Calculates flight costs using Google Flights data
- Accounts for lodging costs with cost-of-living adjustments
- Includes meal and local transport allowances
- Enforces safe travel scheduling with buffer days
- Supports multi-day conferences

## Usage

\`\`\`yaml
- uses: org/travel-stipend-action@v1
  with:
    # Required: Destination location
    location: "Singapore, SG"

    # Required: Conference start date
    conference_start: "20 May 2025"

    # Optional: Conference end date (defaults to start date)
    conference_end: "22 May 2025"

    # Optional: Conference name
    conference_name: "TechConf 2025"

    # Optional: Buffer days for travel (defaults: 1 day before/after)
    days_before: 2
    days_after: 1

    # Optional: Conference ticket price
    ticket_price: 750
\`\`\`

## Outputs

- \`stipend\`: JSON object containing the complete stipend breakdown
`.trim();

    // Write README.md
    await Bun.write(resolve(outputDir, 'README.md'), readmeContent);

    console.log('GitHub Action built successfully in .github/actions/calculate-stipend/');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildAction().catch(error => {
  console.error('Failed to build action:', error);
  process.exit(1);
});
