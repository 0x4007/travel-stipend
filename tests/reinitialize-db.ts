import { DatabaseService } from '../src/utils/database';

async function reinitializeDatabase() {
  const db = DatabaseService.getInstance();

  // This will trigger the database initialization and data import
  await db.getConferences();

  // Close the connection
  await db.close();

  console.log('Database reinitialized successfully');
}

reinitializeDatabase().catch(console.error);
