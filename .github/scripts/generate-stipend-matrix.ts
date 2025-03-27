#!/usr/bin/env bun

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

async function generateMatrix() {
  try {
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

    const parameters: StipendParameters[] = [];

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
