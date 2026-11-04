import React from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import WorkerScreen from './screens/WorkerScreen';
import { localSeed } from './domain';

function App() {
    return (
        <SQLiteProvider
            databaseName="stockflow.db"
            onInit={async db => {
                await db.execAsync(`
                    CREATE TABLE IF NOT EXISTS products (
                        id INTEGER PRIMARY KEY,
                        sku TEXT,
                        barcode TEXT,
                        name TEXT,
                        unit TEXT,
                        stock REAL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS documents (
                        id TEXT PRIMARY KEY,
                        type TEXT,
                        status TEXT,
                        warehouse INTEGER,
                        note TEXT,
                        created_at TEXT
                    );

                    CREATE TABLE IF NOT EXISTS lines (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        document_id TEXT,
                        product_id INTEGER,
                        quantity REAL,
                        unit TEXT
                    );

                    CREATE TABLE IF NOT EXISTS outbox (
                        id TEXT PRIMARY KEY,
                        payload TEXT,
                        created_at TEXT
                    );
                `);

                const row = await db.getFirstAsync<{ n: number }>(
                    'SELECT COUNT(*) AS n FROM products'
                );

                if (!row || row.n === 0) {
                    for (const p of localSeed) {
                        await db.runAsync(
                            `INSERT INTO products
                                (sku, barcode, name, unit, stock)
                             VALUES (?, ?, ?, ?, ?)`,
                            p
                        );
                    }
                }
                await db.runAsync('UPDATE products SET barcode = ? WHERE sku = ? AND barcode = ?', ['4820000000017', 'DRK-001', '4820000000011']);
            }}
        >
            <WorkerScreen />
        </SQLiteProvider>
    );
}



export default App;

