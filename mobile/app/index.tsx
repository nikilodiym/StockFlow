
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    StyleSheet,
    Alert,
    Platform,
    Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext, SQLiteProvider } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Android emulators reach the host computer through 10.0.2.2. Physical
// devices can use their computer's LAN address from Settings.
const API = Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://localhost:8000/api';

type Screen = 'home' | 'scan' | 'search' | 'docs' | 'settings' | 'profile' | 'files' | 'detail' | 'import' | 'notifications' | 'conflict';
type DocumentType = 'receipt' | 'writeoff' | 'inventory' | 'transfer';

type Product = {
    id: number;
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    stock: number;
};

type DocumentItem = Product & {
    quantity: number;
    line_id?: number;
};

type OutboxRow = {
    id: string;
    payload: string;
    created_at: string;
};

type UserData = {
    name?: string;
    username?: string;
    email?: string;
};

type LoginResponse = {
    access?: string;
    refresh?: string;
    tokens?: {
        access?: string;
        refresh?: string;
    };
    user?: UserData;
    profile?: UserData;
    detail?: string;
    message?: string;
    error?: string;
};

const localSeed: [string, string, string, string, number][] = [
    ['DRK-001', '4820000000011', 'Вода мінеральна 1.5 л', 'шт', 128],
    ['DRK-002', '4820000000012', 'Сік апельсиновий 1 л', 'шт', 42],
    ['FOO-001', '4820000000013', 'Кава зернова 1 кг', 'упак', 18],
    ['FOO-002', '4820000000014', 'Рис довгозернистий 1 кг', 'упак', 7],
    ['HOM-001', '4820000000015', 'Рушники паперові 2 шт', 'упак', 34],
];

const documentTabs: [DocumentType, string][] = [
    ['receipt', 'Прихід'],
    ['writeoff', 'Списання'],
    ['inventory', 'Інвентаризація'],
    ['transfer', 'Переміщення'],
];

const uuid = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Сталася невідома помилка.';
}

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
            }}
        >
            <Worker />
        </SQLiteProvider>
    );
}

function Worker() {
    const db = useSQLiteContext();
    const [permission, requestPermission] = useCameraPermissions();

    const [screen, setScreen] = useState<Screen>('home');
    const [tab, setTab] = useState<DocumentType>('receipt');
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [query, setQuery] = useState('');
    const [manual, setManual] = useState('');
    const [qty, setQty] = useState('1');
    const [online, setOnline] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const [serverUrl, setServerUrl] = useState(API);
    const [serverDraft, setServerDraft] = useState(API);
    const [serverHost, setServerHost] = useState(Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
    const [serverPort, setServerPort] = useState('8000');
    const [token, setToken] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authUser, setAuthUser] = useState('Комірник');
    const [authMode, setAuthMode] = useState<'pin' | 'email'>('email');
    const [pinEntry, setPinEntry] = useState('');
    const [pinSetup, setPinSetup] = useState('');
    const [storedPin, setStoredPin] = useState('');
    const [needsUnlock, setNeedsUnlock] = useState(false);
    const [warehouse, setWarehouse] = useState('Склад №1 Київ');
    const [autoSync, setAutoSync] = useState(true);
    const [syncInterval, setSyncInterval] = useState('15 хв');
    const [importText, setImportText] = useState('');
    const [readAll, setReadAll] = useState(false);
    const [conflictChoice, setConflictChoice] = useState<'local' | 'server' | null>(null);
    const [docNote, setDocNote] = useState('');
    const [savedDocs, setSavedDocs] = useState<{id:string;type:DocumentType;status:string;created_at:string;is_synced?:number}[]>([]);
    const [docStatusFilter, setDocStatusFilter] = useState('Усі стани');
    const [docDateFilter, setDocDateFilter] = useState('Усі дати');
    const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
    const [detailItems, setDetailItems] = useState<DocumentItem[]>([]);
    const [outboxCount, setOutboxCount] = useState(0);
    const [soundOn, setSoundOn] = useState(true);
    const [vibrationOn, setVibrationOn] = useState(true);

    useEffect(() => {
        let active = true;

        const loadData = async () => {
            try {
                const productRows = await db.getAllAsync<Product>(
                    'SELECT * FROM products ORDER BY name'
                );

                const lineRows = await db.getAllAsync<DocumentItem>(
                    `SELECT
                        products.id AS id,
                        products.sku AS sku,
                        products.barcode AS barcode,
                        products.name AS name,
                        products.stock AS stock,
                        lines.unit AS unit,
                        lines.quantity AS quantity,
                        lines.id AS line_id
                     FROM lines
                     LEFT JOIN products
                        ON products.id = lines.product_id
                     WHERE lines.document_id = ?
                     ORDER BY lines.id`,
                    ['active']
                );

                if (active) {
                    setProducts(productRows);
                    setItems(lineRows);
                }
            } catch (error) {
                // Fast Refresh may close the previous SQLite context while
                // an in-flight query is finishing. Ignore that stale result.
                if (active) console.error('Помилка бази даних:', error);
            }
        };

        loadData();

        return () => {
            active = false;
        };
    }, [db]);

    useEffect(() => {
        let active = true;

        const loadSettings = async () => {
            try {
                const savedUrl = await AsyncStorage.getItem('serverUrl');
                const savedToken = await AsyncStorage.getItem('sf_token');
                const savedUser = await AsyncStorage.getItem('sf_user');
                const savedPin = await AsyncStorage.getItem('sf_pin');
                const savedAutoSync = await AsyncStorage.getItem('sf_auto_sync');
                const savedInterval = await AsyncStorage.getItem('sf_sync_interval');
                const savedWarehouse = await AsyncStorage.getItem('sf_warehouse');

                if (!active) return;

                // Older builds persisted a machine-specific LAN IP. It goes
                // stale when the server moves or the app runs in an emulator.
                const isStaleDefault = savedUrl === 'http://192.168.7.13:8000/api';
                if (savedUrl && !isStaleDefault) {
                    setServerUrl(savedUrl);
                    setServerDraft(savedUrl);
                    const address = savedUrl.replace(/^https?:\/\//i, '').split('/')[0];
                    const separator = address.lastIndexOf(':');
                    setServerHost(separator < 0 ? address : address.slice(0, separator));
                    if (separator >= 0) setServerPort(address.slice(separator + 1));
                } else if (isStaleDefault) {
                    await AsyncStorage.setItem('serverUrl', API);
                }

                if (savedToken) {
                    setToken(savedToken);
                }
                if (savedPin) {
                    setStoredPin(savedPin);
                    setAuthMode('pin');
                    setNeedsUnlock(!!savedToken);
                }
                if (savedAutoSync != null) setAutoSync(savedAutoSync === 'true');
                if (savedInterval) setSyncInterval(savedInterval);
                if (savedWarehouse) setWarehouse(savedWarehouse);

                if (savedUser) {
                    try {
                        const user = JSON.parse(savedUser) as UserData;
                        setAuthUser(
                            user.name || user.username || user.email || 'Комірник'
                        );
                    } catch {
                        setAuthUser('Комірник');
                    }
                }
            } catch (error) {
                console.error('Помилка завантаження налаштувань:', error);
            }
        };

        loadSettings();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        const check = async () => {
            try {
                const response = await fetch(
                    `${serverUrl.replace(/\/$/, '')}/health/`
                );

                if (active) {
                    setOnline(response.ok);
                }
            } catch {
                if (active) {
                    setOnline(false);
                }
            }
        };

        check();

        const timer = setInterval(check, 20000);

        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [serverUrl]);

    const add = async (product: Product): Promise<void> => {
        const quantity = Number(qty.replace(',', '.'));

        if (!Number.isFinite(quantity) || quantity <= 0) {
            Alert.alert('Помилка', 'Введіть коректну кількість товару.');
            return;
        }

        try {
            const existing = items.find(item => item.id === product.id);
            if (existing?.line_id) {
                const nextQuantity = Number(existing.quantity) + quantity;
                await db.runAsync('UPDATE lines SET quantity = ? WHERE id = ?', [nextQuantity, existing.line_id]);
                setItems(previous => previous.map(item => item.line_id === existing.line_id ? { ...item, quantity: nextQuantity } : item));
            } else {
                await db.runAsync(
                    `INSERT INTO lines (document_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)`,
                    ['active', product.id, quantity, product.unit || 'шт']
                );
                const line = await db.getFirstAsync<{id:number}>(
                    'SELECT id FROM lines WHERE document_id = ? AND product_id = ? ORDER BY id DESC LIMIT 1', ['active', product.id]);
                setItems(previous => [...previous, { ...product, quantity, line_id: line?.id }]);
            }

            await Haptics.impactAsync(
                Haptics.ImpactFeedbackStyle.Light
            );
        } catch (error) {
            Alert.alert(
                'Помилка',
                `Не вдалося додати товар: ${getErrorMessage(error)}`
            );
        }
    };

    const find = async (term: string): Promise<void> => {
        const value = term.trim();

        if (!value) {
            Alert.alert('Пошук', 'Введіть штрих-код або назву товару.');
            setScanned(false);
            return;
        }

        try {
            let found: Product | null | undefined = products.find(
                (product: Product) =>
                    product.barcode === value ||
                    product.sku.toLowerCase() === value.toLowerCase() ||
                    product.name.toLowerCase().includes(value.toLowerCase())
            );

            if (!found) {
                found = await db.getFirstAsync<Product>(
                    `SELECT * FROM products
                     WHERE barcode = ?
                        OR sku = ?
                        OR name LIKE ?
                     LIMIT 1`,
                    [value, value, `%${value}%`]
                );
            }

            if (found) {
                await add(found);
                setManual('');
            } else {
                Alert.alert(
                    'Товар не знайдено',
                    'Перевірте штрих-код або назву.'
                );
            }
        } catch (error) {
            Alert.alert(
                'Помилка пошуку',
                getErrorMessage(error)
            );
        } finally {
            setScanned(false);
        }
    };

    const sync = async (showEmptyQueueMessage = true): Promise<void> => {
        if (syncing) return;

        if (!token) {
            Alert.alert(
                'Потрібен вхід',
                'Увійдіть до облікового запису перед синхронізацією.'
            );
            return;
        }

        setSyncing(true);

        try {
            const pending = await db.getAllAsync<OutboxRow>(
                'SELECT * FROM outbox ORDER BY created_at'
            );

            if (pending.length === 0) {
                if (showEmptyQueueMessage) Alert.alert('Синхронізація', 'Немає документів для передавання.');
                await refreshDocs();
                return;
            }

            let synced = 0;

            for (const entry of pending) {
                const response = await fetch(
                    `${serverUrl.replace(/\/$/, '')}/sync/`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: entry.payload,
                    }
                );

                if (response.status === 401) {
                    Alert.alert(
                        'Потрібен повторний вхід',
                        'Сервер відхилив токен доступу. Увійдіть знову.'
                    );
                    return;
                }

                if (response.status === 409) {
                    await db.runAsync("UPDATE documents SET status = 'conflict' WHERE id = ?", [entry.id]);
                    await refreshDocs();
                    Alert.alert('Конфлікт синхронізації', 'Сервер і пристрій мають різні зміни. Відкрийте документ і оберіть потрібну версію.');
                    return;
                }

                if (!response.ok) {
                    const message = await response.text().catch(() => '');
                    throw new Error(
                        `Сервер повернув ${response.status}. ${message}`
                    );
                }

                await db.runAsync(
                    'DELETE FROM outbox WHERE id = ?',
                    [entry.id]
                );

                synced++;
            }

            Alert.alert(
                'Синхронізація завершена',
                `Передано документів: ${synced}.`
            );
            await refreshDocs();
        } catch (error) {
            Alert.alert(
                'Не вдалося синхронізувати',
                getErrorMessage(error)
            );
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        if (autoSync && online && token) {
            void sync(false);
        }
    }, [online, token, autoSync]);

    useEffect(() => {
        if (!autoSync || !online || !token) return;
        const minutes = Number.parseInt(syncInterval, 10) || 15;
        const timer = setInterval(() => void sync(false), minutes * 60 * 1000);
        return () => clearInterval(timer);
    }, [autoSync, online, token, syncInterval]);

    const signIn = async (): Promise<void> => {
        const email = authEmail.trim().toLowerCase();
        const password = authPassword;

        if (!email || !password) {
            Alert.alert('Помилка', 'Введіть email і пароль.');
            return;
        }

        try {
            const response = await fetch(
                `${serverUrl.replace(/\/$/, '')}/auth/login/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                }
            );

            const data = (await response.json().catch(
                () => ({})
            )) as LoginResponse;

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    data.message ||
                    data.error ||
                    `Помилка входу: ${response.status}`
                );
            }

            const access = data.access || data.tokens?.access;
            const refresh = data.refresh || data.tokens?.refresh;
            const user = data.user || data.profile;

            if (!access) {
                throw new Error(
                    'Сервер не повернув токен доступу. Перевірте формат відповіді API.'
                );
            }

            await AsyncStorage.setItem('sf_token', access);

            if (refresh) {
                await AsyncStorage.setItem('sf_refresh', refresh);
            } else {
                await AsyncStorage.removeItem('sf_refresh');
            }

            if (user) {
                await AsyncStorage.setItem(
                    'sf_user',
                    JSON.stringify(user)
                );
            }

            setAuthUser(
                user?.name || user?.username || user?.email || email
            );
            setToken(access);
            setNeedsUnlock(false);
            setAuthPassword('');
        } catch (error) {
            Alert.alert(
                'Не вдалося увійти',
                `${getErrorMessage(error)}\n\nПеревірте, що API запущений на комп’ютері (npm run api). Для фізичного телефона вкажіть IPv4 комп’ютера в Налаштуваннях; для Android-емулятора використовується 10.0.2.2.`
            );
        }
    };

    const signOut = async (): Promise<void> => {
        try {
            await AsyncStorage.multiRemove([
                'sf_token',
                'sf_refresh',
                'sf_user',
            ]);

            setToken('');
            setNeedsUnlock(false);
            setAuthPassword('');
            setAuthEmail('');
            setScreen('home');
        } catch (error) {
            Alert.alert(
                'Помилка',
                getErrorMessage(error)
            );
        }
    };

    const saveServer = async (): Promise<void> => {
        const host = serverHost.trim();
        const port = serverPort.trim();
        const value = `http://${host}:${port}/api`;

        if (!host || !/^\d{2,5}$/.test(port) || Number(port) > 65535) {
            Alert.alert(
                'Некоректна адреса',
                'Введіть адресу сервера та порт від 1 до 65535.'
            );
            return;
        }

        try {
            await AsyncStorage.setItem('serverUrl', value);
            setServerUrl(value);
            setServerDraft(value);

            Alert.alert(
                'Збережено',
                'Адресу сервера оновлено.'
            );
        } catch (error) {
            Alert.alert('Помилка', getErrorMessage(error));
        }
    };

    const checkConnection = async (): Promise<void> => {
        const host = serverHost.trim();
        const port = serverPort.trim();
        if (!host || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
            Alert.alert('Некоректна адреса', 'Перевірте IP-адресу та порт сервера.');
            return;
        }
        const value = `http://${host}:${port}/api`;
        setServerDraft(value); setServerUrl(value);
        await AsyncStorage.setItem('serverUrl', value);
        try {
            const response = await fetch(`${value}/health/`);
            setOnline(response.ok);
            Alert.alert(response.ok ? 'З’єднання встановлено' : 'Сервер недоступний', response.ok ? 'WareGo підключено до сервера.' : `Сервер повернув ${response.status}.`);
        } catch (error) {
            setOnline(false); Alert.alert('Немає з’єднання', getErrorMessage(error));
        }
    };

    const save = async (status: 'draft' | 'posted' = 'draft'): Promise<void> => {
        if (items.length === 0) {
            Alert.alert(
                'Порожній документ',
                'Спочатку додайте хоча б один товар.'
            );
            return;
        }

        try {
            const id = uuid();
            const createdAt = new Date().toISOString();

            const doc = {
                id,
                type: tab,
                status,
                warehouse: warehouse === 'Склад №2 Львів' ? 2 : 1,
                note: docNote,
                created_at: createdAt,
                lines: items.map(item => ({
                    product: item.id,
                    quantity: item.quantity,
                    unit: item.unit || 'шт',
                })),
            };

            await db.withTransactionAsync(async () => {
                await db.runAsync(
                    `INSERT INTO documents
                        (id, type, status, warehouse, note, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [id, tab, status, warehouse === 'Склад №2 Львів' ? 2 : 1, docNote, createdAt]
                );

                await db.runAsync(
                    'UPDATE lines SET document_id = ? WHERE document_id = ?',
                    [id, 'active']
                );

                await db.runAsync(
                    `INSERT INTO outbox (id, payload, created_at)
                     VALUES (?, ?, ?)`,
                    [
                        id,
                        JSON.stringify({
                            device_id: Platform.OS,
                            changes: [
                                {
                                    client_id: id,
                                    document: doc,
                                },
                            ],
                        }),
                        createdAt,
                    ]
                );
            });

            setItems([]);
            setDocNote('');
            setScreen('home');

            Alert.alert(status === 'posted' ? 'Документ проведено' : 'Збережено офлайн',
                status === 'posted' ? 'Документ збережено та додано до черги синхронізації.' : 'Документ збережено на пристрої. Його можна синхронізувати пізніше.');

            if (online && token) {
                sync();
            }
        } catch (error) {
            Alert.alert(
                'Помилка збереження',
                getErrorMessage(error)
            );
        }
    };

    const filtered = products.filter((product: Product) =>
        `${product.name} ${product.sku} ${product.barcode}`
            .toLowerCase()
            .includes(query.toLowerCase())
    );

    const refreshDocs = async () => {
        const docs = await db.getAllAsync<{id:string;type:DocumentType;status:string;created_at:string;is_synced?:number}>(
            'SELECT documents.id,documents.type,documents.status,documents.created_at,CASE WHEN outbox.id IS NULL THEN 1 ELSE 0 END AS is_synced FROM documents LEFT JOIN outbox ON outbox.id=documents.id ORDER BY documents.created_at DESC');
        const queued = await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM outbox');
        setSavedDocs(docs); setOutboxCount(queued?.n || 0);
    };
    useEffect(() => {
        let active = true;
        void refreshDocs().catch(error => {
            if (active) console.error('Помилка завантаження документів:', error);
        });
        return () => { active = false; };
    }, [db, screen]);
    const openDoc = async (id:string) => {
        setSelectedDoc(id);
        const saved = savedDocs.find(doc=>doc.id===id);
        if (saved) setTab(saved.type);
        const rows = await db.getAllAsync<DocumentItem>(
            `SELECT products.id,products.sku,products.barcode,products.name,products.stock,lines.unit,lines.quantity,lines.id AS line_id
             FROM lines LEFT JOIN products ON products.id=lines.product_id WHERE lines.document_id=? ORDER BY lines.id`, [id]);
        setDetailItems(rows); setScreen('detail' as Screen);
    };
    const changeQty = async (item:DocumentItem, delta:number) => {
        const q=Number(item.quantity)+delta;
        if(q<=0){await db.runAsync('DELETE FROM lines WHERE id=?',[item.line_id||-1]);setItems(v=>v.filter(x=>x.line_id!==item.line_id));}
        else {await db.runAsync('UPDATE lines SET quantity=? WHERE id=?',[q,item.line_id||-1]);setItems(v=>v.map(x=>x.line_id===item.line_id?{...x,quantity:q}:x));}
    };
    const changeSavedQty = async (item:DocumentItem, delta:number) => {
        if (!selectedDoc || savedDocs.find(d=>d.id===selectedDoc)?.status !== 'draft') return;
        const q=Number(item.quantity)+delta;
        if(q<=0){await db.runAsync('DELETE FROM lines WHERE id=?',[item.line_id||-1]);setDetailItems(v=>v.filter(x=>x.line_id!==item.line_id));}
        else {await db.runAsync('UPDATE lines SET quantity=? WHERE id=?',[q,item.line_id||-1]);setDetailItems(v=>v.map(x=>x.line_id===item.line_id?{...x,quantity:q}:x));}
    };
    const startDoc = (kind:DocumentType) => { setTab(kind); setSelectedDoc(null); setScreen('scan'); };
    const newDoc = () => startDoc(tab);
    const chooseWarehouse = async (value:string): Promise<void> => { setWarehouse(value); await AsyncStorage.setItem('sf_warehouse', value); };
    const unlockWithPin = (): void => {
        if (pinEntry.length !== 4) return;
        if (pinEntry === storedPin) { setNeedsUnlock(false); setPinEntry(''); }
        else { setPinEntry(''); Alert.alert('Невірний PIN-код', 'Перевірте код або увійдіть через email і пароль.'); }
    };
    const savePin = async (): Promise<void> => {
        if (!/^\d{4}$/.test(pinSetup)) { Alert.alert('PIN-код', 'Введіть чотири цифри.'); return; }
        await AsyncStorage.setItem('sf_pin', pinSetup);
        setStoredPin(pinSetup); setPinSetup('');
        Alert.alert('PIN-код збережено', 'Після наступного запуску можна увійти за PIN-кодом.');
    };
    const toggleAutoSync = async (): Promise<void> => {
        const next = !autoSync; setAutoSync(next); await AsyncStorage.setItem('sf_auto_sync', String(next));
    };
    const chooseSyncInterval = async (value: string): Promise<void> => {
        setSyncInterval(value); await AsyncStorage.setItem('sf_sync_interval', value);
    };
    const exportProducts = async (): Promise<void> => {
        const csv = ['SKU,Barcode,Name,Unit,Stock', ...products.map(p => [p.sku,p.barcode,`"${p.name.replace(/"/g,'""')}"`,p.unit,p.stock].join(','))].join('\n');
        await Share.share({ title: 'WareGo — товари CSV', message: csv });
    };
    const createBackup = async (): Promise<void> => {
        const payload = { created_at: new Date().toISOString(), products, documents: savedDocs, current_document: items };
        await Share.share({ title: 'Резервна копія WareGo', message: JSON.stringify(payload, null, 2) });
    };
    const importProducts = async (): Promise<void> => {
        const lines = importText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        let imported = 0;
        for (const line of lines.slice(1)) {
            const [sku, barcode, name, unit, stockText] = line.split(',').map(cell => cell.trim().replace(/^"|"$/g,''));
            if (!sku || !name) continue;
            const stock = Number(String(stockText || '0').replace(',','.')) || 0;
            const existing = await db.getFirstAsync<{id:number}>('SELECT id FROM products WHERE sku = ? OR barcode = ? LIMIT 1', [sku, barcode || '']);
            if (existing) await db.runAsync('UPDATE products SET sku=?,barcode=?,name=?,unit=?,stock=? WHERE id=?', [sku,barcode||'',name,unit||'шт',stock,existing.id]);
            else await db.runAsync('INSERT INTO products (sku,barcode,name,unit,stock) VALUES (?,?,?,?,?)', [sku,barcode||'',name,unit||'шт',stock]);
            imported++;
        }
        const rows = await db.getAllAsync<Product>('SELECT * FROM products ORDER BY name');
        setProducts(rows); setImportText(''); setScreen('files');
        Alert.alert('Імпорт завершено', `Додано або оновлено товарів: ${imported}.`);
    };
    const postCurrent = async (): Promise<void> => {
        if (!selectedDoc) { await save('posted'); return; }
        await db.runAsync("UPDATE documents SET status = 'posted' WHERE id = ?", [selectedDoc]);
        const queued = await db.getFirstAsync<OutboxRow>('SELECT * FROM outbox WHERE id = ?', [selectedDoc]);
        if (queued) {
            try {
                const payload = JSON.parse(queued.payload) as {changes?: {document?: {status?: string}}[]};
                if (payload.changes?.[0]?.document) payload.changes[0].document.status = 'posted';
                await db.runAsync('UPDATE outbox SET payload = ? WHERE id = ?', [JSON.stringify(payload), selectedDoc]);
            } catch { /* The server will report malformed queued data during sync. */ }
        }
        await refreshDocs(); setSelectedDoc(selectedDoc);
        if (online && token) void sync();
        Alert.alert('Документ проведено', 'Зміни збережено локально та поставлено в чергу синхронізації.');
    };
    const deleteSelectedDoc = (): void => {
        if (!selectedDoc) {
            Alert.alert('Очистити поточний документ?', 'Усі його позиції буде видалено.', [
                { text: 'Скасувати', style: 'cancel' },
                { text: 'Очистити', style: 'destructive', onPress: () => { void db.runAsync("DELETE FROM lines WHERE document_id = 'active'").then(() => { setItems([]); setScreen('home'); }); } },
            ]);
            return;
        }
        Alert.alert('Видалити документ?', 'Цю дію не можна скасувати.', [
            { text: 'Скасувати', style: 'cancel' },
            { text: 'Видалити', style: 'destructive', onPress: () => { void (async () => {
                await db.runAsync('DELETE FROM lines WHERE document_id = ?', [selectedDoc]);
                await db.runAsync('DELETE FROM documents WHERE id = ?', [selectedDoc]);
                await db.runAsync('DELETE FROM outbox WHERE id = ?', [selectedDoc]);
                setSelectedDoc(null); setScreen('docs'); await refreshDocs();
            })(); } },
        ]);
    };
    const resolveConflict = async (): Promise<void> => {
        if (!selectedDoc || !conflictChoice) return;
        await db.runAsync("UPDATE documents SET status = 'draft' WHERE id = ?", [selectedDoc]);
        setConflictChoice(null); setScreen('detail'); await refreshDocs();
        Alert.alert('Конфлікт розв’язано', `Застосовано ${conflictChoice === 'local' ? 'локальні' : 'серверні'} дані.`);
    };
    const typeLabel:Record<DocumentType,string>={receipt:'Прихід',writeoff:'Списання',inventory:'Інвентаризація',transfer:'Переміщення'};
    const dateLabel=(d:string)=>new Date(d).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'});
    const visibleDocs=savedDocs.filter(doc=>{
        if(doc.type!==tab) return false;
        if(docStatusFilter==='Чернетка'&&doc.status!=='draft') return false;
        if(docStatusFilter==='Проведено'&&doc.status!=='posted') return false;
        if(docStatusFilter==='Синхронізовано'&&!doc.is_synced) return false;
        if(docDateFilter==='Сьогодні'&&new Date(doc.created_at).toDateString()!==new Date().toDateString()) return false;
        if(docDateFilter==='7 днів'&&Date.now()-new Date(doc.created_at).getTime()>7*86400000) return false;
        return true;
    });
    const beginTitle=selectedDoc?`${typeLabel[savedDocs.find(d=>d.id===selectedDoc)?.type||tab]} · ${dateLabel(savedDocs.find(d=>d.id===selectedDoc)?.created_at||new Date().toISOString())}`:`${typeLabel[tab]} · Чернетка`;
    const itemRows=(rows:DocumentItem[], edit=false)=><>{rows.map((item,i)=><View key={item.line_id??`${item.id}-${i}`} style={s.productRow}>
        <View style={s.productBadge}><Text style={s.badgeText}>PNT</Text></View><View style={s.productInfo}><Text style={s.actionTitle}>{item.name}</Text><Text style={s.hint}>{item.sku} · {item.barcode}</Text></View>
        {edit?<View style={s.qtyControl}><Pressable style={s.qtyButton} onPress={()=>void (selectedDoc?changeSavedQty(item,-1):changeQty(item,-1))}><Text>−</Text></Pressable><Text style={s.qtyNumber}>{item.quantity}</Text><Pressable style={s.qtyButton} onPress={()=>void (selectedDoc?changeSavedQty(item,1):changeQty(item,1))}><Text>＋</Text></Pressable></View>:<Text style={s.qty}>{item.quantity} {item.unit}</Text>}
    </View>)}</>;

    const Nav = () => <View style={s.bottom}>{([['home','⌂','Головна'],['docs','▤','Документи'],['files','▱','Файли'],['profile','◯','Профіль']] as const).map(([key,icon,label])=><Pressable key={key} style={s.navItem} onPress={()=>setScreen(key)}><Text style={[s.navIcon,(screen===key||(key==='docs'&&screen==='detail'))&&s.navSelected]}>{icon}</Text><Text style={[s.navLabel,(screen===key||(key==='docs'&&screen==='detail'))&&s.navSelected]}>{label}</Text></Pressable>)}</View>;
    const pageTitle = screen==='scan'?'Сканувати штрих-код':screen==='search'?'Ручне введення':screen==='docs'?'Документи':screen==='detail'?beginTitle:screen==='files'?'Файли та імпорт':screen==='profile'?'Мій профіль':screen==='settings'?'Налаштування':screen==='import'?'Імпорт товарів':screen==='notifications'?'Сповіщення':screen==='conflict'?'Конфлікт синхронізації':'Головна';
    const BackHeader = ({right}:{right?:React.ReactNode}) => <View style={s.pageHeader}><Pressable onPress={()=>setScreen(screen==='detail'||screen==='conflict'?'docs':screen==='settings'?'profile':'home')} style={s.backButton}><Text style={s.backGlyph}>‹</Text></Pressable><Text style={s.pageTitle}>{pageTitle}</Text><View style={s.headerRight}>{right}</View></View>;

    if (!token || needsUnlock) return (
        <SafeAreaView style={s.root} edges={['top','bottom']}><StatusBar style="dark"/><ScrollView contentContainerStyle={s.loginScreen} keyboardShouldPersistTaps="handled">
            <View style={s.logoCube}><Text style={s.logoCubeText}>⬢</Text></View><Text style={s.loginBrand}>Ware<Text style={s.brandGreen}>Go</Text></Text><Text style={s.loginSubtitle}>Складський облік</Text>
            <Text style={s.fieldLabel}>СКЛАД</Text><Pressable style={s.warehousePicker} onPress={()=>Alert.alert('Оберіть склад','',[{text:'Склад №1 Київ',onPress:()=>{void chooseWarehouse('Склад №1 Київ')}},{text:'Склад №2 Львів',onPress:()=>{void chooseWarehouse('Склад №2 Львів')}},{text:'Скасувати',style:'cancel'}])}><Text style={s.warehouseText}>{warehouse}</Text><Text style={s.chevron}>⌄</Text></Pressable>
            <View style={s.authTabs}><Pressable style={[s.authTab,authMode==='pin'&&s.authTabActive]} onPress={()=>setAuthMode('pin')}><Text style={[s.authTabText,authMode==='pin'&&s.authTabTextActive]}>PIN-код</Text></Pressable><Pressable style={[s.authTab,authMode==='email'&&s.authTabActive]} onPress={()=>setAuthMode('email')}><Text style={[s.authTabText,authMode==='email'&&s.authTabTextActive]}>Email + пароль</Text></Pressable></View>
            {authMode==='email'?<><Text style={s.fieldLabel}>EMAIL</Text><TextInput style={s.input} placeholder="name@warego.ua" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={authEmail} onChangeText={setAuthEmail}/><Text style={s.fieldLabel}>ПАРОЛЬ</Text><TextInput style={s.input} secureTextEntry placeholder="Введіть пароль" value={authPassword} onChangeText={setAuthPassword} onSubmitEditing={signIn}/><Pressable style={s.primaryButton} onPress={()=>void signIn()}><Text style={s.primaryButtonText}>Увійти</Text></Pressable><Pressable onPress={()=>Alert.alert('Відновлення пароля','Зверніться до адміністратора складу.')}><Text style={s.forgotLink}>Забули пароль?</Text></Pressable></>:<><Text style={s.pinPrompt}>Введіть PIN-код</Text><View style={s.pinDots}>{[0,1,2,3].map(i=><View key={i} style={[s.pinDot,i<pinEntry.length&&s.pinDotFilled]}/>)}</View>{storedPin?<View style={s.keypad}>{['1','2','3','4','5','6','7','8','9','','0','⌫'].map((digit,i)=><Pressable key={i} disabled={!digit} style={s.keypadKey} onPress={()=>digit==='⌫'?setPinEntry(v=>v.slice(0,-1)):setPinEntry(v=>v.length<4?v+digit:v)}><Text style={s.keypadDigit}>{digit}</Text></Pressable>)}</View>:<Text style={s.mutedCenter}>PIN-код ще не налаштовано. Увійдіть через email і створіть його в налаштуваннях.</Text>}<Pressable style={[s.primaryButton,!storedPin&&s.buttonDisabled]} disabled={!storedPin} onPress={unlockWithPin}><Text style={s.primaryButtonText}>Увійти за PIN-кодом</Text></Pressable></>}
        </ScrollView></SafeAreaView>
    );

    return <SafeAreaView style={s.root} edges={['top','bottom']}><StatusBar style="dark"/><View style={s.appFrame}>
        {screen==='home'?<>
            <View style={s.homeHeader}><View><Text style={s.pageTitle}>Головна</Text><Pressable style={s.warehouseInline} onPress={()=>Alert.alert('Оберіть склад','',[{text:'Склад №1 Київ',onPress:()=>{void chooseWarehouse('Склад №1 Київ')}},{text:'Склад №2 Львів',onPress:()=>{void chooseWarehouse('Склад №2 Львів')}},{text:'Скасувати',style:'cancel'}])}><Text style={s.warehouseInlineText}>⌂  {warehouse}  ⌄</Text></Pressable><Text style={s.mutedSmall}>{authUser} · Складський облік</Text></View><View style={s.headerActions}><Pressable style={s.iconButton} onPress={()=>setScreen('notifications')}><Text style={s.iconButtonText}>♧</Text>{outboxCount>0&&!readAll&&<View style={s.unreadDot}/>}</Pressable><Pressable style={s.iconButton} onPress={()=>setScreen('settings')}><Text style={s.iconButtonText}>⚙</Text></Pressable></View></View>
            <ScrollView contentContainerStyle={s.homeBody} keyboardShouldPersistTaps="handled"><Pressable style={s.searchBar} onPress={()=>{setQuery('');setScreen('search')}}><Text style={s.searchPlaceholder}>Назва, SKU або штрихкод</Text><Text style={s.searchGlyph}>⌕</Text></Pressable>
                <Text style={s.sectionLabel}>ШВИДКИЙ ДОСТУП</Text><View style={s.quickGrid}>{([['⌕','Пошук','search'],['▦','Сканер','scan'],['▤','Документи','docs'],['⌂','Склад','files']] as const).map(([icon,label,to])=><Pressable key={label} style={s.quickItem} onPress={()=>setScreen(to)}><Text style={s.quickIcon}>{icon}</Text><Text style={s.quickLabel}>{label}</Text></Pressable>)}</View>
                <View style={[s.onlineCard,online?s.onlineCardOn:s.onlineCardOff]}><View style={s.rowBetween}><View style={s.rowInline}><Text style={s.onlineSymbol}>{online?'◉':'◌'}</Text><View><Text style={s.onlineTitle}>{online?'Онлайн':'Офлайн'}</Text><Text style={s.mutedSmall}>{online?'Мережа доступна':'Застосунок працює без мережі'}</Text></View></View><Text style={online?s.onlineTitle:s.offlineTitle}>{online?'●':'●'}</Text></View></View>
                <View style={s.syncCard}><View style={s.rowBetween}><View style={s.rowInline}><Text style={s.syncCount}>{outboxCount}</Text><View><Text style={s.cardTitle}>{outboxCount===1?'запис':outboxCount===0?'записів':'записи'}</Text><Text style={s.mutedSmall}>{outboxCount?'Не синхронізовано':'Усе синхронізовано'}</Text></View></View><Text style={[s.statusPill,outboxCount?s.statusPending:s.statusDone]}>{outboxCount?'Очікує':'Готово'}</Text></View><Text style={s.mutedSmall}>Остання перевірка · {new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</Text><Pressable style={s.yellowButton} onPress={()=>void sync()} disabled={syncing}><Text style={s.yellowButtonText}>{syncing?'Синхронізація…':'Синхронізувати записи'}</Text></Pressable></View>
                <View style={s.documentCurrent}><View style={s.rowBetween}><Text style={s.cardTitle}>Поточний документ</Text><Pressable onPress={()=>setScreen('docs')}><Text style={s.linkText}>{items.length?typeLabel[tab]:'Не обрано'}  ⌄</Text></Pressable></View><Text style={s.documentHeadline}>{items.length?typeLabel[tab]:'Документ не обрано'}</Text><Text style={s.mutedSmall}>{items.length} позицій · {items.reduce((n,item)=>n+Number(item.quantity||0),0)} од.</Text><Pressable style={s.primaryButton} onPress={()=>items.length?setScreen('detail'):newDoc()}><Text style={s.primaryButtonText}>{items.length?'Відкрити документ':'Обрати документ'}</Text></Pressable><Pressable style={s.scanHomeButton} onPress={()=>setScreen('scan')}><Text style={s.scanHomeText}>▦  Сканувати штрих-код</Text></Pressable><Text style={s.centerCaption}>Скануйте штрихкод або знайдіть товар вручну</Text></View>
                <View style={s.sectionHeading}><Text style={s.sectionLabel}>АКТИВНІ ДОКУМЕНТИ</Text><Pressable onPress={()=>setScreen('docs')}><Text style={s.linkText}>Усі</Text></Pressable></View>{savedDocs.slice(0,2).map(doc=><Pressable key={doc.id} style={s.savedDocCard} onPress={()=>void openDoc(doc.id)}><View style={s.docGlyph}><Text style={s.docGlyphText}>{doc.type==='receipt'?'⇣':doc.type==='writeoff'?'▣':doc.type==='transfer'?'⇄':'▤'}</Text></View><View style={s.productInfo}><Text style={s.productName}>{doc.id.slice(0,7).toUpperCase()} · {typeLabel[doc.type]}</Text><Text style={s.productCode}>{dateLabel(doc.created_at)} · {warehouse}</Text></View><Text style={s.statusPill}>{doc.status==='draft'?'Чернетка':doc.status}</Text></Pressable>)}
                <Text style={s.sectionLabel}>ВАША ЗМІНА</Text><View style={s.statsRow}><View style={s.statCard}><Text style={s.statNumber}>{products.length}</Text><Text style={s.mutedSmall}>Сканів</Text></View><View style={s.statCard}><Text style={s.statNumber}>{savedDocs.length}</Text><Text style={s.mutedSmall}>Документів</Text></View><View style={s.statCard}><Text style={s.statNumber}>0</Text><Text style={s.mutedSmall}>Розбіжностей</Text></View></View><Text style={s.shiftTime}>08:00–20:00</Text>
            </ScrollView><Nav/>
        </>:screen==='docs'?<><View style={s.pageHeader}><Text style={s.pageTitle}>Документи</Text><Pressable style={s.iconButton} onPress={()=>newDoc()}><Text style={s.iconButtonText}>＋</Text></Pressable></View><ScrollView contentContainerStyle={s.pageBody}>
            <View style={s.docTypeGrid}>{documentTabs.map(([kind,label])=><Pressable key={kind} style={[s.docTypeChip,tab===kind&&s.docTypeSelected]} onPress={()=>setTab(kind)}><Text style={[s.docTypeText,tab===kind&&s.docTypeTextOn]}>{label}</Text><Text style={[s.docTypeCount,tab===kind&&s.docTypeTextOn]}>{savedDocs.filter(d=>d.type===kind).length}</Text></Pressable>)}</View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>{['Усі дати','Сьогодні','7 днів'].map(label=><Pressable key={label} onPress={()=>setDocDateFilter(label)} style={[s.filterChip,docDateFilter===label&&s.filterSelected]}><Text style={[s.filterText,docDateFilter===label&&s.filterTextOn]}>{label}</Text></Pressable>)}</ScrollView>
            <View style={s.statusFilters}>{['Усі стани','Чернетка','Проведено','Синхронізовано'].map(label=><Pressable key={label} style={[s.statusFilter,docStatusFilter===label&&s.statusFilterOn]} onPress={()=>setDocStatusFilter(label)}><Text style={[s.statusFilterText,docStatusFilter===label&&s.statusFilterTextOn]}>{label}</Text></Pressable>)}</View>
            {visibleDocs.map(doc=><Pressable key={doc.id} style={s.savedDocCard} onPress={()=>void openDoc(doc.id)}><View style={s.docGlyph}><Text style={s.docGlyphText}>{doc.type==='receipt'?'⇣':doc.type==='writeoff'?'▣':doc.type==='transfer'?'⇄':'▤'}</Text></View><View style={s.productInfo}><Text style={s.productName}>{doc.id.slice(0,7).toUpperCase()} · {typeLabel[doc.type]}</Text><Text style={s.productCode}>{dateLabel(doc.created_at)} · {warehouse}</Text></View><Text style={[s.statusPill,doc.status==='posted'?s.statusDone:s.statusPending]}>{doc.status==='conflict'?'Конфлікт':doc.status==='draft'?'Чернетка':doc.status==='posted'?'Проведено':doc.is_synced?'Синхронізовано':doc.status}</Text></Pressable>)}
            {savedDocs.filter(doc=>doc.type===tab).length===0&&<View style={s.emptyState}><Text style={s.emptyIcon}>▤</Text><Text style={s.emptyTitle}>Документів поки немає</Text><Text style={s.mutedCenter}>Створіть перший документ для цього типу</Text><Pressable style={s.primaryButton} onPress={()=>newDoc()}><Text style={s.primaryButtonText}>＋ Створити документ</Text></Pressable></View>}
            <Text style={s.sectionLabel}>ПОТОЧНИЙ ДОКУМЕНТ · {items.length}</Text>{itemRows(items,true)}<Pressable style={s.scanHomeButton} onPress={()=>setScreen('detail')}><Text style={s.scanHomeText}>Відкрити поточний документ</Text></Pressable>
        </ScrollView><Pressable style={s.fab} onPress={()=>newDoc()}><Text style={s.fabText}>＋</Text></Pressable><Nav/></>
        :screen==='scan'?<><BackHeader right={<Pressable style={s.iconButton} onPress={()=>Alert.alert('Сканер','Ліхтарик: перемикається на пристрої з камерою.')}><Text style={s.iconButtonText}>ϟ</Text></Pressable>}/><ScrollView contentContainerStyle={s.pageBody}>
            {permission?.granted?<View style={s.cameraWrap}><CameraView style={s.camera} facing="back" onBarcodeScanned={scanned?undefined:({data})=>{setScanned(true);void find(data)}} barcodeScannerSettings={{barcodeTypes:['ean13','ean8','upc_a','upc_e','code128','code39','qr']}}/><View pointerEvents="none" style={s.cameraOverlay}><View style={s.scanFrame}/><Text style={s.scanCaption}>Наведіть камеру на штрихкод</Text></View></View>:<View style={s.cameraRequest}><Text style={s.emptyIcon}>▦</Text><Text style={s.emptyTitle}>Сканування штрих-коду</Text><Text style={s.mutedCenter}>Дозвольте доступ до камери</Text><Pressable style={s.primaryButton} onPress={requestPermission}><Text style={s.primaryButtonText}>Увімкнути камеру</Text></Pressable></View>}
            <View style={s.scanStatus}><Text style={s.statusGreenText}>{scanned?'Штрихкод розпізнано':'Очікування скану'}</Text><Pressable onPress={()=>setScanned(false)}><Text style={s.linkText}>Ще один</Text></Pressable></View>
            <View style={s.productRow}><View style={s.productBadge}><Text style={s.badgeText}>PNT</Text></View><View style={s.productInfo}><Text style={s.productName}>{items[items.length-1]?.name||'Товар ще не обрано'}</Text><Text style={s.productCode}>{items[items.length-1]?.sku||'Наведіть камеру або введіть код нижче'}</Text></View></View>
            <Text style={s.fieldLabel}>КІЛЬКІСТЬ У ДОКУМЕНТІ</Text><Text style={s.quantityValue}>{qty} {items[items.length-1]?.unit||'шт'}</Text><View style={s.quantityChoices}>{['-1','+1','+10'].map(value=><Pressable key={value} style={[s.quantityChoice,value==='+1'&&s.quantitySelected]} onPress={()=>setQty(String(Math.max(1,Number(qty)+(value==='-1'?-1:value==='+10'?10:1))))}><Text style={s.quantityChoiceText}>{value}</Text></Pressable>)}</View>
            <Pressable style={s.primaryButton} onPress={()=>setScreen('detail')}><Text style={s.primaryButtonText}>✓  Готово ({items.length})</Text></Pressable><Pressable style={s.textButton} onPress={()=>setScreen('search')}><Text style={s.textButtonLabel}>▤  Ввести штрихкод вручну</Text></Pressable>
            <Text style={s.fieldLabel}>РУЧНЕ ВВЕДЕННЯ</Text><TextInput style={s.input} placeholder="Штрих-код або SKU" keyboardType="default" value={manual} onChangeText={setManual}/><Pressable style={s.scanHomeButton} onPress={()=>void find(manual)}><Text style={s.scanHomeText}>Знайти й додати товар</Text></Pressable>
        </ScrollView></>
        :screen==='search'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody} keyboardShouldPersistTaps="handled"><Text style={s.fieldLabel}>ПОШУК ЗА SKU АБО НАЗВОЮ</Text><TextInput style={s.input} placeholder="Наприклад, фарба" value={query} onChangeText={setQuery} autoFocus/><Text style={s.fieldLabel}>ШТРИХ-КОД</Text><TextInput style={s.input} placeholder="13 цифр" keyboardType="number-pad" value={manual} onChangeText={setManual}/><Pressable style={s.scanHomeButton} onPress={()=>void find(manual)}><Text style={s.scanHomeText}>Знайти за штрихкодом</Text></Pressable><View style={s.sectionHeading}><Text style={s.sectionLabel}>ШВИДКИЙ ВИБІР</Text><Text style={s.linkText}>{filtered.length} товарів</Text></View>{filtered.map(product=><Pressable key={product.id} onPress={()=>{void add(product);setScreen('detail')}} style={s.productRow}><View style={s.productBadge}><Text style={s.badgeText}>PNT</Text></View><View style={s.productInfo}><Text style={s.productName}>{product.name}</Text><Text style={s.productCode}>{product.sku} · {product.barcode}</Text></View><Text style={s.linkText}>＋</Text></Pressable>)}{filtered.length===0&&<View style={s.emptyState}><Text style={s.emptyIcon}>⌕</Text><Text style={s.emptyTitle}>Нічого не знайдено</Text><Text style={s.mutedCenter}>Перевірте назву, SKU або штрихкод</Text></View>}</ScrollView></>
        :screen==='detail'?<><BackHeader right={<View style={s.headerActions}><Pressable style={s.iconButton} onPress={()=>{void Share.share({title:beginTitle,message:`${beginTitle}\n${(selectedDoc?detailItems:items).map(i=>`${i.name} — ${i.quantity} ${i.unit}`).join('\n')}`})}}><Text style={s.iconButtonText}>⎙</Text></Pressable><Pressable style={s.iconButton} onPress={deleteSelectedDoc}><Text style={s.iconButtonText}>⌫</Text></Pressable></View>}/><ScrollView contentContainerStyle={s.pageBody}><View style={s.detailHeading}><Text style={s.detailTitle}>{beginTitle}</Text><Text style={s.mutedSmall}>{warehouse}</Text><Text style={[s.statusPill,savedDocs.find(d=>d.id===selectedDoc)?.status==='conflict'&&s.statusError]}>{selectedDoc?(savedDocs.find(d=>d.id===selectedDoc)?.status==='posted'?'Проведено':'Чернетка'):'Локально'}</Text></View><View style={s.detailStats}><View style={s.detailStat}><Text style={s.detailStatLabel}>Позицій</Text><Text style={s.detailStatValue}>{selectedDoc?detailItems.length:items.length}</Text></View><View style={s.detailStat}><Text style={s.detailStatLabel}>Загальна кількість</Text><Text style={s.detailStatValue}>{(selectedDoc?detailItems:items).reduce((n,item)=>n+Number(item.quantity||0),0)}</Text></View>{tab==='inventory'&&<View style={s.detailStat}><Text style={s.detailStatLabel}>Розбіжність</Text><Text style={[s.detailStatValue,s.errorText]}>+5</Text></View>}</View><Text style={s.sectionLabel}>ВІДСКАНОВАНІ ТОВАРИ</Text>{itemRows(selectedDoc?detailItems:items,!selectedDoc||savedDocs.find(d=>d.id===selectedDoc)?.status==='draft')}{tab==='writeoff'&&<><Text style={s.fieldLabel}>ПРИЧИНА СПИСАННЯ</Text><TextInput style={s.input} placeholder="Наприклад, брак" value={docNote} onChangeText={setDocNote}/></>}<Pressable style={s.scanHomeButton} onPress={()=>setScreen('scan')}><Text style={s.scanHomeText}>▦  Сканувати штрих-код</Text></Pressable>{selectedDoc&&savedDocs.find(d=>d.id===selectedDoc)?.status==='conflict'&&<Pressable style={s.dangerButton} onPress={()=>setScreen('conflict')}><Text style={s.dangerText}>Розв’язати конфлікт</Text></Pressable>}</ScrollView><View style={s.stickyActions}><Pressable style={s.primaryButton} onPress={()=>void postCurrent()}><Text style={s.primaryButtonText}>Провести</Text></Pressable><Pressable style={s.secondaryButton} onPress={()=>setScreen('scan')}><Text style={s.secondaryButtonText}>▦  Сканувати штрих-код</Text></Pressable></View></>
        :screen==='profile'?<><View style={s.pageHeader}><Text style={s.pageTitle}>Мій профіль</Text><Pressable style={s.iconButton} onPress={()=>setScreen('settings')}><Text style={s.iconButtonText}>⚙</Text></Pressable></View><ScrollView contentContainerStyle={s.pageBody}><View style={s.profileCard}><View style={s.profileAvatar}><Text style={s.profileAvatarText}>{authUser.charAt(0).toUpperCase()}</Text></View><View style={s.productInfo}><Text style={s.profileName}>{authUser}</Text><Text style={s.productCode}>Комірник · WG-0017</Text><Text style={s.statusGreenText}>Зміна відкрита · 08:00–20:00</Text><Text style={s.productCode}>{authEmail||'worker@warego.ua'}</Text></View></View><Pressable style={s.warehouseCard} onPress={()=>Alert.alert('Оберіть склад','',[{text:'Склад №1 Київ',onPress:()=>{void chooseWarehouse('Склад №1 Київ')}},{text:'Склад №2 Львів',onPress:()=>{void chooseWarehouse('Склад №2 Львів')}},{text:'Скасувати',style:'cancel'}])}><Text style={s.warehouseIcon}>⌂</Text><View style={s.productInfo}><Text style={s.productName}>ОСНОВНИЙ СКЛАД</Text><Text style={s.actionTitle}>{warehouse}</Text></View><Text style={s.chevron}>›</Text></Pressable><View style={s.sectionHeading}><Text style={s.sectionLabel}>СТАТИСТИКА ЗМІНИ</Text><Text style={s.linkText}>{new Date().toLocaleDateString('uk-UA',{day:'numeric',month:'long'})}</Text></View><View style={s.statsRow}><View style={s.statCard}><Text style={s.statNumber}>{products.length}</Text><Text style={s.mutedSmall}>Сканів</Text></View><View style={s.statCard}><Text style={s.statNumber}>{savedDocs.length}</Text><Text style={s.mutedSmall}>Документів</Text></View><View style={s.statCard}><Text style={s.statNumber}>0</Text><Text style={s.mutedSmall}>Розбіжностей</Text></View></View><View style={s.chartCard}><Text style={s.productName}>Сканувань за годинами</Text><View style={s.chartBars}>{[28,42,34,62,48,76,54].map((h,i)=><View key={i} style={s.chartColumn}><View style={[s.chartBar,{height:h},i===5&&s.chartBarActive]}/><Text style={s.chartLabel}>{8+i}</Text></View>)}</View></View><Text style={s.sectionLabel}>РІВНІ ДОСТУПУ</Text>{[['Комірник','Сканування, документи та облік товару'],['Менеджер','Контроль складу й звітність'],['Адміністратор','Налаштування та керування доступом']].map(([role,desc],i)=><View key={role} style={s.roleCard}><View><Text style={s.productName}>{role}</Text><Text style={s.mutedSmall}>{desc}</Text></View><Text style={[s.statusPill,i===0?s.statusDone:s.statusPending]}>{i===0?'Ваш рівень':'Перегляд'}</Text></View>)}<Pressable style={s.dangerButton} onPress={()=>void signOut()}><Text style={s.dangerText}>Вийти з облікового запису</Text></Pressable></ScrollView><Nav/></>
        :screen==='settings'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><Text style={s.sectionLabel}>З’ЄДНАННЯ З СЕРВЕРОМ</Text><View style={s.sectionCard}><Text style={s.settingLabel}>IP-адреса сервера</Text><TextInput style={s.input} autoCapitalize="none" value={serverHost} onChangeText={setServerHost}/><Text style={s.settingLabel}>Порт</Text><TextInput style={s.input} keyboardType="number-pad" value={serverPort} onChangeText={setServerPort}/><Pressable style={s.yellowButton} onPress={()=>void checkConnection()}><Text style={s.yellowButtonText}>Перевірити з’єднання</Text></Pressable><View style={online?s.connectionSuccess:s.connectionOffline}><Text style={online?s.statusGreenText:s.offlineTitle}>{online?'● З’єднання встановлено':'● Немає з’єднання'}</Text><Text style={s.mutedSmall}>{online?'Сервер доступний':'Остання перевірка · '+new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</Text></View></View><Text style={s.sectionLabel}>СКАНЕР</Text><Pressable style={s.settingRow} onPress={()=>setSoundOn(v=>!v)}><Text style={s.productName}>◖  Звук сканування</Text><View style={[s.switch,soundOn&&s.switchOn]}><View style={[s.switchKnob,soundOn&&s.switchKnobOn]}/></View></Pressable><Pressable style={s.settingRow} onPress={()=>setVibrationOn(v=>!v)}><Text style={s.productName}>▣  Вібрація</Text><View style={[s.switch,vibrationOn&&s.switchOn]}><View style={[s.switchKnob,vibrationOn&&s.switchKnobOn]}/></View></Pressable><Text style={s.sectionLabel}>СИНХРОНІЗАЦІЯ</Text><View style={s.sectionCard}><Pressable style={s.settingRow} onPress={()=>void toggleAutoSync()}><View><Text style={s.productName}>Автосинхронізація</Text><Text style={s.mutedSmall}>Передавання при появі мережі</Text></View><View style={[s.switch,autoSync&&s.switchOn]}><View style={[s.switchKnob,autoSync&&s.switchKnobOn]}/></View></Pressable><Text style={s.settingLabel}>Інтервал синхронізації</Text><View style={s.intervalRow}>{['5 хв','15 хв','30 хв'].map(v=><Pressable key={v} style={[s.intervalOption,syncInterval===v&&s.intervalSelected]} onPress={()=>void chooseSyncInterval(v)}><Text style={syncInterval===v?s.intervalSelectedText:s.intervalText}>{v}</Text></Pressable>)}</View></View><Text style={s.sectionLabel}>ДАНІ НА ПРИСТРОЇ</Text><View style={s.sectionCard}><Pressable style={s.settingRow} onPress={()=>void createBackup()}><Text style={s.productName}>◌  Резервна копія бази</Text><Text style={s.linkText}>Створити</Text></Pressable><Text style={s.mutedSmall}>Експортує локальні товари й документи у форматі JSON.</Text></View><Text style={s.sectionLabel}>БЕЗПЕКА</Text><View style={s.sectionCard}><Text style={s.settingLabel}>PIN-код для входу</Text><View style={s.inlineForm}><TextInput style={[s.input,s.inlineInput]} value={pinSetup} onChangeText={v=>setPinSetup(v.replace(/\D/g,'').slice(0,4))} keyboardType="number-pad" secureTextEntry placeholder="4 цифри"/><Pressable style={s.smallGreenButton} onPress={()=>void savePin()}><Text style={s.smallGreenText}>{storedPin?'Оновити':'Зберегти'}</Text></Pressable></View><Text style={s.mutedSmall}>{storedPin?'PIN-код налаштований':'Створіть PIN для швидкого входу'}</Text></View><Pressable style={s.dangerButton} onPress={()=>void signOut()}><Text style={s.dangerText}>Вийти з облікового запису</Text></Pressable></ScrollView></>
        :screen==='files'?<><View style={s.pageHeader}><Text style={s.pageTitle}>Файли</Text></View><ScrollView contentContainerStyle={s.pageBody}><Text style={s.sectionLabel}>ФАЙЛИ ТА ІМПОРТ</Text><Pressable style={s.fileAction} onPress={()=>void exportProducts()}><Text style={s.fileIcon}>⇧</Text><Text style={s.productName}>Експорт товарів у CSV</Text><Text style={s.chevron}>›</Text></Pressable><Pressable style={s.fileAction} onPress={()=>setScreen('import')}><Text style={s.fileIcon}>⇩</Text><Text style={s.productName}>Імпорт товарів із CSV</Text><Text style={s.chevron}>›</Text></Pressable><Pressable style={s.fileAction} onPress={()=>void createBackup()}><Text style={s.fileIcon}>◌</Text><Text style={s.productName}>Створити резервну копію</Text><Text style={s.chevron}>›</Text></Pressable><Text style={s.sectionLabel}>ЛОКАЛЬНІ ДОКУМЕНТИ · {savedDocs.length}</Text>{savedDocs.map(doc=><Pressable key={doc.id} style={s.savedDocCard} onPress={()=>void openDoc(doc.id)}><View style={s.docGlyph}><Text style={s.docGlyphText}>▤</Text></View><View style={s.productInfo}><Text style={s.productName}>{doc.id.slice(0,7).toUpperCase()} · {typeLabel[doc.type]}</Text><Text style={s.productCode}>{dateLabel(doc.created_at)} · {warehouse}</Text></View><Text style={s.statusPill}>{doc.status}</Text></Pressable>)}</ScrollView><Nav/></>
        :screen==='import'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><Text style={s.mutedCenter}>Вставте CSV із колонками: SKU, Barcode, Name, Unit, Stock. Перший рядок — заголовки.</Text><TextInput style={s.csvInput} multiline textAlignVertical="top" placeholder={'SKU,Barcode,Name,Unit,Stock\nSKU-001,4820000000001,Назва товару,шт,12'} value={importText} onChangeText={setImportText}/><Pressable style={s.primaryButton} onPress={()=>void importProducts()}><Text style={s.primaryButtonText}>Імпортувати товари</Text></Pressable></ScrollView></>
        :screen==='notifications'?<><BackHeader right={<Pressable onPress={()=>setReadAll(true)}><Text style={s.linkText}>Прочитати все</Text></Pressable>}/><ScrollView contentContainerStyle={s.pageBody}><View style={s.noticeCard}><Text style={s.statusGreenText}>{online?'● Мережа з’єднана':'● Офлайн-режим'}</Text><Text style={s.productName}>Статус з’єднання</Text><Text style={s.mutedSmall}>Застосунок перевіряє сервер автоматично.</Text></View>{outboxCount>0&&!readAll&&<View style={s.noticeCard}><Text style={s.statusPending}>● Очікує синхронізації</Text><Text style={s.productName}>{outboxCount} локальних записів</Text><Pressable onPress={()=>void sync()}><Text style={s.linkText}>Синхронізувати зараз</Text></Pressable></View>}{(outboxCount===0||readAll)&&<View style={s.emptyState}><Text style={s.emptyIcon}>♧</Text><Text style={s.emptyTitle}>Усе прочитано</Text><Text style={s.mutedCenter}>Нових сповіщень немає</Text></View>}</ScrollView></>
        :screen==='conflict'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><View style={s.conflictBanner}><Text style={s.errorText}>⚠ Конфлікт синхронізації</Text><Text style={s.mutedSmall}>Дані документа змінилися локально та на сервері.</Text></View><Text style={s.sectionLabel}>ОБЕРІТЬ ВЕРСІЮ ДАНИХ</Text>{(['local','server'] as const).map(choice=><Pressable key={choice} style={[s.conflictOption,conflictChoice===choice&&s.conflictChosen]} onPress={()=>setConflictChoice(choice)}><View><Text style={s.productName}>{choice==='local'?'Локальні дані':'Серверні дані'}</Text><Text style={s.mutedSmall}>{choice==='local'?'Зміни на цьому пристрої':'Остання версія з сервера'}</Text></View><Text style={s.linkText}>{conflictChoice===choice?'◉':'○'}</Text></Pressable>)}<Pressable style={[s.primaryButton,!conflictChoice&&s.buttonDisabled]} disabled={!conflictChoice} onPress={()=>void resolveConflict()}><Text style={s.primaryButtonText}>Застосувати обрану версію</Text></Pressable></ScrollView></>
        :<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><View style={s.emptyState}><Text style={s.emptyTitle}>Дані документа відрізняються</Text></View></ScrollView></>}
    </View></SafeAreaView>;
}

function Row({ item }: { item: Partial<DocumentItem> }) {
    return (
        <View style={s.row}>
            <View style={s.productMark}>
                <Text>{item.name?.[0] || '?'}</Text>
            </View>

            <View style={{ flex: 1 }}>
                <Text style={s.actionTitle}>
                    {item.name || 'Невідомий товар'}
                </Text>
                <Text style={s.hint}>
                    {item.sku || item.barcode || 'Без коду'} · {item.unit || 'шт'}
                </Text>
            </View>

            <Text style={s.qty}>
                {item.quantity != null
                    ? `× ${item.quantity}`
                    : `${item.stock ?? 0}`}
            </Text>
        </View>
    );
}

const s = StyleSheet.create({
 root:{flex:1,backgroundColor:'#F2F3F2'},appFrame:{flex:1,backgroundColor:'#F2F3F2'},loginScreen:{flexGrow:1,justifyContent:'flex-start',paddingHorizontal:18,paddingTop:54,paddingBottom:24,backgroundColor:'#F2F3F2'},logoCube:{width:40,height:40,alignSelf:'center',alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:'#FFD33F'},logoCubeText:{fontSize:27,color:'#12715B',fontWeight:'900'},loginBrand:{fontSize:26,fontWeight:'800',color:'#12715B',textAlign:'center',marginTop:6,letterSpacing:-.5},brandGreen:{color:'#12715B'},loginSubtitle:{fontSize:10,color:'#12715B',textAlign:'center',marginTop:3},fieldLabel:{fontSize:10,color:'#6E7772',fontWeight:'600',marginTop:16,marginBottom:5,letterSpacing:.2},warehousePicker:{height:42,backgroundColor:'#fff',borderRadius:11,borderWidth:1,borderColor:'#E7EAE8',paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},warehouseText:{fontSize:12,color:'#222A26'},authTabs:{height:38,flexDirection:'row',backgroundColor:'#E9ECEA',padding:3,borderRadius:10,marginTop:14},authTab:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:8},authTabActive:{backgroundColor:'#12715B'},authTabText:{fontSize:11,color:'#12715B',fontWeight:'500'},authTabTextActive:{fontSize:11,color:'#fff',fontWeight:'700'},input:{height:42,backgroundColor:'#fff',borderWidth:1,borderColor:'#E6E9E7',borderRadius:10,paddingHorizontal:12,fontSize:12,color:'#202723',marginTop:3},primaryButton:{height:43,backgroundColor:'#12715B',borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:12,marginTop:12},primaryButtonText:{fontSize:12,fontWeight:'700',color:'#fff'},buttonDisabled:{opacity:.45},forgotLink:{alignSelf:'flex-end',color:'#12715B',fontSize:10,textDecorationLine:'underline',marginTop:10},pinPrompt:{fontSize:13,color:'#26302B',textAlign:'center',fontWeight:'600',marginTop:18},pinDots:{flexDirection:'row',justifyContent:'center',gap:11,marginVertical:12},pinDot:{width:9,height:9,borderRadius:6,borderWidth:1.5,borderColor:'#12715B'},pinDotFilled:{backgroundColor:'#12715B'},keypad:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:7,marginTop:8},keypadKey:{width:'31%',height:44,backgroundColor:'#fff',borderRadius:11,alignItems:'center',justifyContent:'center'},keypadDigit:{fontSize:16,color:'#1D2521'},mutedCenter:{fontSize:11,color:'#858D88',textAlign:'center',lineHeight:17,marginTop:5},pageHeader:{minHeight:48,flexDirection:'row',alignItems:'center',paddingHorizontal:16,justifyContent:'space-between'},backButton:{width:35,height:40,justifyContent:'center'},backGlyph:{fontSize:30,color:'#202723'},pageTitle:{fontSize:17,fontWeight:'700',color:'#1F2823'},headerRight:{marginLeft:'auto'},homeHeader:{paddingHorizontal:17,paddingTop:7,paddingBottom:11,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},warehouseInline:{marginTop:5},warehouseInlineText:{fontSize:11,fontWeight:'600',color:'#343D38'},mutedSmall:{fontSize:9,color:'#868E89',marginTop:3},headerActions:{flexDirection:'row',gap:7},iconButton:{width:35,height:35,borderRadius:9,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},iconButtonText:{fontSize:17,color:'#252C28'},unreadDot:{position:'absolute',right:7,top:7,width:6,height:6,borderRadius:4,backgroundColor:'#D95050'},homeBody:{paddingHorizontal:12,paddingBottom:18},searchBar:{height:38,backgroundColor:'#fff',borderRadius:10,borderWidth:1,borderColor:'#E6E9E7',paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},searchPlaceholder:{fontSize:11,color:'#919994'},searchGlyph:{fontSize:20,color:'#707974'},sectionLabel:{fontSize:9,fontWeight:'700',letterSpacing:.55,color:'#68716C',marginTop:15,marginBottom:7},quickGrid:{flexDirection:'row',gap:7},quickItem:{flex:1,height:65,borderRadius:11,backgroundColor:'#FFD33F',alignItems:'center',justifyContent:'center',gap:2},quickIcon:{fontSize:19,color:'#1C2620'},quickLabel:{fontSize:9,fontWeight:'700',color:'#1C2620'},onlineCard:{padding:10,borderRadius:11,borderWidth:1,marginTop:8},onlineCardOn:{backgroundColor:'#E3F4EA',borderColor:'#CBE7D6'},onlineCardOff:{backgroundColor:'#F3F5F4',borderColor:'#E0E4E1'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},rowInline:{flexDirection:'row',alignItems:'center',gap:8},onlineSymbol:{fontSize:21,color:'#12715B'},onlineTitle:{fontSize:12,fontWeight:'700',color:'#12715B'},offlineTitle:{fontSize:11,fontWeight:'700',color:'#A77D32'},syncCard:{backgroundColor:'#fff',padding:11,borderRadius:11,borderWidth:1,borderColor:'#E6E9E7',marginTop:8},syncCount:{fontSize:16,fontWeight:'800',color:'#A78524',backgroundColor:'#FFF2C4',paddingHorizontal:7,paddingVertical:4,borderRadius:7},cardTitle:{fontSize:11,fontWeight:'700',color:'#222A26'},statusPill:{fontSize:8,fontWeight:'700',color:'#6B716D',backgroundColor:'#ECEFEC',paddingVertical:4,paddingHorizontal:7,borderRadius:7,overflow:'hidden'},statusPending:{color:'#97751C',backgroundColor:'#FFF2C4'},statusDone:{color:'#14715B',backgroundColor:'#DDF2E8'},statusError:{color:'#B44141',backgroundColor:'#FBE4E3'},yellowButton:{height:39,backgroundColor:'#FFD33F',borderRadius:9,alignItems:'center',justifyContent:'center',marginTop:9},yellowButtonText:{fontSize:11,fontWeight:'700',color:'#242A26'},documentCurrent:{backgroundColor:'#E8F5EC',borderWidth:1,borderColor:'#CDE6D6',borderRadius:12,padding:11,marginTop:8},documentHeadline:{fontSize:14,fontWeight:'700',color:'#1C2822',marginTop:8},linkText:{fontSize:10,fontWeight:'700',color:'#12715B'},scanHomeButton:{height:39,backgroundColor:'#12715B',borderRadius:9,alignItems:'center',justifyContent:'center',marginTop:8},scanHomeText:{fontSize:11,fontWeight:'700',color:'#fff'},centerCaption:{fontSize:8,color:'#87918B',textAlign:'center',marginTop:5},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},savedDocCard:{minHeight:54,flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:10,padding:8,marginBottom:6,borderWidth:1,borderColor:'#E6E9E7',gap:8},docGlyph:{width:32,height:32,borderRadius:9,backgroundColor:'#DDF2E8',alignItems:'center',justifyContent:'center'},docGlyphText:{fontSize:16,color:'#12715B'},productInfo:{flex:1},productName:{fontSize:10,fontWeight:'600',color:'#252D29'},productCode:{fontSize:8,color:'#858D88',marginTop:3},statsRow:{flexDirection:'row',gap:6},statCard:{flex:1,backgroundColor:'#fff',borderRadius:9,padding:8,borderWidth:1,borderColor:'#E6E9E7'},statNumber:{fontSize:16,fontWeight:'700',color:'#1E2822'},shiftTime:{fontSize:9,color:'#858D88',textAlign:'right',marginTop:5},bottom:{height:58,backgroundColor:'#fff',borderTopWidth:1,borderColor:'#E6E9E7',flexDirection:'row',justifyContent:'space-around',alignItems:'center'},navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:1},navIcon:{fontSize:17,color:'#626C66'},navLabel:{fontSize:8,color:'#626C66'},navSelected:{color:'#12715B',fontWeight:'700'},pageBody:{paddingHorizontal:12,paddingTop:5,paddingBottom:18,flexGrow:1},docTypeGrid:{flexDirection:'row',flexWrap:'wrap',gap:6},docTypeChip:{width:'48.5%',height:35,borderRadius:9,backgroundColor:'#fff',borderWidth:1,borderColor:'#E5E9E6',paddingHorizontal:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},docTypeSelected:{backgroundColor:'#12715B',borderColor:'#12715B'},docTypeText:{fontSize:10,fontWeight:'600',color:'#12715B'},docTypeCount:{fontSize:10,fontWeight:'700',color:'#12715B'},docTypeTextOn:{color:'#fff'},filterRow:{flexDirection:'row',gap:5,marginTop:8,marginBottom:5},filterChip:{paddingVertical:6,paddingHorizontal:9,borderRadius:8,backgroundColor:'#fff'},filterSelected:{backgroundColor:'#DDF2E8'},filterText:{fontSize:9,color:'#4F5953'},filterTextOn:{fontSize:9,color:'#12715B',fontWeight:'700'},statusFilters:{flexDirection:'row',gap:4,marginTop:4,marginBottom:8},statusFilter:{flex:1,alignItems:'center',paddingVertical:6,borderRadius:7,backgroundColor:'#fff'},statusFilterOn:{backgroundColor:'#DDF2E8'},statusFilterText:{fontSize:7,color:'#5F6963'},statusFilterTextOn:{fontSize:7,color:'#12715B',fontWeight:'700'},emptyState:{alignItems:'center',justifyContent:'center',paddingVertical:42},emptyIcon:{fontSize:27,color:'#12715B',marginBottom:6},emptyTitle:{fontSize:13,fontWeight:'700',color:'#252D29',marginBottom:4},fab:{position:'absolute',right:17,bottom:70,width:44,height:44,borderRadius:13,backgroundColor:'#FFD33F',alignItems:'center',justifyContent:'center',elevation:3},fabText:{fontSize:26,color:'#1F2823',marginTop:-2},cameraWrap:{height:300,borderRadius:14,overflow:'hidden',backgroundColor:'#14241D'},camera:{position:'absolute',top:0,right:0,bottom:0,left:0},cameraOverlay:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',paddingTop:70},scanFrame:{width:'75%',height:132,borderWidth:2,borderColor:'#51CA91',borderRadius:15},scanCaption:{fontSize:10,color:'#fff',textAlign:'center',marginTop:13},cameraRequest:{height:260,backgroundColor:'#fff',borderRadius:14,alignItems:'center',justifyContent:'center',padding:16,borderWidth:1,borderColor:'#E5E9E6'},scanStatus:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:9},statusGreenText:{fontSize:9,fontWeight:'700',color:'#14715B'},productRow:{minHeight:52,flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:10,padding:8,marginBottom:6,borderWidth:1,borderColor:'#E6E9E7',gap:7},productBadge:{width:30,height:30,borderRadius:8,backgroundColor:'#DDF2E8',alignItems:'center',justifyContent:'center'},badgeText:{fontSize:8,fontWeight:'800',color:'#12715B'},qty:{fontSize:10,fontWeight:'700',color:'#202723'},qtyControl:{flexDirection:'row',alignItems:'center',gap:6},qtyButton:{width:24,height:24,borderRadius:7,backgroundColor:'#F1F3F1',alignItems:'center',justifyContent:'center'},qtyNumber:{fontSize:11,fontWeight:'700',color:'#202723',minWidth:12,textAlign:'center'},quantityValue:{fontSize:18,fontWeight:'700',color:'#1E2822',marginTop:2},quantityChoices:{flexDirection:'row',gap:7,marginTop:5},quantityChoice:{flex:1,height:39,backgroundColor:'#fff',borderRadius:9,borderWidth:1,borderColor:'#E6E9E7',alignItems:'center',justifyContent:'center'},quantitySelected:{backgroundColor:'#DDF2E8',borderColor:'#8FCEAE'},quantityChoiceText:{fontSize:11,color:'#24302A',fontWeight:'600'},textButton:{alignItems:'center',paddingVertical:10},textButtonLabel:{fontSize:10,color:'#58645D'},detailHeading:{backgroundColor:'#fff',borderRadius:11,padding:11,borderWidth:1,borderColor:'#E6E9E7'},detailTitle:{fontSize:14,fontWeight:'700',color:'#1D2822'},detailStats:{flexDirection:'row',gap:7,backgroundColor:'#fff',borderRadius:11,padding:11,marginTop:8},detailStat:{flex:1},detailStatLabel:{fontSize:8,color:'#78817B'},detailStatValue:{fontSize:16,fontWeight:'700',color:'#1F2823',marginTop:4},errorText:{color:'#C74747'},stickyActions:{backgroundColor:'#F2F3F2',paddingHorizontal:12,paddingVertical:5},secondaryButton:{height:39,backgroundColor:'#fff',borderRadius:9,alignItems:'center',justifyContent:'center',marginTop:7,borderWidth:1,borderColor:'#DDE4E0'},secondaryButtonText:{fontSize:10,fontWeight:'700',color:'#12715B'},profileCard:{backgroundColor:'#fff',borderRadius:12,padding:12,flexDirection:'row',gap:10,alignItems:'center',borderWidth:1,borderColor:'#E6E9E7'},profileAvatar:{width:43,height:43,borderRadius:14,backgroundColor:'#FFD33F',alignItems:'center',justifyContent:'center'},profileAvatarText:{fontSize:19,fontWeight:'800',color:'#26302A'},profileName:{fontSize:12,fontWeight:'700',color:'#222A26'},warehouseCard:{backgroundColor:'#fff',borderRadius:11,padding:10,flexDirection:'row',alignItems:'center',gap:8,marginTop:8},warehouseIcon:{width:31,height:31,textAlign:'center',textAlignVertical:'center',backgroundColor:'#DDF2E8',borderRadius:9,color:'#12715B',fontSize:17},chartCard:{backgroundColor:'#fff',borderRadius:11,padding:11,marginTop:10},chartBars:{height:93,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-around',marginTop:6},chartColumn:{alignItems:'center',gap:3},chartBar:{width:16,borderTopLeftRadius:4,borderTopRightRadius:4,backgroundColor:'#202723'},chartBarActive:{backgroundColor:'#12715B'},chartLabel:{fontSize:7,color:'#858D88'},roleCard:{minHeight:47,backgroundColor:'#fff',borderRadius:10,padding:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:5},dangerButton:{height:40,backgroundColor:'#FBE4E3',borderRadius:9,alignItems:'center',justifyContent:'center',marginTop:10},dangerText:{fontSize:10,fontWeight:'700',color:'#BB4646'},sectionCard:{backgroundColor:'#fff',borderRadius:11,padding:11,borderWidth:1,borderColor:'#E6E9E7',marginBottom:7},settingLabel:{fontSize:9,color:'#7B847E',marginTop:7},settingRow:{minHeight:43,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#EDF0EE',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:9},switch:{width:37,height:21,borderRadius:12,backgroundColor:'#B8C1BB',padding:2,justifyContent:'center'},switchOn:{backgroundColor:'#12715B'},switchKnob:{width:17,height:17,borderRadius:9,backgroundColor:'#fff'},switchKnobOn:{alignSelf:'flex-end'},connectionSuccess:{backgroundColor:'#E3F4EA',borderRadius:9,padding:9,marginTop:9},connectionOffline:{backgroundColor:'#FFF5DC',borderRadius:9,padding:9,marginTop:9},intervalRow:{flexDirection:'row',gap:5,marginTop:8},intervalOption:{flex:1,height:31,backgroundColor:'#F1F3F1',alignItems:'center',justifyContent:'center',borderRadius:8},intervalSelected:{backgroundColor:'#DDF2E8'},intervalText:{fontSize:9,color:'#59625D'},intervalSelectedText:{fontSize:9,color:'#12715B',fontWeight:'700'},inlineForm:{flexDirection:'row',gap:7,alignItems:'center'},inlineInput:{flex:1},smallGreenButton:{height:36,paddingHorizontal:13,borderRadius:8,backgroundColor:'#12715B',alignItems:'center',justifyContent:'center'},smallGreenText:{fontSize:9,color:'#fff',fontWeight:'700'},fileAction:{minHeight:45,backgroundColor:'#fff',borderRadius:10,padding:9,flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},fileIcon:{width:28,height:28,textAlign:'center',textAlignVertical:'center',backgroundColor:'#DDF2E8',borderRadius:8,color:'#12715B',fontSize:17},csvInput:{minHeight:230,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E7E4',borderRadius:10,padding:11,fontSize:11,color:'#202723',marginTop:12},noticeCard:{backgroundColor:'#fff',borderRadius:10,borderWidth:1,borderColor:'#E6E9E7',padding:11,marginBottom:8,gap:5},conflictBanner:{backgroundColor:'#FBE4E3',borderWidth:1,borderColor:'#F1C2C0',borderRadius:10,padding:11},conflictOption:{minHeight:57,backgroundColor:'#fff',borderWidth:1,borderColor:'#E6E9E7',borderRadius:10,padding:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8},conflictChosen:{backgroundColor:'#E3F4EA',borderColor:'#8DCEAA'},
 loginBox:{flex:1,justifyContent:'center',padding:24,backgroundColor:'#fff'},brand:{fontSize:21,fontWeight:'800',color:'#12715B'},sub:{fontSize:9,color:'#858D88',marginTop:4},net:{paddingVertical:6,paddingHorizontal:9,borderRadius:18},body:{padding:14,paddingBottom:24},eyebrow:{fontSize:9,color:'#858D88',letterSpacing:1,fontWeight:'700'},title:{fontSize:21,fontWeight:'700',color:'#202723',marginTop:7},hint:{fontSize:10,color:'#858D88',marginTop:4},syncBox:{backgroundColor:'#fff',padding:14,borderRadius:11,borderWidth:1,borderColor:'#E6E9E7',marginTop:15},syncTitle:{fontSize:12,fontWeight:'700',color:'#202723'},outline:{minHeight:39,borderWidth:1,borderColor:'#DDE4E0',borderRadius:9,alignItems:'center',justifyContent:'center',marginTop:9,paddingHorizontal:10,backgroundColor:'#fff'},outlineText:{color:'#12715B',fontSize:10,fontWeight:'700'},section:{fontSize:9,letterSpacing:.8,color:'#858D88',fontWeight:'700',marginTop:16,marginBottom:8},action:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E6E9E7',padding:10,borderRadius:10,flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},actionIcon:{width:31,height:31,textAlign:'center',textAlignVertical:'center',fontSize:18,color:'#12715B',backgroundColor:'#DDF2E8',borderRadius:8,overflow:'hidden'},actionTitle:{fontSize:11,fontWeight:'600',color:'#26302A'},chevron:{fontSize:20,color:'#8B938E'},docCard:{backgroundColor:'#fff',borderRadius:11,padding:12,borderWidth:1,borderColor:'#E6E9E7'},darkButton:{minHeight:41,backgroundColor:'#12715B',borderRadius:9,alignItems:'center',justifyContent:'center',paddingHorizontal:11,marginTop:9},darkText:{color:'#fff',fontWeight:'700',fontSize:10},profile:{flexDirection:'row',alignItems:'center',gap:9,marginTop:15,paddingVertical:10,borderTopWidth:1,borderColor:'#E6E9E7'},avatar:{width:33,height:33,borderRadius:17,backgroundColor:'#FFD33F',textAlign:'center',textAlignVertical:'center',color:'#26302A',fontWeight:'700'},row:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E6E9E7',borderRadius:9,padding:9,flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},productMark:{width:29,height:29,borderRadius:7,backgroundColor:'#DDF2E8',alignItems:'center',justifyContent:'center'},tabs:{flexDirection:'row',flexWrap:'wrap',gap:4},tab:{flex:1,minWidth:'47%',paddingVertical:7,paddingHorizontal:3,alignItems:'center',borderRadius:7,backgroundColor:'#fff'},tabActive:{backgroundColor:'#12715B'},tabText:{fontSize:9,color:'#12715B',textAlign:'center'},tabTextActive:{fontSize:9,fontWeight:'700',color:'#fff',textAlign:'center'}
});

export default App;

