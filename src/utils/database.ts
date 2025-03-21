import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Conference, Coordinates } from './types';

interface AirportCode {
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
      const csvPath = path.join(process.cwd(), 'fixtures', filename);

      if (!fs.existsSync(csvPath)) {
        console.log(`CSV file not found: ${csvPath}`);
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

  private async _importDataIfNeeded(): Promise<void> {
    if (!this._db) throw new Error('Database not initialized');

    const tables = ['airport_codes', 'conferences', 'cost_of_living', 'taxis'];

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
