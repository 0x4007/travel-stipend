import { parse } from "csv-parse";
import fs from "fs";
import path from "path";
import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import { Conference, } from "../types";

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
      console.log("Initializing database...");

      // Create database directory if it doesn't exist
      const dbDir = path.join(process.cwd(), "db");
      if (!fs.existsSync(dbDir)) {
        console.log("Creating database directory:", dbDir);
        fs.mkdirSync(dbDir);
      }

      // Use the existing database file in the db directory if it exists
      const dbPath = path.join(dbDir, "travel-stipend.db");

      // Open database connection
      console.log("Opening database connection...");
      this._db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      // Create tables
      console.log("Creating tables...");
      await this._createTables();

      // Import data if tables are empty
      console.log("Importing data if needed...");
      await this._importDataIfNeeded();

      this._initialized = true;
      console.log("Database initialization complete.");
    } catch (error) {
      console.error("Error during database initialization:", error);
      throw error;
    }
  }

  private async _createTables(): Promise<void> {
    if (!this._db) throw new Error("Database not initialized");

    try {
      await this._db.exec(`
        CREATE TABLE IF NOT EXISTS conferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          conference TEXT NOT NULL,
          location TEXT NOT NULL,
          start_date TEXT,
          end_date TEXT,
          description TEXT,
          buffer_days_before INTEGER DEFAULT 1,
          buffer_days_after INTEGER DEFAULT 1,
          ticket_price TEXT
        );

        -- Drop and recreate conferences table with new schema if needed
        DROP TABLE IF EXISTS conferences;
        CREATE TABLE conferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          conference TEXT NOT NULL,
          location TEXT NOT NULL,
          start_date TEXT,
          end_date TEXT,
          description TEXT,
          buffer_days_before INTEGER DEFAULT 1,
          buffer_days_after INTEGER DEFAULT 1,
          ticket_price TEXT,
          priority BOOLEAN DEFAULT FALSE,
          tentative BOOLEAN DEFAULT FALSE
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

        CREATE TABLE IF NOT EXISTS coordinates (
          city TEXT PRIMARY KEY,
          lat REAL NOT NULL,
          lng REAL NOT NULL
        );
      `);
      console.log("Tables created successfully.");
    } catch (error) {
      console.error("Error creating tables:", error);
      throw error;
    }
  }

  private _parseCsv(filePath: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
      const results: CsvRow[] = [];
      fs.createReadStream(filePath)
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
          })
        )
        .on("data", (data) => {
          results.push(data);
        })
        .on("end", () => {
          console.log(`Imported ${results.length} rows`);
          resolve(results);
        })
        .on("error", (error) => reject(error));
    });
  }

  private async _importConferences(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error("Database not initialized");

    const values = rows
      .map((row) => ({
        category: row.Category ?? "",
        conference: row.Conference ?? "",
        location: row.Location ?? "",
        start_date: row.Start ?? "",
        end_date: row.End ?? "",
        description: row.Description ?? "",
        buffer_days_before: parseInt(row.BufferDaysBefore ?? "1"),
        buffer_days_after: parseInt(row.BufferDaysAfter ?? "1"),
        ticket_price: row.TicketPrice ?? row["Ticket Price"] ?? "0",
        priority: row["❗️"]?.toLowerCase() === "true",
        tentative: row["❓"]?.toLowerCase() === "true"
      }))
      .filter((v) => v.category && v.conference && v.location);

    try {
      await this._db.run("BEGIN TRANSACTION");
      for (const value of values) {
        await this._db.run(
          `INSERT OR REPLACE INTO conferences (
            category, conference, location, start_date, end_date, description,
            buffer_days_before, buffer_days_after, ticket_price, priority, tentative
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            value.category, value.conference, value.location, value.start_date,
            value.end_date, value.description, value.buffer_days_before,
            value.buffer_days_after, value.ticket_price, value.priority, value.tentative
          ]
        );
      }
      await this._db.run("COMMIT");
    } catch (error) {
      await this._db.run("ROLLBACK");
      throw error;
    }
  }

  private async _importCostOfLiving(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error("Database not initialized");

    const values = rows
      .map((row) => {
        const location = row.Location ?? "";
        const city = location.split(",")[0].trim();
        const costIndexRaw = row.Index ?? "";
        const costIndex = costIndexRaw && !isNaN(parseFloat(costIndexRaw)) ? parseFloat(costIndexRaw) : null;

        return { city, cost_index: costIndex };
      })
      .filter((v) => v.city);

    try {
      console.log("Importing cost of living, filtered values:", values.length);
      await this._db.run("BEGIN TRANSACTION");
      for (const value of values) {
        try {
          await this._db.run(
            `INSERT OR REPLACE INTO cost_of_living (city, cost_index)
             VALUES (?, ?)`,
            [value.city, value.cost_index]
          );
        } catch (error) {
          console.error("Error inserting cost of living:", error);
          console.error("Value:", value);
        }
      }
      await this._db.run("COMMIT");
      console.log("Cost of living import completed");
    } catch (error) {
      await this._db.run("ROLLBACK");
      throw error;
    }
  }

  private async _importTaxis(rows: CsvRow[]): Promise<void> {
    if (!this._db) throw new Error("Database not initialized");

    const values = rows
      .map((row) => {
        const country = row.Country ?? "";
        const baseFareRaw = row["Start Price (USD)"] ?? "0";
        const perKmRateRaw = row["Price per km (USD)"] ?? "0";
        const baseFare = parseFloat(baseFareRaw);
        const perKmRate = parseFloat(perKmRateRaw);

        return {
          city: country, // Using country as city for now
          base_fare: baseFare,
          per_km_rate: perKmRate,
          typical_trip_km: 10, // Default value
        };
      })
      .filter((v) => v.city && !isNaN(v.base_fare) && !isNaN(v.per_km_rate));

    try {
      console.log("Importing taxi rates, filtered values:", values.length);
      await this._db.run("BEGIN TRANSACTION");
      for (const value of values) {
        try {
          await this._db.run(
            `INSERT OR REPLACE INTO taxis
             (city, base_fare, per_km_rate, typical_trip_km)
             VALUES (?, ?, ?, ?)`,
            [value.city, value.base_fare, value.per_km_rate, value.typical_trip_km]
          );
        } catch (error) {
          console.error("Error inserting taxi rates:", error);
          console.error("Value:", value);
        }
      }
      await this._db.run("COMMIT");
      console.log("Taxi rates import completed");
    } catch (error) {
      await this._db.run("ROLLBACK");
      throw error;
    }
  }

  private async _importCsvToTable(table: string): Promise<void> {
    if (!this._db) throw new Error("Database not initialized");

    try {
      const filename = table === "cost_of_living" ? "cost_of_living.csv" : `${table.replace("_", "-")}.csv`;

      // Try all possible locations for the CSV files
      const possiblePaths = [
        path.join(process.cwd(), "fixtures", filename),
        path.join(process.cwd(), "fixtures", "csv", filename),
        path.join(process.cwd(), filename),
        path.join("/Users/nv/repos/0x4007/travel-stipend/fixtures", filename),
      ];

      // Find the first path that exists
      let csvPath: string | undefined;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          csvPath = p;
          console.log(`Found ${filename} at: ${p}`);
          break;
        }
      }

      if (!csvPath) {
        console.log(`CSV file not found in any location: ${filename}`);
        console.log(`WARNING: Database table ${table} will remain empty!`);
        return;
      }

      console.log(`Processing ${csvPath}`);
      const rows = await this._parseCsv(csvPath);

      switch (table) {
        case "conferences":
          await this._importConferences(rows);
          break;
        case "cost_of_living":
          await this._importCostOfLiving(rows);
          break;
        case "taxis":
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
    if (!this._db) throw new Error("Database not initialized");

    // Check if tables need importing
    const tables = ["conferences", "cost_of_living", "taxis", "coordinates"];
    let hasAllTablesPopulated = true;

    // First phase: just check table counts
    console.log("Checking if tables have data...");
    for (const table of tables) {
      try {
        const result = await this._db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result?.count ?? 0;
        console.log(`Table ${table} has ${count} records`);

        if (count === 0) {
          hasAllTablesPopulated = false;
        }
      } catch (error) {
        console.error(`Error checking count for table ${table}:`, error);
        hasAllTablesPopulated = false;
      }
    }

    // If all tables have some data, skip the import
    if (hasAllTablesPopulated) {
      console.log("All tables already have data. Skipping import phase.");
      return;
    }

    // Second phase: import data for empty tables
    console.log("Starting data import for empty tables...");
    for (const table of tables) {
      try {
        console.log(`Checking table ${table} for import...`);
        const result = await this._db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result?.count ?? 0;

        if (count === 0) {
          console.log(`Importing data for empty table: ${table}`);
          await this._importCsvToTable(table);
        } else {
          console.log(`Table ${table} already has ${count} records, skipping import`);
        }
      } catch (error) {
        console.error(`Error processing table ${table}:`, error);
        // Just log the error but continue with other tables
        console.log(`Continuing with next table due to error`);
      }
    }

    console.log("Data import process completed");
  }

  public async getConferences(): Promise<Conference[]> {
    await this._init();
    if (!this._db) throw new Error("Database not initialized");

    return this._db.all<Conference[]>("SELECT * FROM conferences");
  }

  public async getCostOfLiving(city: string): Promise<number | null> {
    await this._init();
    if (!this._db) throw new Error("Database not initialized");

    const result = await this._db.get<{ cost_index: number | null }>("SELECT cost_index FROM cost_of_living WHERE city = ?", [city]);
    return result?.cost_index ?? null;
  }

  public async getTaxiRates(city: string): Promise<TaxiRates | undefined> {
    await this._init();
    if (!this._db) throw new Error("Database not initialized");

    return this._db.get<TaxiRates>("SELECT city, base_fare, per_km_rate, typical_trip_km FROM taxis WHERE city = ?", [city]);
  }



  public async addCityCoordinates(
    city: string,
    lat: number,
    lng: number
  ): Promise<boolean> {
    await this._init();
    if (!this._db) throw new Error("Database not initialized");

    try {
      await this._db.run(
        `INSERT OR REPLACE INTO coordinates (city, lat, lng)
         VALUES (?, ?, ?)`,
        [city, lat, lng]
      );
      return true;
    } catch (error) {
      console.error("Error adding city coordinates:", error);
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._db) {
      await this._db.close();
      this._initialized = false;
    }
  }
}
