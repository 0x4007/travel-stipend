import fs from 'fs';
import path from 'path';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Conference, Coordinates } from './types';

interface AirportCode {
  code: string;
  city: string;
  country: string;
  coordinates: string | null;
  elevation_ft: number | null;
  continent: string | null;
  region: string | null;
  municipality: string | null;
  icao: string | null;
  local_code: string | null;
}

interface CostOfLiving {
  city: string;
  cost_index: number;
}

interface TaxiRates {
  city: string;
  base_fare: number;
  per_km_rate: number;
  typical_trip_km: number;
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

  private async _init() {
    if (this._initialized) return;

    try {
      console.log('Initializing database...');

      // Create database directory if it doesn't exist
      const dbDir = path.join(process.cwd(), 'db');
      if (!fs.existsSync(dbDir)) {
        console.log('Creating database directory:', dbDir);
        fs.mkdirSync(dbDir);
      }

      // Open database
      console.log('Opening database connection...');
      this._db = await open({
        filename: path.join(dbDir, 'travel-stipend.db'),
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

  private async _createTables() {
    if (!this._db) throw new Error('Database not initialized');

    try {
      await this._db.exec(`
        CREATE TABLE IF NOT EXISTS airport_codes (
          code TEXT PRIMARY KEY,
          city TEXT NOT NULL,
          country TEXT NOT NULL,
          coordinates TEXT,
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
          start_date TEXT NOT NULL,
          end_date TEXT,
          conference TEXT NOT NULL,
          location TEXT NOT NULL,
          ticket_price TEXT,
          description TEXT
        );

        CREATE TABLE IF NOT EXISTS coordinates (
          city TEXT PRIMARY KEY,
          lat REAL NOT NULL,
          lng REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cost_of_living (
          city TEXT PRIMARY KEY,
          cost_index REAL NOT NULL
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

  private async _importCsvToTable(table: string) {
    if (!this._db) throw new Error('Database not initialized');

    try {
      // Handle special case for cost_of_living
      const filename = table === 'cost_of_living' ? 'cost_of_living.csv' : `${table.replace('_', '-')}.csv`;
      const csvPath = path.join(process.cwd(), 'fixtures', filename);
      console.log(`Processing ${csvPath}`);

      if (!fs.existsSync(csvPath)) {
        console.log(`CSV file not found: ${csvPath}`);
        return;
      }

      const data = fs.readFileSync(csvPath, 'utf-8');
      const lines = data.split('\n').filter(line => line.trim());

      // Define column mappings for each table
      const columnMappings: { [key: string]: { [key: string]: number } } = {
        airport_codes: {
          code: 9, // iata_code
          city: 2, // name (since municipality might be empty)
          country: 5, // iso_country
          coordinates: 12, // coordinates
          elevation_ft: 3, // elevation_ft
          continent: 4, // continent
          region: 6, // iso_region
          municipality: 7, // municipality
          icao: 8, // icao_code
          local_code: 11 // local_code
        },
        conferences: {
          category: 0, // Category
          start_date: 1, // Start
          end_date: 2, // End
          conference: 3, // Conference
          location: 4, // Location
          ticket_price: 5, // Ticket Price
          description: 6 // Description
        },
        cost_of_living: {
          city: 0, // Location (will be cleaned to remove country)
          cost_index: 1 // Index
        },
        taxis: {
          city: 0, // Country (used as city for now)
          base_fare: 1, // Start Price (USD)
          per_km_rate: 2 // Price per km (USD)
        }
      };

      const mapping = columnMappings[table];
      if (!mapping) {
        throw new Error(`No column mapping defined for table ${table}`);
      }

      const headers = Object.keys(mapping);
      console.log(`Using headers for ${table}: ${headers.join(', ')}`);

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        // Safely remove quotes by checking start and end characters directly
        const row = lines[i].split(',').map(v => {
          const trimmed = v.trim();
          return trimmed.startsWith('"') && trimmed.endsWith('"')
            ? trimmed.slice(1, -1)
            : trimmed;
        });

        const processValue = (header: string, rawValue: string): string => {
          // Always return string, handle type conversion separately during insert
          if (!rawValue) return '';

          switch (header) {
            case 'coordinates':
              return rawValue.split('').filter(c => c !== '(' && c !== ')').join('');
            case 'city':
              for (const country of ['Korea', 'China', 'USA', 'UK']) {
                if (rawValue.endsWith(` ${country}`)) {
                  return rawValue.slice(0, -country.length - 1);
                }
              }
              return rawValue;
            case 'ticket_price':
              return rawValue.split('').filter(c => c !== '$' && c !== ',').join('');
            default:
              return rawValue;
          }
        };

        const values = headers.map(header => processValue(header, row[mapping[header]]));

        if (values.every(v => v != null)) {
          const placeholders = values.map(() => '?').join(',');

          // Handle taxis table special case to add typical_trip_km
          if (table === 'taxis') {
            const defaultTripKm = 10; // Set a reasonable default trip distance
            const allHeaders = [...headers, 'typical_trip_km'];
            const allValues = [...values, defaultTripKm];
            const allPlaceholders = allValues.map(() => '?').join(',');

            console.log(`Inserting taxi row ${i} with default trip km: ${values.join(', ')}, ${defaultTripKm}`);
            await this._db.run(
              `INSERT OR REPLACE INTO ${table} (${allHeaders.join(',')}) VALUES (${allPlaceholders})`,
              allValues
            );
          } else {
            console.log(`Inserting row ${i}: ${values.join(', ')}`);
            await this._db.run(
              `INSERT OR REPLACE INTO ${table} (${headers.join(',')}) VALUES (${placeholders})`,
              values
            );
          }
        } else {
          console.log(`Skipping row ${i} due to missing required values`);
        }
      }
    } catch (error) {
      console.error(`Error importing data for table ${table}:`, error);
      throw error;
    }
  }

  private async _importDataIfNeeded() {
    if (!this._db) throw new Error('Database not initialized');

    const tables = ['airport_codes', 'conferences', 'coordinates', 'cost_of_living', 'taxis'];

    for (const table of tables) {
      try {
        console.log(`Checking table ${table}...`);
        const count = await this._db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`Current count for ${table}: ${count?.count}`);

        if (count?.count === 0) {
          console.log(`Importing data for empty table: ${table}`);
          await this._importCsvToTable(table);
        } else {
          console.log(`Table ${table} already has data, skipping import`);
        }
      } catch (error) {
        console.error(`Error processing table ${table}:`, error);
        throw error;
      }
    }
  }

  public async getConferences(): Promise<Conference[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.all<Conference[]>('SELECT * FROM conferences');
  }

  public async getCityCoordinates(city: string): Promise<Coordinates[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.all<Coordinates[]>(
      'SELECT lat, lng FROM coordinates WHERE city = ?',
      [city]
    );
  }

  public async getAirportCodes(city: string): Promise<AirportCode[]> {
    await this._init();
    if (!this._db) throw new Error('Database not initialized');

    return this._db.all<AirportCode[]>(
      'SELECT code, city, country, coordinates, elevation_ft, continent, region, municipality, icao, local_code FROM airport_codes WHERE city = ?',
      [city]
    );
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
