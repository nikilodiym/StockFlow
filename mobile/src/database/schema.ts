/** Local SQLite tables (offline storage on the phone). */

export const TABLES = {
    products: 'products',
    documents: 'documents',
    lines: 'lines',
    outbox: 'outbox',
} as const;

/** Version 1 — the original tables. `IF NOT EXISTS` keeps old installs working. */
export const SCHEMA_V1 = `
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

    -- Documents waiting to be sent to the server (offline-first).
    CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        payload TEXT,
        created_at TEXT
    );
`;

/** Version 2 — link local products to server products (filled by PullService). */
export const SCHEMA_V2 = `
    ALTER TABLE products ADD COLUMN server_id INTEGER;
    CREATE INDEX IF NOT EXISTS products_sku ON products (sku);
    CREATE INDEX IF NOT EXISTS lines_document ON lines (document_id);
`;
