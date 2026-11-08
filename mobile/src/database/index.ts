/** Local database initialization: migrations, then demo data. */
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrations';
import { seedIfEmpty } from './seed';

export { DATABASE_NAME } from '../constants/config';
export { TABLES } from './schema';

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
    await runMigrations(db);
    await seedIfEmpty(db);
}
