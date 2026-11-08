/**
 * Schema migrations tracked with SQLite `PRAGMA user_version`.
 * Add a new entry with the next version number; never edit an applied one.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3 } from './schema';

export type Migration = { version: number; up: (db: SQLiteDatabase) => Promise<void> };

export const MIGRATIONS: Migration[] = [
    // Existing entries stay unchanged; version 3 only adds columns.
    { version: 1, up: (db) => db.execAsync(SCHEMA_V1) },
    {
        version: 2,
        up: async (db) => {
            const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
            if (columns.some((column) => column.name === 'server_id')) return;
            await db.execAsync(SCHEMA_V2);
        },
    },
    { version: 3, up: (db) => db.execAsync(SCHEMA_V3) },
];

export const LATEST_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));

/** Versions that still have to run, in order. */
export const pendingMigrations = (current: number): Migration[] =>
    MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    for (const migration of pendingMigrations(row?.user_version ?? 0)) {
        await db.withTransactionAsync(async () => {
            await migration.up(db);
            await db.execAsync(`PRAGMA user_version = ${migration.version}`);
        });
    }
}
