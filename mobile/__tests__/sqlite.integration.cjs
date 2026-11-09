const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadSource() {
    const cache = new Map();
    function load(file) {
        file = path.resolve(file);
        if (!path.extname(file))
            file = fs.existsSync(file + '.ts') ? file + '.ts' : path.join(file, 'index.ts');
        assert.ok(file.startsWith(root + path.sep));
        if (cache.has(file)) return cache.get(file).exports;
        const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            fileName: file,
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const module = { exports: {} };
        cache.set(file, module);
        const localRequire = (id) => {
            if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
            throw Error('Unexpected native dependency: ' + id);
        };
        vm.runInNewContext(
            js,
            {
                module,
                exports: module.exports,
                require: localRequire,
                process: { env: {} },
                Date,
                Math,
                JSON,
            },
            { filename: file },
        );
        return module.exports;
    }
    return (name) => load(path.join(root, name));
}
function database(t) {
    const sql = new DatabaseSync(':memory:');
    t.after(() => sql.close());
    return {
        execAsync: async (q) => sql.exec(q),
        getFirstAsync: async (q, p = []) => sql.prepare(q).get(...p) ?? null,
        getAllAsync: async (q, p = []) => sql.prepare(q).all(...p),
        runAsync: async (q, p = []) => {
            const r = sql.prepare(q).run(...p);
            return { lastInsertRowId: r.lastInsertRowid, changes: r.changes };
        },
        withTransactionAsync: async (work) => {
            sql.exec('BEGIN');
            try {
                await work();
                sql.exec('COMMIT');
            } catch (e) {
                sql.exec('ROLLBACK');
                throw e;
            }
        },
    };
}
async function setup(t) {
    const load = loadSource(),
        db = database(t);
    await load('src/database/migrations').runMigrations(db);
    await db.runAsync(
        'INSERT INTO products (id,sku,barcode,name,unit,stock,server_id) VALUES (1,?,?,?,?,?,?)',
        ['PNT-1', '123456', 'Фарба', 'шт', 126, 42],
    );
    return { load, db };
}
test('migrations preserve documents and queued payloads from version 2', async (t) => {
    const load = loadSource(),
        db = database(t),
        schema = load('src/database/schema');
    await db.execAsync(schema.SCHEMA_V1 + schema.SCHEMA_V2 + 'PRAGMA user_version=2;');
    await db.runAsync(
        "INSERT INTO documents(id,type,status,warehouse,created_at) VALUES ('old','receipt','draft',1,'2026-11-08')",
    );
    await db.runAsync(
        "INSERT INTO outbox(id,payload,created_at) VALUES ('old','saved-payload','2026-11-08')",
    );
    await load('src/database/migrations').runMigrations(db);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 4);
    assert.equal(
        (await db.getFirstAsync("SELECT payload FROM outbox WHERE id='old'")).payload,
        'saved-payload',
    );
    assert.equal(
        (await db.getFirstAsync("SELECT created_by FROM documents WHERE id='old'")).created_by,
        null,
    );
    assert.equal(
        (await db.getFirstAsync("SELECT destination FROM documents WHERE id='old'")).destination,
        null,
    );
    await load('src/database/migrations').runMigrations(db);
});

test('transfer destination survives reloads and requeuing without leaking into receipts', async (t) => {
    const { load, db } = await setup(t);
    const repo = load('src/features/inventory/repositories/DocumentRepository').DocumentRepository;
    const { queueSavedDocument } = load('src/features/inventory/services/DraftService');
    await repo.createDraft(db, {
        id: 'transfer',
        type: 'transfer',
        warehouse: 1,
        createdAt: '2026-11-09',
        createdBy: 10,
    });
    await repo.insertLine(db, 1, 3, 'шт', 'transfer');
    await db.runAsync('UPDATE documents SET destination=2 WHERE id=?', ['transfer']);
    await queueSavedDocument(db, 'transfer', 'android');
    assert.equal((await repo.list(db))[0].destination, 2);
    assert.equal(
        JSON.parse((await repo.getOutbox(db, 'transfer')).payload).changes[0].document.destination,
        2,
    );
    await repo.createDraft(db, {
        id: 'receipt',
        type: 'receipt',
        warehouse: 1,
        createdAt: '2026-11-09',
        createdBy: 10,
    });
    await repo.insertLine(db, 1, 4, 'шт', 'receipt');
    await queueSavedDocument(db, 'receipt', 'android');
    assert.equal(
        'destination' in JSON.parse((await repo.getOutbox(db, 'receipt')).payload).changes[0].document,
        false,
    );
});
test('scans go only to the chosen draft and its outbox reflects repeated additions', async (t) => {
    const { load, db } = await setup(t);
    const repo = load('src/features/inventory/repositories/DocumentRepository').DocumentRepository;
    await repo.createDraft(db, {
        id: 'first',
        type: 'receipt',
        warehouse: 1,
        createdAt: '2026-11-08',
        createdBy: 10,
    });
    await repo.createDraft(db, {
        id: 'second',
        type: 'writeoff',
        warehouse: 1,
        createdAt: '2026-11-08',
        createdBy: 10,
    });
    const product = {
        id: 1,
        sku: 'PNT-1',
        barcode: '123456',
        name: 'Фарба',
        unit: 'шт',
        stock: 126,
        server_id: 42,
    };
    const { addProductToDocument } = load('src/features/inventory/services/DraftService');
    await addProductToDocument(db, 'second', product, 2, 'android');
    await addProductToDocument(db, 'second', product, 3, 'android');
    assert.equal((await repo.getLines(db, 'first')).length, 0);
    assert.equal((await repo.getLines(db)).length, 0);
    const rows = await repo.getLines(db, 'second');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quantity, 5);
    const payload = JSON.parse((await repo.getOutbox(db, 'second')).payload);
    assert.equal(payload.changes[0].document.id, 'second');
    assert.equal(payload.changes[0].document.lines[0].quantity, 5);
    assert.equal((await repo.list(db)).find((d) => d.id === 'second').line_count, 1);
});
test('different entered units remain separate lines and posted documents reject scans', async (t) => {
    const { load, db } = await setup(t),
        repo = load('src/features/inventory/repositories/DocumentRepository').DocumentRepository;
    await repo.createDraft(db, {
        id: 'draft',
        type: 'receipt',
        warehouse: 1,
        createdAt: '2026-11-08',
        createdBy: 10,
    });
    const product = { id: 1, sku: 'PNT-1', barcode: '123456', name: 'Фарба', unit: 'шт', stock: 126 };
    const { addProductToDocument } = load('src/features/inventory/services/DraftService');
    await addProductToDocument(db, 'draft', product, 2, 'android');
    await addProductToDocument(db, 'draft', { ...product, unit: 'упак' }, 1, 'android');
    assert.equal((await repo.getLines(db, 'draft')).length, 2);
    await repo.setStatus(db, 'draft', 'posted');
    await assert.rejects(addProductToDocument(db, 'draft', product, 1, 'android'), /чернетки/);
    assert.equal((await repo.getLines(db, 'draft')).length, 2);
});
