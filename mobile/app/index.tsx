
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext, SQLiteProvider } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Android emulators reach the host computer through 10.0.2.2. Physical
// devices can use their computer's LAN address from Settings.
const API = Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://localhost:8000/api';

type Screen = 'home' | 'scan' | 'search' | 'docs' | 'settings';
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
    const [token, setToken] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authUser, setAuthUser] = useState('Комірник');

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
                Alert.alert(
                    'Помилка бази даних',
                    getErrorMessage(error)
                );
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

                if (!active) return;

                // Older builds persisted a machine-specific LAN IP. It goes
                // stale when the server moves or the app runs in an emulator.
                const isStaleDefault = savedUrl === 'http://192.168.7.13:8000/api';
                if (savedUrl && !isStaleDefault) {
                    setServerUrl(savedUrl);
                    setServerDraft(savedUrl);
                } else if (isStaleDefault) {
                    await AsyncStorage.setItem('serverUrl', API);
                }

                if (savedToken) {
                    setToken(savedToken);
                }

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
            await db.runAsync(
                `INSERT INTO lines
                    (document_id, product_id, quantity, unit)
                 VALUES (?, ?, ?, ?)`,
                ['active', product.id, quantity, product.unit || 'шт']
            );

            const nextItem: DocumentItem = {
                ...product,
                quantity,
            };

            setItems(previous => [...previous, nextItem]);

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

    const sync = async (): Promise<void> => {
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
                Alert.alert(
                    'Синхронізація',
                    'Немає документів для передавання.'
                );
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
        if (online && token) {
            sync();
        }
    }, [online, token]);

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
        const value = serverDraft.trim().replace(/\/+$/, '');

        if (!/^https?:\/\/.+/i.test(value)) {
            Alert.alert(
                'Некоректна адреса',
                'Введіть адресу сервера, що починається з http:// або https://.'
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

    const save = async (): Promise<void> => {
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
                status: 'draft',
                warehouse: 1,
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
                        (id, type, status, warehouse, created_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [id, tab, 'draft', 1, createdAt]
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
            setScreen('home');

            Alert.alert(
                'Збережено офлайн',
                'Документ збережено на пристрої. Його можна синхронізувати пізніше.'
            );

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

    if (!token) {
        return (
            <View style={s.root}>
                <StatusBar style="dark" />

                <View style={s.loginBox}>
                    <Text style={s.brand}>
                        stock<Text style={{ color: '#68ae83' }}>flow</Text>
                    </Text>

                    <Text style={s.title}>Вхід до складу</Text>

                    <Text style={s.hint}>
                        Увійдіть, щоб працювати з документами та синхронізацією.
                    </Text>

                    <TextInput
                        style={s.input}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="Робочий email"
                        value={authEmail}
                        onChangeText={setAuthEmail}
                    />

                    <TextInput
                        style={s.input}
                        secureTextEntry
                        placeholder="Пароль"
                        value={authPassword}
                        onChangeText={setAuthPassword}
                        onSubmitEditing={signIn}
                    />

                    <Pressable style={s.darkButton} onPress={signIn}>
                        <Text style={s.darkText}>Увійти</Text>
                    </Pressable>

                    <Text style={s.hint}>
                        Після першого входу сесія зберігається для офлайн-роботи.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={s.root}>
            <StatusBar style="dark" />

            <View style={s.header}>
                <View>
                    <Text style={s.brand}>
                        stock<Text style={{ color: '#68ae83' }}>flow</Text>
                    </Text>

                    <Text style={s.sub}>ЦЕНТРАЛЬНИЙ СКЛАД · КИЇВ</Text>
                </View>

                <View
                    style={[
                        s.net,
                        { backgroundColor: online ? '#e7f4eb' : '#fbf0df' },
                    ]}
                >
                    <Text style={{ color: online ? '#43845b' : '#ae7b39' }}>
                        ● {online ? 'Онлайн' : 'Офлайн'}
                    </Text>
                </View>
            </View>

            {screen === 'home' ? (
                <ScrollView contentContainerStyle={s.body}>
                    <Text style={s.eyebrow}>РОБОЧИЙ ПРОСТІР</Text>
                    <Text style={s.title}>Вітаємо, {authUser}</Text>
                    <Text style={s.hint}>
                        Зміни збережуться на цьому пристрої.
                    </Text>

                    <View style={s.syncBox}>
                        <Text style={s.syncTitle}>Синхронізація</Text>
                        <Text style={s.hint}>
                            Документів у черзі · {syncing ? 'синхронізація...' : 'готово до перевірки'}
                        </Text>

                        <Pressable
                            style={s.outline}
                            onPress={sync}
                            disabled={syncing}
                        >
                            <Text style={s.outlineText}>
                                {syncing ? 'Синхронізація...' : '↻ Синхронізувати зараз'}
                            </Text>
                        </Pressable>
                    </View>

                    <Text style={s.section}>ШВИДКІ ДІЇ</Text>

                    <Pressable
                        style={s.action}
                        onPress={() => setScreen('scan')}
                    >
                        <Text style={s.actionIcon}>▦</Text>

                        <View style={{ flex: 1 }}>
                            <Text style={s.actionTitle}>Сканувати товар</Text>
                            <Text style={s.hint}>
                                Додати позицію до документа
                            </Text>
                        </View>

                        <Text style={s.chevron}>›</Text>
                    </Pressable>

                    <Pressable
                        style={s.action}
                        onPress={() => {
                            setScreen('docs');
                            setTab('receipt');
                        }}
                    >
                        <Text style={s.actionIcon}>▤</Text>

                        <View style={{ flex: 1 }}>
                            <Text style={s.actionTitle}>
                                Складські документи
                            </Text>
                            <Text style={s.hint}>
                                Прихід, списання, інвентаризація
                            </Text>
                        </View>

                        <Text style={s.chevron}>›</Text>
                    </Pressable>

                    <Pressable
                        style={s.action}
                        onPress={() => setScreen('search')}
                    >
                        <Text style={s.actionIcon}>⌕</Text>

                        <View style={{ flex: 1 }}>
                            <Text style={s.actionTitle}>Знайти товар</Text>
                            <Text style={s.hint}>
                                Пошук за назвою, SKU чи кодом
                            </Text>
                        </View>

                        <Text style={s.chevron}>›</Text>
                    </Pressable>

                    <Text style={s.section}>АКТИВНИЙ ДОКУМЕНТ</Text>

                    <View style={s.docCard}>
                        <Text style={s.actionTitle}>
                            {documentTabs.find(([key]) => key === tab)?.[1] || 'Прихід товарів'}
                        </Text>
                        <Text style={s.hint}>
                            {items.length} позицій · Чернетка
                        </Text>

                        <Pressable
                            style={s.darkButton}
                            onPress={() => setScreen('docs')}
                        >
                            <Text style={s.darkText}>
                                Продовжити документ
                            </Text>
                        </Pressable>
                    </View>

                    <Pressable
                        style={s.profile}
                        onPress={() => setScreen('settings')}
                    >
                        <Text style={s.avatar}>
                            {authUser.charAt(0).toUpperCase()}
                        </Text>

                        <View style={{ flex: 1 }}>
                            <Text style={s.actionTitle}>{authUser}</Text>
                            <Text style={s.hint}>
                                Комірник · Центральний склад
                            </Text>
                        </View>

                        <Text style={s.chevron}>›</Text>
                    </Pressable>
                </ScrollView>
            ) : (
                <>
                    <View style={s.subheader}>
                        <Pressable onPress={() => setScreen('home')}>
                            <Text style={s.back}>‹ Назад</Text>
                        </Pressable>

                        <Text style={s.subTitle}>
                            {screen === 'scan'
                                ? 'Сканування'
                                : screen === 'search'
                                    ? 'Пошук товару'
                                    : screen === 'docs'
                                        ? 'Документ'
                                        : 'Налаштування'}
                        </Text>

                        <View style={{ width: 50 }} />
                    </View>

                    {screen === 'scan' ? (
                        <ScrollView contentContainerStyle={s.body}>
                            {permission?.granted ? (
                                <CameraView
                                    style={s.camera}
                                    facing="back"
                                    onBarcodeScanned={
                                        scanned
                                            ? undefined
                                            : ({ data }) => {
                                                setScanned(true);
                                                void find(data);
                                            }
                                    }
                                    barcodeScannerSettings={{
                                        barcodeTypes: [
                                            'ean13',
                                            'ean8',
                                            'upc_a',
                                            'upc_e',
                                            'code128',
                                            'code39',
                                            'qr',
                                        ],
                                    }}
                                >
                                    <View style={s.scanFrame} />
                                </CameraView>
                            ) : (
                                <View style={s.cameraRequest}>
                                    <Text style={s.actionTitle}>
                                        Доступ до камери
                                    </Text>

                                    <Text style={s.hint}>
                                        Потрібен для зчитування штрих-коду.
                                    </Text>

                                    <Pressable
                                        style={s.darkButton}
                                        onPress={requestPermission}
                                    >
                                        <Text style={s.darkText}>
                                            Дозволити камеру
                                        </Text>
                                    </Pressable>
                                </View>
                            )}

                            <Pressable
                                style={s.outline}
                                onPress={() => setScanned(false)}
                            >
                                <Text style={s.outlineText}>
                                    Сканувати наступний товар
                                </Text>
                            </Pressable>

                            <Text style={s.section}>РУЧНЕ ВВЕДЕННЯ</Text>

                            <TextInput
                                style={s.input}
                                placeholder="Штрих-код або SKU"
                                value={manual}
                                onChangeText={setManual}
                            />

                            <TextInput
                                style={s.input}
                                placeholder="Кількість"
                                keyboardType="decimal-pad"
                                value={qty}
                                onChangeText={setQty}
                            />

                            <Pressable
                                style={s.darkButton}
                                onPress={() => void find(manual)}
                            >
                                <Text style={s.darkText}>
                                    Знайти й додати товар
                                </Text>
                            </Pressable>

                            <Text style={s.section}>
                                ПОЗИЦІЇ · {items.length}
                            </Text>

                            {items.map((item, index) => (
                                <Row
                                    key={item.line_id ?? `${item.id}-${index}`}
                                    item={item}
                                />
                            ))}
                        </ScrollView>
                    ) : screen === 'search' ? (
                        <ScrollView contentContainerStyle={s.body}>
                            <TextInput
                                style={s.input}
                                placeholder="Назва, SKU або штрих-код"
                                value={query}
                                onChangeText={setQuery}
                            />

                            {filtered.map(product => (
                                <Pressable
                                    key={product.id}
                                    onPress={() => void add(product)}
                                >
                                    <Row item={product} />
                                </Pressable>
                            ))}

                            {filtered.length === 0 && (
                                <Text style={s.hint}>
                                    Товарів не знайдено.
                                </Text>
                            )}
                        </ScrollView>
                    ) : screen === 'docs' ? (
                        <ScrollView contentContainerStyle={s.body}>
                            <View style={s.tabs}>
                                {documentTabs.map(([key, label]) => (
                                    <Pressable
                                        style={[
                                            s.tab,
                                            key === tab && s.tabActive,
                                        ]}
                                        key={key}
                                        onPress={() => setTab(key)}
                                    >
                                        <Text
                                            style={
                                                key === tab
                                                    ? s.tabTextActive
                                                    : s.tabText
                                            }
                                        >
                                            {label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={s.section}>
                                ТОВАРИ · {items.length}
                            </Text>

                            {items.map((item, index) => (
                                <Row
                                    key={item.line_id ?? `${item.id}-${index}`}
                                    item={item}
                                />
                            ))}

                            <Pressable
                                style={s.outline}
                                onPress={() => setScreen('search')}
                            >
                                <Text style={s.outlineText}>
                                    ＋ Додати товар вручну
                                </Text>
                            </Pressable>

                            <Pressable style={s.darkButton} onPress={() => void save()}>
                                <Text style={s.darkText}>
                                    Зберегти чернетку офлайн
                                </Text>
                            </Pressable>
                        </ScrollView>
                    ) : (
                        <ScrollView contentContainerStyle={s.body}>
                            <Text style={s.actionTitle}>
                                Склад: Центральний склад
                            </Text>

                            <Text style={s.hint}>Адреса сервера API</Text>

                            <TextInput
                                style={s.input}
                                autoCapitalize="none"
                                keyboardType="url"
                                value={serverDraft}
                                onChangeText={setServerDraft}
                            />

                            <Pressable
                                style={s.darkButton}
                                onPress={() => void saveServer()}
                            >
                                <Text style={s.darkText}>
                                    Зберегти адресу
                                </Text>
                            </Pressable>

                            <Pressable
                                style={s.outline}
                                onPress={() => void sync()}
                            >
                                <Text style={s.outlineText}>
                                    Перевірити синхронізацію
                                </Text>
                            </Pressable>

                            <Pressable
                                style={s.outline}
                                onPress={() => void signOut()}
                            >
                                <Text style={s.outlineText}>
                                    Вийти з облікового запису
                                </Text>
                            </Pressable>
                        </ScrollView>
                    )}
                </>
            )}

            <View style={s.bottom}>
                <Pressable onPress={() => setScreen('home')}>
                    <Text style={screen === 'home' ? s.bottomOn : s.bottomOff}>
                        ⌂ Головна
                    </Text>
                </Pressable>

                <Pressable onPress={() => setScreen('docs')}>
                    <Text style={screen === 'docs' ? s.bottomOn : s.bottomOff}>
                        ▤ Документи
                    </Text>
                </Pressable>

                <Pressable onPress={() => setScreen('search')}>
                    <Text style={screen === 'search' ? s.bottomOn : s.bottomOff}>
                        ⌕ Товари
                    </Text>
                </Pressable>

                <Pressable onPress={() => setScreen('settings')}>
                    <Text style={screen === 'settings' ? s.bottomOn : s.bottomOff}>
                        ⚙ Профіль
                    </Text>
                </Pressable>
            </View>
        </View>
    );
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
    root: {
        flex: 1,
        backgroundColor: '#f5f7f4',
    },
    loginBox: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#fff',
    },
    header: {
        paddingTop: 58,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e8ece7',
    },
    brand: {
        fontSize: 21,
        fontWeight: '800',
        letterSpacing: -1,
        color: '#183e33',
    },
    sub: {
        fontSize: 8,
        letterSpacing: 1,
        color: '#949d95',
        marginTop: 4,
    },
    net: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderRadius: 20,
    },
    body: {
        padding: 18,
        paddingBottom: 30,
    },
    eyebrow: {
        fontSize: 9,
        color: '#8f9a91',
        letterSpacing: 1.2,
        fontWeight: '700',
    },
    title: {
        fontSize: 25,
        fontWeight: '700',
        color: '#26332b',
        marginTop: 7,
    },
    hint: {
        fontSize: 11,
        color: '#929a93',
        marginTop: 4,
    },
    syncBox: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e8ece7',
        marginTop: 20,
    },
    syncTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#27362d',
    },
    outline: {
        minHeight: 40,
        borderWidth: 1,
        borderColor: '#dce4dc',
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
    },
    outlineText: {
        color: '#3e7955',
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    section: {
        fontSize: 9,
        letterSpacing: 1,
        color: '#939c94',
        fontWeight: '700',
        marginTop: 23,
        marginBottom: 9,
    },
    action: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e8ece7',
        padding: 13,
        borderRadius: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        marginBottom: 8,
    },
    actionIcon: {
        width: 35,
        height: 35,
        textAlign: 'center',
        textAlignVertical: 'center',
        fontSize: 20,
        color: '#4b8861',
        backgroundColor: '#eef5ef',
        borderRadius: 8,
        overflow: 'hidden',
    },
    actionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#354139',
    },
    chevron: {
        fontSize: 22,
        color: '#9ba39c',
    },
    docCard: {
        backgroundColor: '#fff',
        borderRadius: 9,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e8ece7',
    },
    darkButton: {
        minHeight: 43,
        backgroundColor: '#194a3b',
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        marginTop: 14,
    },
    darkText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 11,
        textAlign: 'center',
    },
    profile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 24,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#e5e9e4',
    },
    avatar: {
        width: 34,
        height: 34,
        borderRadius: 18,
        backgroundColor: '#dcebe1',
        textAlign: 'center',
        textAlignVertical: 'center',
        color: '#286246',
        fontWeight: '700',
    },
    bottom: {
        minHeight: 59,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e7ebe6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 10,
    },
    bottomOn: {
        color: '#36774f',
        fontSize: 10,
        fontWeight: '700',
    },
    bottomOff: {
        color: '#969d96',
        fontSize: 10,
    },
    subheader: {
        height: 49,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderColor: '#e8ece7',
    },
    back: {
        fontSize: 11,
        color: '#4a805d',
    },
    subTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    camera: {
        height: 260,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#14251d',
    },
    scanFrame: {
        alignSelf: 'center',
        marginTop: 55,
        width: 220,
        height: 150,
        borderWidth: 2,
        borderColor: '#84d19a',
        borderRadius: 15,
    },
    cameraRequest: {
        minHeight: 200,
        backgroundColor: '#eaf0e9',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        gap: 6,
    },
    input: {
        minHeight: 43,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e7e1',
        borderRadius: 7,
        paddingHorizontal: 12,
        marginTop: 9,
        fontSize: 12,
        color: '#26332b',
    },
    row: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e8ece7',
        borderRadius: 8,
        padding: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 7,
    },
    productMark: {
        width: 31,
        height: 31,
        borderRadius: 7,
        backgroundColor: '#edf4eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qty: {
        fontSize: 12,
        fontWeight: '700',
        color: '#447d58',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#e9eee8',
        padding: 3,
        borderRadius: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 2,
        alignItems: 'center',
        borderRadius: 6,
    },
    tabActive: {
        backgroundColor: '#fff',
    },
    tabText: {
        fontSize: 9,
        color: '#788179',
        textAlign: 'center',
    },
    tabTextActive: {
        fontSize: 9,
        fontWeight: '700',
        color: '#37704e',
        textAlign: 'center',
    },
});

export default App;
