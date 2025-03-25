import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Conference, Coordinates } from '../types';

export interface AirportCode {
  code: string;
  city: string;
  country: string;
  coordinates: string;
  elevation_ft: number | null;
  continent: string | null;
  region: string | null;
  municipality: string | null;
  icao: string | null;
  local_code: string | null;
}

interface CostOfLiving {
  city: string;
  cost_index: number | null;
}

interface TaxiRates {
  city: string;
  base_fare: number;
  per_km_rate: number;
  typical_trip_km: number;
}

interface CsvRow {
  [key: string]: string;
}

export class DatabaseService {
  private static _instance: DatabaseService;
  private _db: Database | undefined;
  private _initialized = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService._instance) {
      DatabaseService._instance = new DatabaseService();
    }
    return DatabaseService._instance;
  }

  private async _init(): Promise<void> {
    if (this._initialized) return;

    try {
      console.log('Initializing database...');

      // Create database directory if it doesn't exist
      const dbDir = path.join(process.cwd(), 'db');
      if (!fs.existsSync(dbDir)) {
        console.log('Creating database directory:', dbDir);
        fs.mkdirSync(dbDir);
      }

      // Use the existing database file in the db directory if it exists
      const dbPath = path.join(dbDir, 'travel-stipend.db');

      // Check if database file exists and has content
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        if (stats.size > 0) {
          console.log(`Found existing database (${stats.size} bytes): ${dbPath}`);
        } else {
          console.log(`Database file exists but is empty (${stats.size} bytes): ${dbPath}`);
        }
      } else {
        console.log(`Creating new database file: ${dbPath}`);
      }

      // Open database connection
      console.log('Opening database connection...');
      this._db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      console.log('Enabling foreign keys...');
      await this._db.run('PRAGMA foreign_keys = ON');

      // Create tables
      console.log('Creating tables...');
      await this._createTables();

      // Import data if tables are empty
      console.log('Importing data if needed...');
      await this._importDataIfNeeded();

      this._initialized = true;
      console.log('Database initialization complete.');
    } catch (error) {
      console.error('Error during database initialization:', error);
      throw error;
    }
  }

  private async _createTables(): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    try {
      await this._db.exec(`
        CREATE TABLE IF NOT EXISTS airport_codes (
          code TEXT PRIMARY KEY,
          city TEXT NOT NULL,
          country TEXT NOT NULL,
          coordinates TEXT NOT NULL,
          elevation_ft INTEGER,
          continent TEXT,
          region TEXT,
          municipality TEXT,
          icao TEXT,
          local_code TEXT
        );

        CREATE TABLE IF NOT EXISTS conferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          conference TEXT NOT NULL,
          location TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS coordinates (
          city TEXT PRIMARY KEY,
          lat REAL NOT NULL,
          lng REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cost_of_living (
          city TEXT PRIMARY KEY,
          cost_index REAL
        );

        CREATE TABLE IF NOT EXISTS taxis (
          city TEXT PRIMARY KEY,
          base_fare REAL NOT NULL,
          per_km_rate REAL NOT NULL,
          typical_trip_km REAL NOT NULL
        );
      `);
      console.log('Tables created successfully.');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  private _parseCsv(filePath: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
      const results: CsvRow[] = [];
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          console.log(`Imported ${results.length} rows`);
          resolve(results);
        })
        .on('error', (error) => reject(error));
    });
  }

  private async _importAirportCodes(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    // Create city-coordinates mapping first
    const cityCoords = new Map<string, string>();
    rows.forEach(row => {
      if (row.municipality && row.coordinates) {
        const cityKey = this._formatCityKey(row.municipality, row.iso_country);
        // Only update if we don't have coordinates for this city yet
        if (!cityCoords.has(cityKey)) {
          cityCoords.set(cityKey, row.coordinates);
        }
      }
    });

    const values = rows.map(row => {
      const code = row.iata_code || row.ident || '';
      const city = row.municipality || '';
      const country = row.iso_country || '';
      const coordinates = row.coordinates || '';

      return {
        code,
        city,
        country,
        coordinates,
        elevation_ft: row.elevation_ft ? parseInt(row.elevation_ft) : null,
        continent: row.continent || null,
        region: row.iso_region || null,
        municipality: row.municipality || null,
        icao: row.icao_code || null,
        local_code: row.local_code || null
      };
    }).filter(v => v.code && v.city && v.country && v.coordinates);

    // Add all city-coordinate pairs to coordinates table
    try {
      console.log('Importing city coordinates...');
      await this._db.run('BEGIN TRANSACTION');
      for (const [cityKey, coords] of cityCoords.entries()) {
        const [lat, lng] = coords.split(',').map(x => x.trim());
        try {
          await this._db.run(
            `INSERT OR REPLACE INTO coordinates (city, lat, lng)
             VALUES (?, ?, ?)`,
            [cityKey, parseFloat(lat), parseFloat(lng)]
          );
        } catch (error) {
          console.error('Error inserting city coordinates:', error);
          console.error('City:', cityKey, 'Coords:', coords);
        }
      }
      await this._db.run('COMMIT');
      console.log('Imported', cityCoords.size, 'city coordinates');
    } catch (error) {
      await this._db.run('ROLLBACK');
      throw error;
    }

    try {
      console.log('Importing airport codes, filtered values:', values.length);
      await this._db.run('BEGIN TRANSACTION');
      for (const value of values) {
        try {
          await this._db.run(
            `INSERT OR REPLACE INTO airport_codes
             (code, city, country, coordinates, elevation_ft, continent, region, municipality, icao, local_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              value.code, value.city, value.country, value.coordinates,
              value.elevation_ft, value.continent, value.region,
              value.municipality, value.icao, value.local_code
            ]
          );
        } catch (error) {
          console.error('Error inserting airport code:', error);
          console.error('Value:', value);
        }
      }
      await this._db.run('COMMIT');
      console.log('Airport codes import completed');
    } catch (error) {
      await this._db.run('ROLLBACK');
      throw error;
    }
  }

  private async _importConferences(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    const values = rows.map(row => ({
      category: row.Category || row.category || '',
      conference: row.Name || row.name || row.Conference || row.conference || '',
      location: row.Location || row.location || ''
    })).filter(v => v.category && v.conference && v.location);

    try {
      await this._db.run('BEGIN TRANSACTION');
      for (const value of values) {
        await this._db.run(
          `INSERT OR REPLACE INTO conferences (category, conference, location)
           VALUES (?, ?, ?)`,
          [value.category, value.conference, value.location]
        );
      }
      await this._db.run('COMMIT');
    } catch (error) {
      await this._db.run('ROLLBACK');
      throw error;
    }
  }

  private async _importCostOfLiving(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    const values = rows.map(row => {
      const location = row.Location || '';
      const city = location.split(',')[0].trim();
      const costIndex = row.Index || '';

      return {
        city,
        cost_index: costIndex && !isNaN(parseFloat(costIndex))
          ? parseFloat(costIndex)
          : null
      };
    }).filter(v => v.city);

    try {
      console.log('Importing cost of living, filtered values:', values.length);
      await this._db.run('BEGIN TRANSACTION');
      for (const value of values) {
        try {
          await this._db.run(
            `INSERT OR REPLACE INTO cost_of_living (city, cost_index)
             VALUES (?, ?)`,
            [value.city, value.cost_index]
          );
        } catch (error) {
          console.error('Error inserting cost of living:', error);
          console.error('Value:', value);
        }
      }
      await this._db.run('COMMIT');
      console.log('Cost of living import completed');
    } catch (error) {
      await this._db.run('ROLLBACK');
      throw error;
    }
  }

  private async _importTaxis(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    const values = rows.map(row => {
      const country = row.Country || '';
      const baseFare = parseFloat(row['Start Price (USD)'] || '0');
      const perKmRate = parseFloat(row['Price per km (USD)'] || '0');

      return {
        city: country, // Using country as city for now
        base_fare: baseFare,
        per_km_rate: perKmRate,
        typical_trip_km: 10 // Default value
      };
    }).filter(v => v.city && !isNaN(v.base_fare) && !isNaN(v.per_km_rate));

    try {
      console.log('Importing taxi rates, filtered values:', values.length);
      await this._db.run('BEGIN TRANSACTION');
      for (const value of values) {
        try {
          await this._db.run(
            `INSERT OR REPLACE INTO taxis
             (city, base_fare, per_km_rate, typical_trip_km)
             VALUES (?, ?, ?, ?)`,
            [value.city, value.base_fare, value.per_km_rate, value.typical_trip_km]
          );
        } catch (error) {
          console.error('Error inserting taxi rates:', error);
          console.error('Value:', value);
        }
      }
      await this._db.run('COMMIT');
      console.log('Taxi rates import completed');
    } catch (error) {
      await this._db.run('ROLLBACK');
      throw error;
    }
  }

  private async _importCsvToTable(table: string): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    try {
      const filename = table === 'cost_of_living' ? 'cost_of_living.csv' : `${table.replace('_', '-')}.csv`;

      // Try all possible locations for the CSV files
      const possiblePaths = [
        path.join(process.cwd(), 'fixtures', filename),      // /Users/nv/repos/0x4007/travel-stipend/fixtures/
        path.join(process.cwd(), 'fixtures', 'csv', filename),
        path.join(process.cwd(), filename),
        path.join('/Users/nv/fixtures', filename),
        path.join('/Users/nv/repos/0x4007/travel-stipend/fixtures', filename)
      ];

      // Verbose logging to debug path issues
      console.log(`Looking for ${filename} in:`);
      possiblePaths.forEach(p => console.log(` - ${p} (exists: ${fs.existsSync(p)})`));

      // Find the first path that exists
      let csvPath: string | undefined;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          csvPath = p;
          console.log(`Found ${filename} at: ${p}`);
          break;
        }
      }

      // If we couldn't find the file, handle appropriately
      if (!csvPath) {
        // Add some seed data for missing coordinates
        if (table === 'coordinates') {
          await this._addSeedCoordinates();
          return;
        }

        // For other tables, print warning but don't fail
        console.log(`CSV file not found in any location: ${filename}`);
        console.log(`WARNING: Database table ${table} will remain empty!`);
        return;
      }

      console.log(`Processing ${csvPath}`);
      const rows = await this._parseCsv(csvPath);

      switch (table) {
        case 'airport_codes':
          await this._importAirportCodes(rows);
          break;
        case 'conferences':
          await this._importConferences(rows);
          break;
        case 'cost_of_living':
          await this._importCostOfLiving(rows);
          break;
        case 'taxis':
          await this._importTaxis(rows);
          break;
        default:
          console.log(`No import handler for table: ${table}`);
      }
    } catch (error) {
      console.error(`Error importing data for table ${table}:`, error);
      throw error;
    }
  }

  private async _addSeedCoordinates(): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    const seedData = [
      // Common destinations
      { city: 'Seoul, KR', lat: 37.5665, lng: 126.9780 },
      { city: 'Dubai, AE', lat: 25.2048, lng: 55.2708 },
      { city: 'Singapore, SG', lat: 1.3521, lng: 103.8198 },
      { city: 'Tokyo, JP', lat: 35.6762, lng: 139.6503 },
      { city: 'London, GB', lat: 51.5074, lng: -0.1278 },
      { city: 'New York, US', lat: 40.7128, lng: -74.0060 },
      { city: 'San Francisco, US', lat: 37.7749, lng: -122.4194 },
      { city: 'Berlin, DE', lat: 52.5200, lng: 13.4050 },

      // Variations for common cities (no country code)
      { city: 'Dubai', lat: 25.2048, lng: 55.2708 },
      { city: 'Singapore', lat: 1.3521, lng: 103.8198 },
      { city: 'Seoul', lat: 37.5665, lng: 126.9780 },
      { city: 'Tokyo', lat: 35.6762, lng: 139.6503 },
      { city: 'London', lat: 51.5074, lng: -0.1278 },
      { city: 'New York', lat: 40.7128, lng: -74.0060 },
      { city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      { city: 'Berlin', lat: 52.5200, lng: 13.4050 },

      // More international cities
      { city: 'Paris, FR', lat: 48.8566, lng: 2.3522 },
      { city: 'Hong Kong, HK', lat: 22.3193, lng: 114.1694 },
      { city: 'Bangkok, TH', lat: 13.7563, lng: 100.5018 },
      { city: 'Sydney, AU', lat: 33.8688, lng: 151.2093 },
      { city: 'Amsterdam, NL', lat: 52.3676, lng: 4.9041 },
      { city: 'Barcelona, ES', lat: 41.3851, lng: 2.1734 },
      { city: 'Madrid, ES', lat: 40.4168, lng: -3.7038 },
      { city: 'Rome, IT', lat: 41.9028, lng: 12.4964 },
      { city: 'Vienna, AT', lat: 48.2082, lng: 16.3738 },
      { city: 'Istanbul, TR', lat: 41.0082, lng: 28.9784 },
      { city: 'Mumbai, IN', lat: 19.0760, lng: 72.8777 },
      { city: 'Shanghai, CN', lat: 31.2304, lng: 121.4737 },
      { city: 'Beijing, CN', lat: 39.9042, lng: 116.4074 },

      // With variations
      { city: 'Paris', lat: 48.8566, lng: 2.3522 },
      { city: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
      { city: 'Bangkok', lat: 13.7563, lng: 100.5018 },
      { city: 'Sydney', lat: 33.8688, lng: 151.2093 }
    ];

    try {
      await this._db.run('BEGIN TRANSACTION');
      for (const item of seedData) {
        await this._db.run(
          'INSERT OR REPLACE INTO coordinates (city, lat, lng) VALUES (?, ?, ?)',
          [item.city, item.lat, item.lng]
        );
      }
      await this._db.run('COMMIT');
      console.log('Added seed coordinates data');
    } catch (error) {
      await this._db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get the size of the database file in bytes
   */
  private _getDatabaseSize(): number {
    const dbPath = path.join(process.cwd(), 'db', 'travel-stipend.db');

    if (!fs.existsSync(dbPath)) {
      return 0;
    }

    try {
      const stats = fs.statSync(dbPath);
      return stats.size;
    } catch (error) {
      console.error('Error getting database file size:', error);
      return 0;
    }
  }

  private async _importDataIfNeeded(): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    // First check if we have a substantial database file already
    const dbSize = this._getDatabaseSize();
    if (dbSize > 100000) { // If DB is larger than ~100KB, assume it's already populated
      console.log(`Database size is ${dbSize} bytes, which indicates data is already present.`);
      console.log('Skipping data import phase for performance reasons.');
      return;
    }

    // Start by checking if any tables are populated
    const tables = ['coordinates', 'airport_codes', 'conferences', 'cost_of_living', 'taxis'];
    let hasAllTablesPopulated = true;

    // First phase: just check table counts
    console.log('Checking if tables have data...');
    for (const table of tables) {
      try {
        const count = await this._db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`Table ${table} has ${count?.count} records`);

        if (count?.count === 0) {
          hasAllTablesPopulated = false;
        }
      } catch (error) {
        console.error(`Error checking count for table ${table}:`, error);
        hasAllTablesPopulated = false;
      }
    }

    // If all tables have some data, skip the import
    if (hasAllTablesPopulated) {
      console.log('All tables already have data. Skipping import phase.');
      return;
    }

    // Second phase: import data for empty tables
    console.log('Starting data import for empty tables...');
    for (const table of tables) {
      try {
        console.log(`Checking table ${table} for import...`);
        const count = await this._db.get(`SELECT COUNT(*) as count FROM ${table}`);

        if (count?.count === 0) {
          console.log(`Importing data for empty table: ${table}`);
          await this._importCsvToTable(table);
        } else {
          console.log(`Table ${table} already has ${count?.count} records, skipping import`);
        }
      } catch (error) {
        console.error(`Error processing table ${table}:`, error);
        // Just log the error but continue with other tables
        console.log(`Continuing with next table due to error`);
      }
    }

    console.log('Data import process completed');
  }

  public async getConferences(): Promise<Conference[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.all<Conference[]>('SELECT * FROM conferences');
  }

  private _formatCityKey(city: string, country: string): string {
    // Standardize the format to "City, CC" where CC is the country code
    return `${city}, ${country}`;
  }

  public async getCityCoordinates(city: string): Promise<Coordinates[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    // First try exact match
    let results = await this._db.all<Coordinates[]>(
      'SELECT lat, lng FROM coordinates WHERE city = ?',
      [city]
    );

    if (results.length === 0) {
      // Try matching just the city part before the comma
      const cityPart = city.split(',')[0].trim();
      results = await this._db.all<Coordinates[]>(
        'SELECT lat, lng FROM coordinates WHERE city LIKE ?',
        [`${cityPart}%`]
      );
    }

    return results;
  }

  /**
   * Add coordinates for a city to the database
   * @param city Full city name (e.g. "City, Country")
   * @param lat Latitude
   * @param lng Longitude
   * @returns True if coordinates were added successfully
   */
  public async addCityCoordinates(city: string, lat: number, lng: number): Promise<boolean> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    try {
      await this._db.run(
        'INSERT OR REPLACE INTO coordinates (city, lat, lng) VALUES (?, ?, ?)',
        [city, lat, lng]
      );
      console.log(`Added/updated coordinates for ${city}: lat=${lat}, lng=${lng}`);
      return true;
    } catch (error) {
      console.error('Error adding city coordinates:', error);
      throw error;
    }
  }

  public async getAirportCodes(city: string): Promise<AirportCode[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.all<AirportCode[]>(
      'SELECT code, city, country, coordinates, elevation_ft, continent, region, municipality, icao, local_code FROM airport_codes WHERE city = ?',
      [city]
    );
  }

  /**
   * Get all airports from the database
   * @returns Array of all airports
   */
  public async getAllAirports(): Promise<AirportCode[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.all<AirportCode[]>(
      'SELECT code, city, country, coordinates, elevation_ft, continent, region, municipality, icao, local_code FROM airport_codes'
    );
  }

  /**
   * Get all city names from the coordinates table
   * @returns Array of city names
   */
  public async getAllCityNames(): Promise<string[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    const results = await this._db.all<{city: string}[]>('SELECT city FROM coordinates');
    return results.map(row => row.city);
  }

  public async validateCityAndCountry(city: string, country?: string): Promise<{ isValid: boolean; validCountry?: string; suggestions?: string[] }> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    const cityMatches = await this._db.all<{ city: string; country: string }[]>(
      'SELECT DISTINCT city, country FROM airport_codes WHERE city LIKE ?',
      [city]
    );

    if (cityMatches.length === 0) {
      // No matches found at all
      return { isValid: false };
    }

    if (!country) {
      // If no country specified, return true but include the valid country for reference
      return {
        isValid: true,
        validCountry: cityMatches[0].country,
        suggestions: cityMatches.map(m => `${m.city}, ${m.country}`)
      };
    }

    // Check if the city exists with the specified country
    const exactMatch = cityMatches.find(m =>
      m.country.toLowerCase() === country.toLowerCase()
    );

    if (exactMatch) {
      return {
        isValid: true,
        validCountry: exactMatch.country
      };
    }

    // No exact match, but we have other countries with this city name
    return {
      isValid: false,
      suggestions: cityMatches.map(m => `${m.city}, ${m.country}`)
    };
  }

  public async getCostOfLiving(city: string): Promise<CostOfLiving | undefined> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.get<CostOfLiving>(
      'SELECT city, cost_index FROM cost_of_living WHERE city = ?',
      [city]
    );
  }

  public async getTaxiRates(city: string): Promise<TaxiRates | undefined> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.get<TaxiRates>(
      'SELECT city, base_fare, per_km_rate, typical_trip_km FROM taxis WHERE city = ?',
      [city]
    );
  }

  public async close(): Promise<void> {
    if (this._db) {
      await this._db.close();
      this._initialized = false;
    }
  }
}
