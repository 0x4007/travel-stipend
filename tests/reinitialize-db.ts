import { DatabaseService } from "../src/utils/database";
import fs from "fs";
import path from "path";

async function reinitializeDatabase() {
  // Delete existing database file
  const dbPath = path.join(process.cwd(), "db", "travel-stipend.db");
  if (fs.existsSync(dbPath)) {
    console.log("Removing existing database...");
    fs.unlinkSync(dbPath);
    console.log("Database file removed.");
  } else {
    console.log("No existing database found, will create a new one.");
  }

  // Initialize database service (this will create new tables and import data)
  const db = DatabaseService.getInstance();

  // This will trigger the database initialization and data import
  await db.getConferences();

  // Close the connection
  await db.close();

  console.log("Database reinitialized successfully");
}

reinitializeDatabase().catch(console.error);
