# WareGo (StockFlow) — мобільний застосунок

React Native (Expo SDK 58) · TypeScript · SQLite (офлайн) · React Navigation.

## Архітектура

**Feature-based Architecture + Separation of Concerns** — код організовано за функціональними модулями (фічами); усередині фічі відповідальності розділені на шари.

```
mobile/
├── index.ts                    реєстрація кореневого компонента (Expo)
├── App.tsx                     провайдери + навігація
├── src/
│   ├── app/                    ініціалізація застосунку
│   │   ├── navigation/         RootNavigator (вхід ↔ застосунок), AuthNavigator, MainNavigator (вкладки + екрани), types
│   │   └── providers/          DatabaseProvider, AuthProvider, SettingsProvider, SyncProvider, DialogProvider, AppProviders
│   ├── features/               функціональні модулі
│   │   ├── auth/               вхід email/пароль і PIN, сесія (JWT)
│   │   ├── products/           каталог, пошук, імпорт/експорт CSV
│   │   ├── scanner/            камера, штрихкоди, кількість за скан
│   │   ├── inventory/          складські документи: поточний, збережені, проведення, конфлікти
│   │   ├── home/               головний екран
│   │   ├── files/              файли, імпорт, резервна копія
│   │   ├── notifications/      сповіщення
│   │   ├── profile/            профіль і статистика зміни
│   │   └── settings/           сервер, синхронізація, сканер, PIN
│   ├── components/             спільні UI-компоненти
│   │   ├── ui/                 Button, Input, Loader, Modal, Switch, Icon
│   │   └── layout/             Header, ScreenContainer, TabBar
│   ├── database/               локальна SQLite: schema, migrations (PRAGMA user_version), seed
│   ├── services/               спільні технічні сервіси
│   │   ├── api/                client (таймаути, токен), endpoints, server (автопошук адреси API)
│   │   ├── storage/            SecureStorage (токени, PIN — у сховищі ключів ОС), Storage (налаштування)
│   │   └── sync/               SyncService = PushService (черга документів → сервер) + PullService (каталог ← сервер)
│   ├── hooks/                  спільні хуки: useNetworkStatus
│   ├── constants/              config, colors, styles
│   ├── utils/                  formatters, validators
│   ├── types/                  спільні типи
│   └── assets/                 images, icons, fonts
├── __tests__/                  тести спільних сервісів
├── .env.example                EXPO_PUBLIC_API_URL для збірок
└── app.json, babel.config.js, metro.config.js, tsconfig.json, package.json
```

### Шари всередині фічі (приклад `inventory/`)

| Папка | Відповідальність | Приклад |
|---|---|---|
| `screens/` | формує екран | `DocumentDetailScreen.tsx` |
| `components/` | окремі UI-елементи | `DocumentCard.tsx`, `DocumentItemRow.tsx`, `NewDocumentSheet.tsx` |
| `hooks/` | стан і React-логіка | `useInventory.tsx` (контекст документів), `useDocumentActions.ts`, `useAddProduct.ts` |
| `services/` | бізнес-правила (чисті функції) | `DocumentService.ts` — фільтри, підписи, payload синхронізації |
| `repositories/` | доступ до даних (SQLite) | `DocumentRepository.ts` |
| `models/` | відображення таблиць БД у типи | `Document.ts`, `DocumentLine.ts` |
| `types/` | типи й інтерфейси | `document.types.ts` |
| `__tests__/` | тести фічі | `DocumentService.test.ts` |

Залежності йдуть лише «вниз»: `screens → hooks → services → repositories → database`. Екрани не звертаються до SQLite чи API напряму.

### Порядок провайдерів

`Database → Dialog → Settings → Auth → Products → Inventory → Sync` — кожен може використовувати попередні (`AppProviders.tsx`).

### Відмінності від шаблону

- **SQLite (expo-sqlite) замість WatermelonDB.** WatermelonDB потребує нативної збірки і не працює в Expo Go. `models/` тут — це відображення рядків таблиць у типи; схема й міграції — у `src/database/`.
- **`android/` та `ios/` немає** — проєкт на керованому Expo. Їх створює `npx expo prebuild` за потреби.
- Додано фічі `home`, `files`, `notifications`, `profile`, `settings` (у застосунку є такі екрани); `history` не виділено — історія документів є частиною `inventory`.

## Запуск

```powershell
cd mobile
npm install
npx expo start        # a — Android-емулятор, QR — телефон з Expo Go
```

Сервер (з кореня репозиторію): `docker compose up -d db`, потім `npm run api`. Адресу API застосунок знаходить сам (Metro-хост → `10.0.2.2` → `localhost`); для збірки з постійним сервером задайте `EXPO_PUBLIC_API_URL` у `mobile/.env`.

Демо: `worker@gmail.com` / `worker`.

**З будь-якого телефона (інша мережа, мобільний інтернет)** — через ngrok: на ПК `npm run tunnel:api` (з кореня), у `mobile/.env` задати `EXPO_PUBLIC_API_URL=https://<адреса ngrok>/api`, запустити `npm run start:tunnel -- -c`. Адреса з `.env` завжди має пріоритет. Деталі — `server/README.md`, розділ 6.

## Перевірки

```powershell
npm test              # Jest (jest-expo): сервіси фіч, синхронізація, утиліти
npm run typecheck     # TypeScript strict
```

## Синхронізація

1. Документ зберігається локально і стає в чергу `outbox` (працює офлайн).
2. `PushService` надсилає чергу на `POST /api/sync/` (локальні id товарів замінюються серверними, якщо каталог уже підтягнуто).
3. `PullService` забирає зміни каталогу з `GET /api/sync/pull/?cursor=…`.
4. Прострочений access-токен (20 хв) автоматично оновлюється через refresh-токен.
