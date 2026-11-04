import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, Share, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../../components/Icon';
import NewDocumentSheet from '../../components/NewDocumentSheet';
import s from '../styles';
import { API, documentTabs, uuid, getErrorMessage } from '../domain';
import type { Screen, DocumentType, Product, DocumentItem, OutboxRow, UserData, LoginResponse, DialogAction, AppDialog } from '../domain';

export default function WorkerScreen() {
    const { width: screenWidth } = useWindowDimensions();
    const compactLayout = screenWidth < 380;
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
    const [onlineMode, setOnlineMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showNewDoc, setShowNewDoc] = useState(false);

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
    const [filesTab, setFilesTab] = useState<'price' | 'invoice' | 'export'>('price');
    const [folderName, setFolderName] = useState('');
    const [customFolders, setCustomFolders] = useState<string[]>([]);
    const [dialog, setDialog] = useState<AppDialog | null>(null);

    const showDialog = (title: string, message = '', actions: DialogAction[] = [{ label: 'Зрозуміло', tone: 'primary' }], kind: AppDialog['kind'] = 'info'): void => {
        setDialog({ title, message, actions, kind });
    };
    const chooseWarehouseDialog = (): void => showDialog('Оберіть склад', 'Виберіть філію для поточного документа.', [
        ...['Склад №1 Київ', 'Склад №2 Львів'].map(value => ({ label: value, onPress: () => { void chooseWarehouse(value); setDialog(null); }, tone: 'neutral' as const })),
        { label: 'Скасувати', tone: 'primary' },
    ], 'sheet');
    const runDialogAction = async (action: DialogAction): Promise<void> => {
        try { setDialog(null); await action.onPress?.(); }
        catch (error) { showDialog('Не вдалося виконати дію', getErrorMessage(error), undefined, 'error'); }
    };
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
            showDialog('Перевірте кількість', 'Введіть коректну кількість товару.', undefined, 'error');
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

            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            showDialog('Не вдалося додати товар', getErrorMessage(error), undefined, 'error');
        }
    };

    const find = async (term: string): Promise<boolean> => {
        const value = term.trim();

        if (!value) {
            showDialog('Що шукаємо?', 'Введіть штрих-код або назву товару.', undefined, 'error');
            setScanned(false);
            return false;
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
                if (screen === 'scan') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                return true;
            } else {
                if (screen === 'scan') {
                    showDialog('Штрихкод не знайдено', `У каталозі немає товару з кодом ${value}. Додайте товар до каталогу й відскануйте його ще раз.`, undefined, 'error');
                } else {
                    showDialog('Товар не знайдено', 'Перевірте штрих-код або назву.', undefined, 'error');
                }
                return false;
            }
        } catch (error) {
            showDialog('Помилка пошуку', getErrorMessage(error), undefined, 'error');
            return false;
        }
    };

    const sync = async (showEmptyQueueMessage = true): Promise<void> => {
        if (syncing) return;

        if (!token) {
            showDialog('Потрібен вхід', 'Увійдіть до облікового запису перед синхронізацією.', [{ label: 'Зрозуміло', tone: 'primary' }], 'error');
            return;
        }

        setSyncing(true);

        try {
            const pending = await db.getAllAsync<OutboxRow>(
                'SELECT * FROM outbox ORDER BY created_at'
            );

            if (pending.length === 0) {
                if (showEmptyQueueMessage) showDialog('Усе синхронізовано', 'Немає документів, що очікують передавання.', undefined, 'success');
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
                    showDialog('Потрібен повторний вхід', 'Сервер відхилив токен доступу. Увійдіть знову.', undefined, 'error');
                    return;
                }

                if (response.status === 409) {
                    await db.runAsync("UPDATE documents SET status = 'conflict' WHERE id = ?", [entry.id]);
                    await refreshDocs();
                    showDialog('Конфлікт синхронізації', 'Сервер і пристрій мають різні зміни. Відкрийте документ і оберіть потрібну версію.', [{ label: 'До документів', tone: 'primary', onPress: () => setScreen('docs') }], 'error');
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

            showDialog('Синхронізацію завершено', `Передано документів: ${synced}.`, undefined, 'success');
            await refreshDocs();
        } catch (error) {
            showDialog('Не вдалося синхронізувати', getErrorMessage(error), undefined, 'error');
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        if (autoSync && onlineMode && online && token) {
            void sync(false);
        }
    }, [onlineMode, online, token, autoSync]);

    useEffect(() => {
        if (!autoSync || !onlineMode || !online || !token) return;
        const minutes = Number.parseInt(syncInterval, 10) || 15;
        const timer = setInterval(() => void sync(false), minutes * 60 * 1000);
        return () => clearInterval(timer);
    }, [autoSync, onlineMode, online, token, syncInterval]);

    const signIn = async (): Promise<void> => {
        const email = authEmail.trim().toLowerCase();
        const password = authPassword;

        if (!email || !password) {
            showDialog('Введіть дані для входу', 'Вкажіть email і пароль, щоб продовжити.', undefined, 'error');
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
            showDialog('Не вдалося увійти', `${getErrorMessage(error)}\n\nПеревірте, що API запущений на комп’ютері.`, undefined, 'error');
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
            showDialog('Не вдалося вийти', getErrorMessage(error), undefined, 'error');
        }
    };

    const saveServer = async (): Promise<void> => {
        const host = serverHost.trim();
        const port = serverPort.trim();
        const value = `http://${host}:${port}/api`;

        if (!host || !/^\d{2,5}$/.test(port) || Number(port) > 65535) {
            showDialog('Некоректна адреса', 'Введіть адресу сервера та порт від 1 до 65535.', undefined, 'error');
            return;
        }

        try {
            await AsyncStorage.setItem('serverUrl', value);
            setServerUrl(value);
            setServerDraft(value);

            showDialog('Збережено', 'Адресу сервера оновлено.', undefined, 'success');
        } catch (error) {
            showDialog('Сталася помилка', getErrorMessage(error), undefined, 'error');
        }
    };

    const checkConnection = async (): Promise<void> => {
        const host = serverHost.trim();
        const port = serverPort.trim();
        if (!host || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
            showDialog('Перевірте адресу сервера', 'Вкажіть коректну IP-адресу та порт.', undefined, 'error');
            return;
        }
        const value = `http://${host}:${port}/api`;
        setServerDraft(value); setServerUrl(value);
        await AsyncStorage.setItem('serverUrl', value);
        try {
            const response = await fetch(`${value}/health/`);
            setOnline(response.ok);
            showDialog(response.ok ? 'З’єднання встановлено' : 'Сервер недоступний', response.ok ? 'WareGo підключено до сервера.' : `Сервер повернув ${response.status}.`, undefined, response.ok ? 'success' : 'error');
        } catch (error) {
            setOnline(false); showDialog('Немає з’єднання', getErrorMessage(error), undefined, 'error');
        }
    };

    const save = async (status: 'draft' | 'posted' = 'draft'): Promise<void> => {
        if (items.length === 0) {
            showDialog('Порожній документ', 'Спочатку додайте хоча б один товар.', undefined, 'error');
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

            showDialog(status === 'posted' ? 'Документ проведено' : 'Збережено офлайн',
                status === 'posted' ? 'Документ збережено та додано до черги синхронізації.' : 'Документ збережено на пристрої. Його можна синхронізувати пізніше.', undefined, 'success');

            if (online && token) {
                sync();
            }
        } catch (error) {
            showDialog('Помилка збереження', getErrorMessage(error), undefined, 'error');
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
    const startDoc = (kind:DocumentType) => { setShowNewDoc(false); setTab(kind); setSelectedDoc(null); setScreen('detail'); };
    const newDoc = () => setShowNewDoc(true);
    const chooseWarehouse = async (value:string): Promise<void> => { setWarehouse(value); await AsyncStorage.setItem('sf_warehouse', value); };
    const unlockWithPin = (): void => {
        if (pinEntry.length !== 4) return;
        if (pinEntry === storedPin) { setNeedsUnlock(false); setPinEntry(''); }
        else { setPinEntry(''); showDialog('Невірний PIN-код', 'Перевірте код або увійдіть через email і пароль.', undefined, 'error'); }
    };
    const savePin = async (): Promise<void> => {
        if (!/^\d{4}$/.test(pinSetup)) { showDialog('Налаштуйте PIN-код', 'Введіть чотири цифри.', undefined, 'error'); return; }
        await AsyncStorage.setItem('sf_pin', pinSetup);
        setStoredPin(pinSetup); setPinSetup('');
        showDialog('PIN-код збережено', 'Після наступного запуску можна увійти за PIN-кодом.', undefined, 'success');
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
    const priceFiles = [{ name: 'pricelist_жовтень.xlsx', meta: '244 KB · Excel' }, { name: 'pricelist_вересень.xlsx', meta: '231 KB · Excel' }];
    const invoiceFiles = [{ name: 'invoice_0213.csv', meta: '12 KB · CSV' }, { name: 'invoice_0229.csv', meta: '9 KB · CSV' }];
    const exportFiles: {name:string; meta:string}[] = [];
    const folderChoices = ['Усі папки', 'Прайс-листи', 'Накладні', 'Експорт', ...customFolders];
    const chooseFolder = (): void => showDialog('Папка', 'Оберіть папку', [...folderChoices.map(name => ({ label: name, onPress: () => setFolderName(name === 'Усі папки' ? '' : name), tone: 'neutral' as const })), { label: 'Скасувати', tone: 'primary' }], 'sheet');
    const createFolder = (): void => {
        setFolderName('');
        showDialog('Створити папку', 'Введіть назву нової папки.', [
            { label: 'Скасувати', tone: 'neutral' },
            { label: 'Створити', tone: 'primary', onPress: () => {
                const name = folderName.trim();
                if (!name) { showDialog('Введіть назву папки', 'Назва не може бути порожньою.', undefined, 'error'); return; }
                if (!customFolders.includes(name)) setCustomFolders(value => [...value, name]);
                setFolderName(name); showDialog('Папку створено', `Папка «${name}» готова до використання.`, undefined, 'success');
            } },
        ], 'input');
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
        showDialog('Імпорт завершено', `Додано або оновлено товарів: ${imported}.`, undefined, 'success');
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
        showDialog('Документ проведено', 'Зміни збережено локально та поставлено в чергу синхронізації.', undefined, 'success');
    };
    const deleteSelectedDoc = (): void => {
        if (!selectedDoc) {
            showDialog('Очистити поточний документ?', 'Усі його позиції буде видалено.', [
                { label: 'Залишити документ', tone: 'neutral' },
                { label: 'Очистити', tone: 'danger', onPress: async () => { await db.runAsync("DELETE FROM lines WHERE document_id = 'active'"); setItems([]); setScreen('home'); } },
            ], 'confirm');
            return;
        }
        showDialog('Видалити документ?', 'Документ і його позиції буде видалено. Цю дію не можна скасувати.', [
            { label: 'Залишити', tone: 'neutral' },
            { label: 'Видалити документ', tone: 'danger', onPress: async () => {
                await db.runAsync('DELETE FROM lines WHERE document_id = ?', [selectedDoc]);
                await db.runAsync('DELETE FROM documents WHERE id = ?', [selectedDoc]);
                await db.runAsync('DELETE FROM outbox WHERE id = ?', [selectedDoc]);
                setSelectedDoc(null); setScreen('docs'); await refreshDocs();
            } },
        ], 'confirm');
    };
    const resolveConflict = async (): Promise<void> => {
        if (!selectedDoc || !conflictChoice) return;
        await db.runAsync("UPDATE documents SET status = 'draft' WHERE id = ?", [selectedDoc]);
        setConflictChoice(null); setScreen('detail'); await refreshDocs();
        showDialog('Конфлікт розв’язано', `Застосовано ${conflictChoice === 'local' ? 'локальні' : 'серверні'} дані.`, undefined, 'success');
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
        <View style={s.productBadge}><Icon name="file" size={17} color="#12715B"/></View><View style={s.productInfo}><Text style={s.actionTitle}>{item.name}</Text><Text style={s.hint}>{item.sku} · {item.barcode}</Text></View>
        {edit?<View style={s.qtyControl}><Pressable style={s.qtyButton} onPress={()=>void (selectedDoc?changeSavedQty(item,-1):changeQty(item,-1))}><Text>−</Text></Pressable><Text style={s.qtyNumber}>{item.quantity}</Text><Pressable style={s.qtyButton} onPress={()=>void (selectedDoc?changeSavedQty(item,1):changeQty(item,1))}><Text>＋</Text></Pressable></View>:<Text style={s.qty}>{item.quantity} {item.unit}</Text>}
    </View>)}</>;

    const Nav = () => <View style={s.bottom}>{([['home','home','Головна'],['docs','file','Документи'],['files','folder','Файли'],['profile','user','Профіль']] as const).map(([key,icon,label])=>{const active=screen===key||(key==='docs'&&screen==='detail');return <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:active}} style={s.navItem} onPress={()=>setScreen(key)}><View style={[s.navIconWrap,active&&s.navIconWrapActive]}><Icon name={icon} size={22} color={active?'#12715B':'#707A74'}/></View><Text style={[s.navLabel,active&&s.navSelected]}>{label}</Text></Pressable>})}</View>;
    const pageTitle = screen==='scan'?'Сканувати штрих-код':screen==='search'?'Ручне введення':screen==='docs'?'Документи':screen==='detail'?beginTitle:screen==='files'?'Файли та імпорт':screen==='profile'?'Мій профіль':screen==='settings'?'Налаштування':screen==='import'?'Імпорт товарів':screen==='notifications'?'Сповіщення':screen==='conflict'?'Конфлікт синхронізації':'Головна';
    const BackHeader = ({right}:{right?:React.ReactNode}) => <View style={s.pageHeader}><Pressable onPress={()=>setScreen(screen==='detail'||screen==='conflict'?'docs':screen==='settings'?'profile':'home')} style={s.backButton}><Icon name="back" size={23} color="#26302A"/></Pressable><Text style={s.pageTitle}>{pageTitle}</Text><View style={s.headerRight}>{right}</View></View>;

    if (!token || needsUnlock) return (
        <SafeAreaView style={s.root} edges={['top','bottom']}><StatusBar style="dark"/><ScrollView contentContainerStyle={s.loginScreen} keyboardShouldPersistTaps="handled">
            <View style={s.logoCube}><Icon name="warehouse" size={25} color="#12715B" strokeWidth={2.2}/></View><Text style={s.loginBrand}>Ware<Text style={s.brandGreen}>Go</Text></Text><Text style={s.loginSubtitle}>Складський облік</Text>
            <Text style={s.fieldLabel}>СКЛАД</Text><Pressable style={s.warehousePicker} onPress={()=>chooseWarehouseDialog()}><Text style={s.warehouseText}>{warehouse}</Text><Text style={s.chevron}>⌄</Text></Pressable>
            <View style={s.authTabs}><Pressable style={[s.authTab,authMode==='pin'&&s.authTabActive]} onPress={()=>setAuthMode('pin')}><Text style={[s.authTabText,authMode==='pin'&&s.authTabTextActive]}>PIN-код</Text></Pressable><Pressable style={[s.authTab,authMode==='email'&&s.authTabActive]} onPress={()=>setAuthMode('email')}><Text style={[s.authTabText,authMode==='email'&&s.authTabTextActive]}>Email + пароль</Text></Pressable></View>
            {authMode==='email'?<><Text style={s.fieldLabel}>EMAIL</Text><TextInput style={s.input} placeholder="name@warego.ua" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={authEmail} onChangeText={setAuthEmail}/><Text style={s.fieldLabel}>ПАРОЛЬ</Text><TextInput style={s.input} secureTextEntry placeholder="Введіть пароль" value={authPassword} onChangeText={setAuthPassword} onSubmitEditing={signIn}/><Pressable style={s.primaryButton} onPress={()=>void signIn()}><Text style={s.primaryButtonText}>Увійти</Text></Pressable><Pressable onPress={()=>showDialog('Відновлення пароля','Зверніться до адміністратора складу.')}><Text style={s.forgotLink}>Забули пароль?</Text></Pressable></>:<><Text style={s.pinPrompt}>Введіть PIN-код</Text><View style={s.pinDots}>{[0,1,2,3].map(i=><View key={i} style={[s.pinDot,i<pinEntry.length&&s.pinDotFilled]}/>)}</View>{storedPin?<View style={s.keypad}>{['1','2','3','4','5','6','7','8','9','','0','⌫'].map((digit,i)=><Pressable key={i} disabled={!digit} style={s.keypadKey} onPress={()=>digit==='⌫'?setPinEntry(v=>v.slice(0,-1)):setPinEntry(v=>v.length<4?v+digit:v)}><Text style={s.keypadDigit}>{digit}</Text></Pressable>)}</View>:<Text style={s.mutedCenter}>PIN-код ще не налаштовано. Увійдіть через email і створіть його в налаштуваннях.</Text>}<Pressable style={[s.primaryButton,!storedPin&&s.buttonDisabled]} disabled={!storedPin} onPress={unlockWithPin}><Text style={s.primaryButtonText}>Увійти за PIN-кодом</Text></Pressable></>}
        </ScrollView></SafeAreaView>
    );

    return <SafeAreaView style={s.root} edges={['top','bottom']}><StatusBar style="dark"/><View style={s.appFrame}>
        {dialog&&<View style={s.modalRoot}><Pressable style={s.modalScrim} onPress={()=>setDialog(null)}/><View style={[s.dialogCard,dialog.kind==='sheet'&&s.dialogSheet]}><View style={s.dialogHandle}/><View style={s.dialogHead}><View style={[s.dialogIcon,dialog.kind==='error'&&s.dialogIconError,dialog.kind==='success'&&s.dialogIconSuccess]}><Icon name={dialog.kind==='error'?'warning':dialog.kind==='success'?'check':dialog.kind==='sheet'?'folder':'warning'} size={21} color={dialog.kind==='error'?'#C93C3C':'#12715B'}/></View><Pressable style={s.dialogClose} onPress={()=>setDialog(null)}><Icon name='close' size={18} color='#6E7772'/></Pressable></View><Text style={s.dialogTitle}>{dialog.title}</Text>{!!dialog.message&&<Text style={s.dialogMessage}>{dialog.message}</Text>}{dialog.kind==='input'&&<TextInput autoFocus style={s.dialogInput} placeholder={dialog.placeholder||'Назва папки'} value={dialog.value??folderName} onChangeText={value=>dialog.onChangeText?dialog.onChangeText(value):setFolderName(value)}/>}<View style={[s.dialogActions,dialog.kind==='sheet'&&s.dialogSheetActions]}>{dialog.actions.map((action,index)=><Pressable key={action.label+index} style={[s.dialogAction,action.tone==='primary'&&s.dialogPrimary,action.tone==='danger'&&s.dialogDanger,action.tone==='neutral'&&s.dialogNeutral,dialog.kind==='sheet'&&s.dialogSheetAction]} onPress={()=>void runDialogAction(action)}><Text style={[s.dialogActionText,action.tone==='primary'&&s.dialogPrimaryText,action.tone==='danger'&&s.dialogDangerText,action.tone==='neutral'&&s.dialogNeutralText,dialog.kind==='sheet'&&s.dialogSheetActionText]}>{action.label}</Text></Pressable>)}</View></View></View>}{screen==='home'?<>
            <View style={s.homeHeader}><View><Text style={s.pageTitle}>Головна</Text><Pressable style={s.warehouseInline} onPress={()=>chooseWarehouseDialog()}><Text style={s.warehouseInlineText}>⌂  {warehouse}  ⌄</Text></Pressable><Text style={s.mutedSmall}>{authUser} · Складський облік</Text></View><View style={s.headerActions}><Pressable style={s.iconButton} onPress={()=>setScreen('notifications')}><Icon name="bell" size={20} color="#26302A"/>{outboxCount>0&&!readAll&&<View style={s.unreadDot}/>}</Pressable><Pressable style={s.iconButton} onPress={()=>setScreen('settings')}><Icon name="settings" size={20} color="#26302A"/></Pressable></View></View>
            <ScrollView contentContainerStyle={s.homeBody} keyboardShouldPersistTaps="handled"><Pressable style={s.searchBar} onPress={()=>{setQuery('');setScreen('search')}}><Text style={s.searchPlaceholder}>Назва, SKU або штрихкод</Text><Icon name="search" size={19} color="#66726A"/></Pressable>
                <Text style={s.sectionLabel}>ШВИДКИЙ ДОСТУП</Text><View style={s.quickGrid}>{([['search','Пошук','search'],['scan','Сканер','scan'],['file','Документи','docs'],['warehouse','Склад','files']] as const).map(([icon,label,to])=><Pressable key={label} style={[s.quickItem,s.quickItemOffline,compactLayout&&s.quickItemCompact]} onPress={()=>setScreen(to)}><View style={[s.quickIconWrap,s.quickIconWrapOffline]}><Icon name={icon} size={23} color="#0E0F10"/></View><Text style={[s.quickLabel,s.quickLabelOffline]}>{label}</Text></Pressable>)}</View>
                <View style={[s.onlineCard,onlineMode?s.onlineCardOn:s.onlineCardOff]}><View style={s.rowBetween}><View style={s.rowInline}><Icon name="wifi" size={20} color={onlineMode?'#12715B':'#0E0F10'}/><View><Text style={s.onlineTitle}>{onlineMode?'Онлайн':'Офлайн'}</Text><Text style={s.mutedSmall}>{onlineMode?(online?'Мережа доступна':'Режим онлайн увімкнено'):'Застосунок працює без мережі'}</Text></View></View><Pressable accessibilityRole="switch" accessibilityState={{checked:onlineMode}} style={[s.switch,onlineMode?s.switchOn:s.switchOffline]} onPress={()=>setOnlineMode(value=>!value)}><View style={[s.switchKnob,onlineMode&&s.switchKnobOn]}/></Pressable></View></View>
                <View style={s.syncCard}><View style={s.rowBetween}><View style={s.rowInline}><Text style={s.syncCount}>{outboxCount}</Text><View><Text style={s.cardTitle}>{outboxCount===1?'запис':outboxCount===0?'записів':'записи'}</Text><Text style={s.mutedSmall}>{outboxCount?'Не синхронізовано':'Усе синхронізовано'}</Text></View></View><Text style={[s.statusPill,outboxCount?s.statusPending:s.statusDone]}>{outboxCount?'Очікує':'Готово'}</Text></View><Text style={s.mutedSmall}>Остання перевірка · {new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</Text><Pressable style={s.yellowButton} onPress={()=>void sync()} disabled={syncing}><Text style={s.yellowButtonText}>{syncing?'Синхронізація…':'Синхронізувати записи'}</Text></Pressable></View>
                <View style={s.documentCurrent}><View style={s.rowBetween}><Text style={s.cardTitle}>Поточний документ</Text><Text style={s.linkText}>{typeLabel[tab]}</Text></View><Text style={s.mutedSmall}>{items.length} позицій · {items.reduce((n,item)=>n+Number(item.quantity||0),0)} од.</Text>{items.length>0&&<Pressable style={s.documentHeadlineButton} onPress={()=>setScreen('detail')}><Text style={s.linkText}>Переглянути документ  ›</Text></Pressable>}<Pressable style={s.scanHomeButton} onPress={()=>setScreen('scan')}><Text style={s.scanHomeText}><Icon name="scan" size={17} color="#FFFFFF"/>  Сканувати штрих-код</Text></Pressable></View>
                <View style={s.sectionHeading}><Text style={s.sectionLabel}>АКТИВНІ ДОКУМЕНТИ</Text><Pressable onPress={()=>setScreen('docs')}><Text style={s.linkText}>Усі</Text></Pressable></View>{savedDocs.slice(0,2).map(doc=><Pressable key={doc.id} style={s.savedDocCard} onPress={()=>void openDoc(doc.id)}><View style={s.docGlyph}><Icon name={doc.type==='receipt'?'download':doc.type==='writeoff'?'trash':doc.type==='transfer'?'refresh':'file'} size={18} color="#12715B"/></View><View style={s.productInfo}><Text style={s.productName}>{doc.id.slice(0,7).toUpperCase()} · {typeLabel[doc.type]}</Text><Text style={s.productCode}>{dateLabel(doc.created_at)} · {warehouse}</Text></View><Text style={s.statusPill}>{doc.status==='draft'?'Чернетка':doc.status}</Text></Pressable>)}
                <Text style={s.sectionLabel}>ВАША ЗМІНА</Text><View style={s.statsRow}><View style={s.statCard}><Text style={s.statNumber}>{products.length}</Text><Text style={s.mutedSmall}>Сканів</Text></View><View style={s.statCard}><Text style={s.statNumber}>{savedDocs.length}</Text><Text style={s.mutedSmall}>Документів</Text></View><View style={s.statCard}><Text style={s.statNumber}>0</Text><Text style={s.mutedSmall}>Розбіжностей</Text></View></View><Text style={s.shiftTime}>08:00–20:00</Text>
            </ScrollView><Nav/>
        </>:screen==='docs'?<><View style={s.pageHeader}><Text style={s.pageTitle}>Документи</Text><Pressable style={s.iconButton} onPress={()=>newDoc()}><Icon name="plus" size={20} color="#26302A"/></Pressable></View><ScrollView contentContainerStyle={s.pageBody}>
            <View style={s.docTypeGrid}>{documentTabs.map(([kind,label])=><Pressable key={kind} style={[s.docTypeChip,tab===kind&&s.docTypeSelected]} onPress={()=>setTab(kind)}><Text style={[s.docTypeText,tab===kind&&s.docTypeTextOn]}>{label}</Text><Text style={[s.docTypeCount,tab===kind&&s.docTypeTextOn]}>{savedDocs.filter(d=>d.type===kind).length}</Text></Pressable>)}</View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>{['Усі дати','Сьогодні','7 днів'].map(label=><Pressable key={label} onPress={()=>setDocDateFilter(label)} style={[s.filterChip,docDateFilter===label&&s.filterSelected]}><Text style={[s.filterText,docDateFilter===label&&s.filterTextOn]}>{label}</Text></Pressable>)}</ScrollView>
            <View style={s.statusFilters}>{['Усі стани','Чернетка','Проведено','Синхронізовано'].map(label=><Pressable key={label} style={[s.statusFilter,docStatusFilter===label&&s.statusFilterOn]} onPress={()=>setDocStatusFilter(label)}><Text style={[s.statusFilterText,docStatusFilter===label&&s.statusFilterTextOn]}>{label}</Text></Pressable>)}</View>
            {visibleDocs.map(doc=><Pressable key={doc.id} style={s.savedDocCard} onPress={()=>void openDoc(doc.id)}><View style={s.docGlyph}><Icon name={doc.type==='receipt'?'download':doc.type==='writeoff'?'trash':doc.type==='transfer'?'refresh':'file'} size={18} color="#12715B"/></View><View style={s.productInfo}><Text style={s.productName}>{doc.id.slice(0,7).toUpperCase()} · {typeLabel[doc.type]}</Text><Text style={s.productCode}>{dateLabel(doc.created_at)} · {warehouse}</Text></View><Text style={[s.statusPill,doc.status==='posted'?s.statusDone:s.statusPending]}>{doc.status==='conflict'?'Конфлікт':doc.status==='draft'?'Чернетка':doc.status==='posted'?'Проведено':doc.is_synced?'Синхронізовано':doc.status}</Text></Pressable>)}
            {savedDocs.filter(doc=>doc.type===tab).length===0&&<View style={s.emptyState}><Icon name="file" size={28} color="#12715B"/><Text style={s.emptyTitle}>Документів поки немає</Text><Text style={s.mutedCenter}>Створіть перший документ для цього типу</Text><Pressable style={s.primaryButton} onPress={()=>newDoc()}><Text style={s.primaryButtonText}>＋ Створити документ</Text></Pressable></View>}
            <Text style={s.sectionLabel}>ПОТОЧНИЙ ДОКУМЕНТ · {items.length}</Text>{itemRows(items,true)}<Pressable style={s.scanHomeButton} onPress={()=>setScreen('detail')}><Text style={s.scanHomeText}>Відкрити поточний документ</Text></Pressable>
        </ScrollView><Pressable style={s.fab} onPress={()=>newDoc()}><Icon name="plus" size={25} color="#1F2823" strokeWidth={2.2}/></Pressable><Nav/></>
        :screen==='scan'?<><BackHeader right={<Pressable style={s.iconButton} onPress={()=>showDialog('Сканер','Ліхтарик: перемикається на пристрої з камерою.')}><Icon name="zap" size={19} color="#26302A"/></Pressable>}/><ScrollView contentContainerStyle={s.pageBody}>
            {permission?.granted?<View style={s.cameraWrap}><CameraView style={s.camera} facing="back" onBarcodeScanned={scanned?undefined:({data})=>{setScanned(true);void find(data)}} barcodeScannerSettings={{barcodeTypes:['ean13','ean8','upc_a','upc_e','code128','code39','qr']}}/><View pointerEvents="none" style={s.cameraOverlay}><View style={s.scanFrame}/><Text style={s.scanCaption}>Наведіть камеру на штрихкод</Text></View></View>:<View style={s.cameraRequest}><Icon name="scan" size={28} color="#12715B"/><Text style={s.emptyTitle}>Сканування штрих-коду</Text><Text style={s.mutedCenter}>Дозвольте доступ до камери</Text><Pressable style={s.primaryButton} onPress={requestPermission}><Text style={s.primaryButtonText}>Увімкнути камеру</Text></Pressable></View>}
            <View style={s.scanStatus}><View style={s.scanResultIcon}><Icon name={scanned?'check':'scan'} size={18} color="#12715B"/></View><View style={s.scanResultCopy}><Text style={s.productName}>{scanned?'Товар додано в документ':'Наведіть камеру або введіть код нижче'}</Text><Text style={s.productCode}>{scanned?`${items[items.length-1]?.name||'Товар'} · ${items[items.length-1]?.barcode||''}`:'Після сканування товар з’явиться в документі'}</Text></View><Pressable style={s.scanAgainButton} onPress={()=>setScanned(false)}><Icon name="refresh" size={17} color="#12715B"/></Pressable></View>
            <Text style={s.fieldLabel}>КІЛЬКІСТЬ У ДОКУМЕНТІ</Text><Text style={s.quantityValue}>{qty} {items[items.length-1]?.unit||'шт'}</Text><View style={s.quantityChoices}>{['-1','+1','+10'].map(value=><Pressable key={value} style={[s.quantityChoice,value==='+1'&&s.quantitySelected]} onPress={()=>setQty(String(Math.max(1,Number(qty)+(value==='-1'?-1:value==='+10'?10:1))))}><Text style={s.quantityChoiceText}>{value}</Text></Pressable>)}</View>
            <Pressable style={s.primaryButton} onPress={()=>setScreen('detail')}><Text style={s.primaryButtonText}>✓  Готово ({items.length})</Text></Pressable><Pressable style={s.textButton} onPress={()=>setScreen('search')}><Text style={s.textButtonLabel}>▤  Ввести штрихкод вручну</Text></Pressable>
            <Text style={s.fieldLabel}>РУЧНЕ ВВЕДЕННЯ</Text><TextInput style={s.input} placeholder="Штрих-код або SKU" keyboardType="default" value={manual} onChangeText={setManual}/><Pressable style={s.scanHomeButton} onPress={()=>void find(manual)}><Text style={s.scanHomeText}>Знайти й додати товар</Text></Pressable>
        </ScrollView></>
        :screen==='search'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody} keyboardShouldPersistTaps="handled"><Text style={s.fieldLabel}>ПОШУК ЗА SKU АБО НАЗВОЮ</Text><TextInput style={s.input} placeholder="Наприклад, фарба" value={query} onChangeText={setQuery} autoFocus/><Text style={s.fieldLabel}>ШТРИХ-КОД</Text><TextInput style={s.input} placeholder="13 цифр" keyboardType="number-pad" value={manual} onChangeText={setManual}/><Pressable style={s.scanHomeButton} onPress={()=>void find(manual)}><Text style={s.scanHomeText}>Знайти за штрихкодом</Text></Pressable><View style={s.sectionHeading}><Text style={s.sectionLabel}>ШВИДКИЙ ВИБІР</Text><Text style={s.linkText}>{filtered.length} товарів</Text></View>{filtered.map(product=><Pressable key={product.id} onPress={()=>{void add(product);setScreen('detail')}} style={s.productRow}><View style={s.productBadge}><Icon name="file" size={17} color="#12715B"/></View><View style={s.productInfo}><Text style={s.productName}>{product.name}</Text><Text style={s.productCode}>{product.sku} · {product.barcode}</Text></View><Text style={s.linkText}>＋</Text></Pressable>)}{filtered.length===0&&<View style={s.emptyState}><Icon name="search" size={28} color="#12715B"/><Text style={s.emptyTitle}>Нічого не знайдено</Text><Text style={s.mutedCenter}>Перевірте назву, SKU або штрихкод</Text></View>}</ScrollView></>
        :screen==='detail'?<><BackHeader right={<View style={s.headerActions}><Pressable style={s.iconButton} onPress={()=>{void Share.share({title:beginTitle,message:`${beginTitle}\n${(selectedDoc?detailItems:items).map(i=>`${i.name} — ${i.quantity} ${i.unit}`).join('\n')}`})}}><Text style={s.iconButtonText}>⎙</Text></Pressable><Pressable style={s.iconButton} onPress={deleteSelectedDoc}><Text style={s.iconButtonText}>⌫</Text></Pressable></View>}/><ScrollView contentContainerStyle={s.pageBody}><View style={s.detailHeading}><Text style={s.detailTitle}>{beginTitle}</Text><Text style={s.mutedSmall}>{warehouse}</Text><Text style={[s.statusPill,savedDocs.find(d=>d.id===selectedDoc)?.status==='conflict'&&s.statusError]}>{selectedDoc?(savedDocs.find(d=>d.id===selectedDoc)?.status==='posted'?'Проведено':'Чернетка'):'Локально'}</Text></View><View style={s.detailStats}><View style={s.detailStat}><Text style={s.detailStatLabel}>Позицій</Text><Text style={s.detailStatValue}>{selectedDoc?detailItems.length:items.length}</Text></View><View style={s.detailStat}><Text style={s.detailStatLabel}>Загальна кількість</Text><Text style={s.detailStatValue}>{(selectedDoc?detailItems:items).reduce((n,item)=>n+Number(item.quantity||0),0)}</Text></View>{tab==='inventory'&&<View style={s.detailStat}><Text style={s.detailStatLabel}>Розбіжність</Text><Text style={[s.detailStatValue,s.errorText]}>+5</Text></View>}</View><Text style={s.sectionLabel}>ВІДСКАНОВАНІ ТОВАРИ</Text>{itemRows(selectedDoc?detailItems:items,!selectedDoc||savedDocs.find(d=>d.id===selectedDoc)?.status==='draft')}{tab==='writeoff'&&<><Text style={s.fieldLabel}>ПРИЧИНА СПИСАННЯ</Text><TextInput style={s.input} placeholder="Наприклад, брак" value={docNote} onChangeText={setDocNote}/></>}<Pressable style={s.scanHomeButton} onPress={()=>setScreen('scan')}><Text style={s.scanHomeText}><Icon name="scan" size={17} color="#FFFFFF"/>  Сканувати штрих-код</Text></Pressable>{selectedDoc&&savedDocs.find(d=>d.id===selectedDoc)?.status==='conflict'&&<Pressable style={s.dangerButton} onPress={()=>setScreen('conflict')}><Text style={s.dangerText}>Розв’язати конфлікт</Text></Pressable>}</ScrollView><View style={s.stickyActions}><Pressable style={s.primaryButton} onPress={()=>void postCurrent()}><Text style={s.primaryButtonText}>Провести</Text></Pressable><Pressable style={s.secondaryButton} onPress={()=>setScreen('scan')}><Text style={s.secondaryButtonText}><Icon name="scan" size={17} color="#12715B"/>  Сканувати штрих-код</Text></Pressable></View></>
        :screen==='profile'?<><View style={s.pageHeader}><Text style={s.pageTitle}>Мій профіль</Text><Pressable style={s.iconButton} onPress={()=>setScreen('settings')}><Icon name="settings" size={20} color="#26302A"/></Pressable></View><ScrollView contentContainerStyle={s.pageBody}><View style={s.profileCard}><View style={s.profileAvatar}><Text style={s.profileAvatarText}>{authUser.charAt(0).toUpperCase()}</Text></View><View style={s.productInfo}><Text style={s.profileName}>{authUser}</Text><Text style={s.productCode}>Комірник · WG-0017</Text><Text style={s.statusGreenText}>Зміна відкрита · 08:00–20:00</Text><Text style={s.productCode}>{authEmail||'worker@warego.ua'}</Text></View></View><Pressable style={s.warehouseCard} onPress={()=>chooseWarehouseDialog()}><View style={s.warehouseIcon}><Icon name="warehouse" size={18} color="#12715B"/></View><View style={s.productInfo}><Text style={s.productName}>ОСНОВНИЙ СКЛАД</Text><Text style={s.actionTitle}>{warehouse}</Text></View><Text style={s.chevron}>›</Text></Pressable><View style={s.sectionHeading}><Text style={s.sectionLabel}>СТАТИСТИКА ЗМІНИ</Text><Text style={s.linkText}>{new Date().toLocaleDateString('uk-UA',{day:'numeric',month:'long'})}</Text></View><View style={s.statsRow}><View style={s.statCard}><Text style={s.statNumber}>{products.length}</Text><Text style={s.mutedSmall}>Сканів</Text></View><View style={s.statCard}><Text style={s.statNumber}>{savedDocs.length}</Text><Text style={s.mutedSmall}>Документів</Text></View><View style={s.statCard}><Text style={s.statNumber}>0</Text><Text style={s.mutedSmall}>Розбіжностей</Text></View></View><View style={s.chartCard}><Text style={s.productName}>Сканувань за годинами</Text><View style={s.chartBars}>{[28,42,34,62,48,76,54].map((h,i)=><View key={i} style={s.chartColumn}><View style={[s.chartBar,{height:h},i===5&&s.chartBarActive]}/><Text style={s.chartLabel}>{8+i}</Text></View>)}</View></View><Text style={s.sectionLabel}>РІВНІ ДОСТУПУ</Text>{[['Комірник','Сканування, документи та облік товару'],['Менеджер','Контроль складу й звітність'],['Адміністратор','Налаштування та керування доступом']].map(([role,desc],i)=><View key={role} style={s.roleCard}><View><Text style={s.productName}>{role}</Text><Text style={s.mutedSmall}>{desc}</Text></View><Text style={[s.statusPill,i===0?s.statusDone:s.statusPending]}>{i===0?'Ваш рівень':'Перегляд'}</Text></View>)}<Pressable style={s.dangerButton} onPress={()=>void signOut()}><Text style={s.dangerText}>Вийти з облікового запису</Text></Pressable></ScrollView><Nav/></>
        :screen==='settings'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><Text style={s.sectionLabel}>З’ЄДНАННЯ З СЕРВЕРОМ</Text><View style={s.sectionCard}><Text style={s.settingLabel}>IP-адреса сервера</Text><TextInput style={s.input} autoCapitalize="none" value={serverHost} onChangeText={setServerHost}/><Text style={s.settingLabel}>Порт</Text><TextInput style={s.input} keyboardType="number-pad" value={serverPort} onChangeText={setServerPort}/><Pressable style={s.yellowButton} onPress={()=>void checkConnection()}><Text style={s.yellowButtonText}>Перевірити з’єднання</Text></Pressable><View style={online?s.connectionSuccess:s.connectionOffline}><Text style={online?s.statusGreenText:s.offlineTitle}>{online?'● З’єднання встановлено':'● Немає з’єднання'}</Text><Text style={s.mutedSmall}>{online?'Сервер доступний':'Остання перевірка · '+new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</Text></View></View><Text style={s.sectionLabel}>СКАНЕР</Text><Pressable style={s.settingRow} onPress={()=>setSoundOn(v=>!v)}><Text style={s.productName}>◖  Звук сканування</Text><View style={[s.switch,soundOn&&s.switchOn]}><View style={[s.switchKnob,soundOn&&s.switchKnobOn]}/></View></Pressable><Pressable style={s.settingRow} onPress={()=>setVibrationOn(v=>!v)}><Text style={s.productName}>▣  Вібрація</Text><View style={[s.switch,vibrationOn&&s.switchOn]}><View style={[s.switchKnob,vibrationOn&&s.switchKnobOn]}/></View></Pressable><Text style={s.sectionLabel}>СИНХРОНІЗАЦІЯ</Text><View style={s.sectionCard}><Pressable style={s.settingRow} onPress={()=>void toggleAutoSync()}><View><Text style={s.productName}>Автосинхронізація</Text><Text style={s.mutedSmall}>Передавання при появі мережі</Text></View><View style={[s.switch,autoSync&&s.switchOn]}><View style={[s.switchKnob,autoSync&&s.switchKnobOn]}/></View></Pressable><Text style={s.settingLabel}>Інтервал синхронізації</Text><View style={s.intervalRow}>{['5 хв','15 хв','30 хв'].map(v=><Pressable key={v} style={[s.intervalOption,syncInterval===v&&s.intervalSelected]} onPress={()=>void chooseSyncInterval(v)}><Text style={syncInterval===v?s.intervalSelectedText:s.intervalText}>{v}</Text></Pressable>)}</View></View><Text style={s.sectionLabel}>ДАНІ НА ПРИСТРОЇ</Text><View style={s.sectionCard}><Pressable style={s.settingRow} onPress={()=>void createBackup()}><Text style={s.productName}>◌  Резервна копія бази</Text><Text style={s.linkText}>Створити</Text></Pressable><Text style={s.mutedSmall}>Експортує локальні товари й документи у форматі JSON.</Text></View><Text style={s.sectionLabel}>БЕЗПЕКА</Text><View style={s.sectionCard}><Text style={s.settingLabel}>PIN-код для входу</Text><View style={s.inlineForm}><TextInput style={[s.input,s.inlineInput]} value={pinSetup} onChangeText={v=>setPinSetup(v.replace(/\D/g,'').slice(0,4))} keyboardType="number-pad" secureTextEntry placeholder="4 цифри"/><Pressable style={s.smallGreenButton} onPress={()=>void savePin()}><Text style={s.smallGreenText}>{storedPin?'Оновити':'Зберегти'}</Text></Pressable></View><Text style={s.mutedSmall}>{storedPin?'PIN-код налаштований':'Створіть PIN для швидкого входу'}</Text></View><Pressable style={s.dangerButton} onPress={()=>void signOut()}><Text style={s.dangerText}>Вийти з облікового запису</Text></Pressable></ScrollView></>
        :screen==='files'?<><View style={s.pageHeader}><Text style={s.pageTitle}>Файли та імпорт</Text><Pressable style={s.iconButton} onPress={()=>void createBackup()}><Icon name="plus" size={20} color="#26302A"/></Pressable></View><ScrollView contentContainerStyle={s.pageBody}>
            <View style={s.importHero}><View style={s.importBadge}><Icon name="upload" size={22} color="#12715B"/></View><Text style={s.emptyTitle}>Імпорт CSV / Excel</Text><Text style={s.mutedCenter}>Завантажте товари або накладну. Формати .csv, .xlsx · до 20 MB</Text><Pressable style={s.yellowButton} onPress={()=>setScreen('import')}><Text style={s.yellowButtonText}><Icon name="upload" size={17} color="#202723"/>  Обрати файл</Text></Pressable><Text style={s.importFootnote}>Поля: штрихкод, SKU, назва, кількість</Text></View>
            <Pressable style={s.createFolderButton} onPress={createFolder}><Icon name="plus" size={17} color="#12715B"/><Text style={s.linkText}>Створити папку</Text></Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filesTabs}>{[['price','Прайс-листи'],['invoice','Накладні'],['export','Експорт']].map(([key,label])=><Pressable key={key} style={[s.fileTab,filesTab===key&&s.fileTabActive]} onPress={()=>setFilesTab(key as 'price'|'invoice'|'export')}><Text style={[s.fileTabText,filesTab===key&&s.fileTabTextActive]}>{label}  ·  {key==='price'?2:key==='invoice'?2:0}</Text></Pressable>)}</ScrollView>
            {folderName!==''&&<Pressable style={s.folderFilter} onPress={()=>setFolderName('')}><Text style={s.linkText}>{folderName}  ×</Text></Pressable>}
            {filesTab==='price'&&priceFiles.map(file=><Pressable key={file.name} style={s.fileAction} onPress={()=>setScreen('import')}><View style={s.fileIcon}><Icon name="file" size={18} color="#12715B"/></View><View style={s.productInfo}><Text style={s.productName}>{file.name}</Text><Text style={s.productCode}>{file.meta}</Text></View></Pressable>)}
            {filesTab==='invoice'&&invoiceFiles.map(file=><Pressable key={file.name} style={s.fileAction} onPress={()=>setScreen('import')}><View style={s.fileIcon}><Icon name="file" size={18} color="#12715B"/></View><View style={s.productInfo}><Text style={s.productName}>{file.name}</Text><Text style={s.productCode}>{file.meta}</Text></View></Pressable>)}
            {filesTab==='export'&&<><Pressable style={s.fileAction} onPress={()=>void exportProducts()}><View style={s.fileIcon}><Icon name="upload" size={18} color="#12715B"/></View><Text style={s.productName}>Експорт товарів у CSV</Text></Pressable><Pressable style={s.fileAction} onPress={()=>void createBackup()}><View style={s.fileIcon}><Icon name="database" size={18} color="#12715B"/></View><Text style={s.productName}>Створити резервну копію</Text></Pressable></>}
            <Text style={s.centerCaption}>Локальні файли · доступні в офлайн-режимі</Text>
        </ScrollView><Nav/></>
        :screen==='import'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><Text style={s.mutedCenter}>Вставте CSV із колонками: SKU, Barcode, Name, Unit, Stock. Перший рядок — заголовки.</Text><TextInput style={s.csvInput} multiline textAlignVertical="top" placeholder={'SKU,Barcode,Name,Unit,Stock\nSKU-001,4820000000001,Назва товару,шт,12'} value={importText} onChangeText={setImportText}/><Pressable style={s.primaryButton} onPress={()=>void importProducts()}><Text style={s.primaryButtonText}>Імпортувати товари</Text></Pressable></ScrollView></>
        :screen==='notifications'?<><BackHeader right={<Pressable onPress={()=>setReadAll(true)}><Text style={s.linkText}>Прочитати все</Text></Pressable>}/><ScrollView contentContainerStyle={s.pageBody}><View style={s.noticeCard}><Text style={s.statusGreenText}>{online?'● Мережа з’єднана':'● Офлайн-режим'}</Text><Text style={s.productName}>Статус з’єднання</Text><Text style={s.mutedSmall}>Застосунок перевіряє сервер автоматично.</Text></View>{outboxCount>0&&!readAll&&<View style={s.noticeCard}><Text style={s.statusPending}>● Очікує синхронізації</Text><Text style={s.productName}>{outboxCount} локальних записів</Text><Pressable onPress={()=>void sync()}><Text style={s.linkText}>Синхронізувати зараз</Text></Pressable></View>}{(outboxCount===0||readAll)&&<View style={s.emptyState}><Icon name="bell" size={28} color="#12715B"/><Text style={s.emptyTitle}>Усе прочитано</Text><Text style={s.mutedCenter}>Нових сповіщень немає</Text></View>}</ScrollView></>
        :screen==='conflict'?<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><View style={s.conflictBanner}><Text style={s.errorText}>⚠ Конфлікт синхронізації</Text><Text style={s.mutedSmall}>Дані документа змінилися локально та на сервері.</Text></View><Text style={s.sectionLabel}>ОБЕРІТЬ ВЕРСІЮ ДАНИХ</Text>{(['local','server'] as const).map(choice=><Pressable key={choice} style={[s.conflictOption,conflictChoice===choice&&s.conflictChosen]} onPress={()=>setConflictChoice(choice)}><View><Text style={s.productName}>{choice==='local'?'Локальні дані':'Серверні дані'}</Text><Text style={s.mutedSmall}>{choice==='local'?'Зміни на цьому пристрої':'Остання версія з сервера'}</Text></View><Text style={s.linkText}>{conflictChoice===choice?'◉':'○'}</Text></Pressable>)}<Pressable style={[s.primaryButton,!conflictChoice&&s.buttonDisabled]} disabled={!conflictChoice} onPress={()=>void resolveConflict()}><Text style={s.primaryButtonText}>Застосувати обрану версію</Text></Pressable></ScrollView></>
        :<><BackHeader/><ScrollView contentContainerStyle={s.pageBody}><View style={s.emptyState}><Text style={s.emptyTitle}>Дані документа відрізняються</Text></View></ScrollView></>}
        <NewDocumentSheet visible={showNewDoc} onClose={()=>setShowNewDoc(false)} onSelect={startDoc}/>
    </View></SafeAreaView>;
}




