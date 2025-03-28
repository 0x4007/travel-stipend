#!/usr/bin/env bun

import { argv } from 'node:process';

interface StipendParameters {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  price: number;
}

async function readInputFile(filename: string): Promise<string[]> {
  try {
    const file = Bun.file(filename);
    if (!await file.exists()) {
      throw new Error(`File ${filename} does not exist`);
    }

    console.error(`Reading ${filename}...`);
    const content = await file.text();
    // Split by both newlines and commas
    const items = content
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(Boolean);

    console.error(`Found ${items.length} entries in ${filename}`);

    if (items.length === 0) {
      throw new Error(`${filename} is empty`);
    }

    return items;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    throw error;
  }
}

interface TestEvent {
  name: string;
  origin: string;
  destination: string;
  start: string;
  end: string;
  price: number;
}

async function readTestEventsFile(filename: string): Promise<TestEvent[]> {
  try {
    const file = Bun.file(filename);
    if (!await file.exists()) {
      throw new Error(`Test events file ${filename} does not exist`);
    }
    console.error(`Reading test events file ${filename}...`);
    const content = await file.json();
    if (!Array.isArray(content)) {
      throw new Error(`Test events file ${filename} does not contain a valid JSON array`);
    }
    // Basic validation for expected properties
    content.forEach((event, index) => {
      if (
        typeof event.origin !== 'string' ||
        typeof event.destination !== 'string' ||
        typeof event.start !== 'string' ||
        typeof event.end !== 'string' ||
        typeof event.price !== 'number'
      ) {
        throw new Error(`Invalid structure in test event at index ${index} in ${filename}`);
      }
    });
    console.error(`Found ${content.length} events in ${filename}`);
    return content as TestEvent[];
  } catch (error) {
    console.error(`Error reading test events file ${filename}:`, error);
    throw error;
  }
}

async function generateMatrix() {
  try {
    let parameters: StipendParameters[] = [];
    const testEventsArgIndex = argv.indexOf('--test-events');
    let testEventsFile: string | null = null;

    if (testEventsArgIndex !== -1 && argv.length > testEventsArgIndex + 1) {
      testEventsFile = argv[testEventsArgIndex + 1];
      console.error(`Using test events file: ${testEventsFile}`);
      const testEvents = await readTestEventsFile(testEventsFile);
      parameters = testEvents.map(event => ({
        origin: event.origin,
        destination: event.destination,
        startDate: event.start,
        endDate: event.end,
        price: event.price
      }));
    } else {
      console.error('Reading input from .txt files...');
      // Read input files with validation
      const [origins, destinations, startDates, endDates, priceStrings] = await Promise.all([
        readInputFile('origins.txt'),
        readInputFile('destinations.txt'),
        readInputFile('start_dates.txt'),
        readInputFile('end_dates.txt').catch(() => []), // Optional
        readInputFile('ticket_prices.txt').catch(() => []) // Optional
      ]);

      const prices = priceStrings.map(p => {
        const num = Number(p);
        if (isNaN(num)) {
          throw new Error(`Invalid price value: ${p}`);
        }
        return num;
      });

      console.error('\nValidating input lengths...');
      const maxLength = Math.max(origins.length, destinations.length, startDates.length);
      console.error(`Will generate ${maxLength} combinations`);

      // Generate combinations matching index positions
      for (let i = 0; i < maxLength; i++) {
        parameters.push({
          origin: origins[i] || origins[0],
          destination: destinations[i] || destinations[0],
          startDate: startDates[i] || startDates[0],
          endDate: endDates[i] || startDates[i] || startDates[0],
          price: prices[i] || 0
        });
      }
    }

    if (parameters.length === 0) {
      throw new Error('No parameters were generated');
    }

    console.error(`\nSuccessfully generated matrix with ${parameters.length} combinations`);

    // Only output the properly formatted JSON matrix to stdout
    const matrix = {
      include: parameters.map(p => ({
        origin: p.origin,
        destination: p.destination,
        startDate: p.startDate,
        endDate: p.endDate,
        price: p.price
      }))
    };
    // Output clean JSON to stdout, no formatting for GitHub Actions
    console.log(JSON.stringify(matrix));
  } catch (error) {
    console.error('\nError generating matrix:', error);
    process.exit(1);
  }
}

generateMatrix().catch(console.error);
