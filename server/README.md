# StockFlow API (Django + DRF + PostgreSQL)

## Структура

```
server/
├── config/                 налаштування та головні urls
│   ├── settings/base.py    спільне для всіх середовищ
│   ├── settings/dev.py     розробка: Postgres у Docker, DEBUG, Browsable API
│   ├── settings/test.py    pytest (SQLite в пам'яті або TEST_DATABASE_URL)
│   ├── settings/prod.py    продакшен: усе з оточення
│   └── urls.py             підключає urls.py кожного додатку під /api/
├── core/                   абстрактні моделі (TimeStamped, SoftDelete, Versioned), ролі, /health
├── accounts/               авторизація: users, memberships, devices, JWT, PIN, logout
├── catalog/                номенклатура: categories, units, products, product_units, barcodes, import_jobs
├── inventory/              склади, залишки, документи, проведення, звіти, dashboard
├── sync/                   синхронізація push/pull + нотифікації (sync_batches, sync_conflicts, notifications)
├── postman/                колекція Postman
└── conftest.py             спільні фікстури для тестів
```

## Архітектура

**Модульний моноліт із шаровою архітектурою (Modular Monolith + Layered / Service Layer).**

- **Модульний моноліт** — один застосунок і одна база, поділені на незалежні модулі (Django-додатки) за предметними областями: `accounts`, `catalog`, `inventory`, `sync` + спільний `core`.
- **Шари всередині модуля** — залежності йдуть лише вниз:

```
HTTP-запит
   ↓
views.py         тільки HTTP: розібрати запит, викликати сервіс/селектор, повернути відповідь
   ↓
serializers.py   перевірка й перетворення даних (JSON ↔ модель)
   ↓
services.py      зміни: бізнес-правила, права доступу, транзакції (проведення, синхронізація, вхід)
selectors.py     читання: запити й звіти без побічних ефектів
   ↓
models.py        таблиці, обмеження БД (CHECK, UNIQUE)
   ↓
PostgreSQL
```

| Файл | Що в ньому | Приклад |
|---|---|---|
| `views.py` | без бізнес-логіки | `DocumentViewSet.post` → `services.ensure_can_post` + `services.post_document` |
| `services.py` | змінює дані | `inventory/services.py`: `post_document`, `receive_document`, `cancel_document`, `ensure_can_edit` |
| `selectors.py` | читає дані | `inventory/selectors.py`: `visible_documents`, `stock_rows`, `dashboard`, `scans_by_hour`; `catalog/selectors.py`: `products_with_stock` |
| `core/exceptions.py` | доменні помилки | `DomainError`, `AccessDenied`, `NotFound` → однакова відповідь `{"detail", "code"}` |

**Чому так:** чіткий розподіл відповідальностей; модулі розробляються незалежно (програміст 1: `accounts`+`sync`, програміст 2: `catalog`+`inventory`); бізнес-логіка тестується без HTTP; одна база дає атомарні транзакції (проведення документа змінює `documents`, `stock`, `stock_movements` разом); просте розгортання; межі модулів дозволяють у майбутньому винести модуль в окремий сервіс. Мікросервіси для одного складу — надмірна складність, «товсті» моделі/views — логіка розмазана і погано тестується.

### Наскрізні правила API

| Правило | Як |
|---|---|
| Версіонування | `/api/v1/...` — основна адреса (у Swagger); `/api/...` — та сама без версії для старих збірок фронтів |
| Помилки | завжди `{"detail": "текст для користувача", "code": "машинний_код"}`: 400 бізнес-правило, 401 вхід, 403 доступ, 404, 423 PIN заблоковано, 429 забагато спроб |
| Обмеження входу | `/auth/login/` і `/auth/pin/` — 10 спроб на хвилину (`THROTTLE_LOGIN`, `THROTTLE_PIN` у `.env`) |
| Пагінація | списки — звичайні масиви; з `?page=` або `?page_size=` → `{"count", "next", "previous", "results"}` (до 500 на сторінку) |

## 1. Postgres у контейнері

```powershell
# з кореня репозиторію
docker compose up -d db          # або: npm run db

cd server
copy .env.example .env           # DATABASE_URL уже вказує на контейнер
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```

Демо-акаунти: `admin@gmail.com / admin` (адміністратор), `manager@gmail.com / manager`, `worker@gmail.com / worker`.

API теж можна підняти в контейнері: `docker compose --profile api up -d`.

> Docker Desktop на Windows потребує WSL 2: `wsl --install` (від адміністратора) і перезавантаження.

## 2. Тестове середовище без фронтенду

| Інструмент | Адреса | Як користуватись |
|---|---|---|
| **Swagger UI** | http://localhost:8000/api/docs/ | `POST /api/auth/login/` → скопіювати `access` → кнопка **Authorize** → `Bearer <access>`. Далі «Try it out» на будь-якому запиті |
| **ReDoc** | http://localhost:8000/api/redoc/ | Документація для читання |
| **OpenAPI-схема** | http://localhost:8000/api/schema/ | Для імпорту в Postman |
| **DRF Browsable API** | будь-яка `/api/...` у браузері, напр. http://localhost:8000/api/products/ | Кнопка **Log in** справа вгорі (`/api-auth/login/`). Видно запити, відповіді, фільтри, форми POST. Увімкнено тільки в `dev` |
| **Postman** | `server/postman/StockFlow.postman_collection.json` (схема для імпорту: `/api/schema/`) | Import → файл. Запит **Auth / Login** сам зберігає токен у `{{access}}` для всіх інших запитів |
| **Django admin** | http://localhost:8000/django-admin/ | Перегляд таблиць |

## 3. Тести (pytest)

```powershell
cd server
python -m pytest                     # усі
python -m pytest accounts            # один додаток
python -m pytest -k "posting"        # за назвою
```

За замовчуванням тести йдуть на SQLite в пам'яті (швидко, без Docker). На справжньому Postgres:

```powershell
$env:TEST_DATABASE_URL="postgres://stockflow:stockflow@localhost:5433/stockflow"; python -m pytest
```

| Додаток | Файли | Що перевіряється |
|---|---|---|
| core | `test_permissions.py` | ролі на конкретному складі, `version` |
| accounts | `test_models.py`, `test_api.py` | email без регістру, одна роль на склад, один склад за замовчуванням, PIN і блокування, пристрої; вхід, PIN-вхід, logout, керування користувачами |
| catalog | `test_models.py`, `test_services.py`, `test_api.py` | унікальність sku/штрихкодів, фасування, сканування упаковки, імпорт CSV, сумісні поля для фронтів |
| inventory | `test_models.py`, `test_services.py`, `test_api.py` | CHECK-обмеження документів, нумерація, проведення всіх 4 типів, скасування, сума рухів = залишок, права, нотифікації після commit |
| sync | `test_models.py`, `test_sync_api.py` | ідемпотентність пакета, конфлікти, стан пристрою замість heartbeat, pull з курсором і нотифікаціями, старий `/api/sync/` |

## 4. Нотифікації всередині синхронізації

- `GET /api/sync/pull/?cursor=...` повертає разом з даними нові `notifications` — окремого опитування немає.
- `POST /api/sync/push/` несе `device: {battery_level, is_charging, app_version}` — окремого heartbeat немає.
- Термінові (`low_stock`, `sync_conflict`, `transfer_incoming`) додатково йдуть як Expo push, якщо `EXPO_PUSH_ENABLED=1`.
- Сповіщення створюються через `transaction.on_commit`, тож відкочена операція нічого не надсилає.
- `python manage.py check_devices` (за розкладом) — нагадування про пристрої, які давно не синхронізувались.

## Основні ендпоінти

Усі шляхи — від `/api/v1/` (або `/api/` для сумісності).

| | |
|---|---|
| `POST auth/login/`, `auth/pin/`, `auth/pin/set/`, `auth/refresh/`, `auth/logout/`, `GET auth/me/` | авторизація |
| `users/`, `memberships/`, `devices/` | керування доступом (адмін) |
| `products/` (+ `by-barcode/?code=`), `categories/`, `units/`, `product-units/`, `barcodes/`, `imports/` (CSV та XLSX) | номенклатура |
| `warehouses/`, `stock/` (+ `history/`), `stock-movements/` | склади й залишки |
| `documents/` (+ `{id}/post/`, `{id}/receive/`, `{id}/cancel/`, `{id}/discrepancies/`, `incoming/`), `dashboard/`, `reports/scans-by-hour/` | документи й звіти |
| `POST sync/push/` (op: `create`, `update`, `delete`, `post`, `receive`), `GET sync/pull/`, `sync/batches/`, `sync/conflicts/` (+ `{id}/resolve/`), `notifications/` | синхронізація |
| `POST sync/` | старий формат поточного мобільного застосунку (сумісність) |

### Переміщення між складами
1. Відправник проводить переміщення → товар списується зі складу-відправника і стає «в дорозі» (`in_transit: true`); працівники складу-одержувача отримують сповіщення.
2. Склад-одержувач бачить його в `documents/incoming/` і підтверджує: `POST documents/{id}/receive/` (або op `receive` у синхронізації) → товар зараховується.
3. Скасування до підтвердження повертає товар відправнику, після — знімає з обох складів.

## Сумісність з поточними фронтами

Схема змінилась (залишки по складах, штрихкоди окремою таблицею), але API віддає й старі поля:
`product.stock` (сума по складах або `?warehouse=`), `product.unit` (назва), `product.barcode` (основний код),
`product.category` (назва); роль `admin` у `/users/` = `is_staff`; старий `/api/sync/` перекладається на push.
Залишок у формі створення товару стає проведеним документом «Прихід» (залишки змінюються лише документами).

## 5. Продакшен (сервер у хмарі)

```
docker-compose.prod.yml   PostgreSQL + API (gunicorn, режим prod) + scheduler (check_devices щогодини) + Caddy (HTTPS)
deploy/Caddyfile          зворотний проксі з автоматичним сертифікатом Let's Encrypt
server/.env.prod.example  домен, секрети, паролі
scripts/backup-db.ps1     резервна копія / відновлення бази
```

```bash
cp server/.env.prod.example server/.env.prod      # заповнити DOMAIN, DJANGO_SECRET_KEY, POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml --env-file server/.env.prod up -d --build
docker compose -f docker-compose.prod.yml exec api python manage.py seed_demo   # за потреби
```

DNS-запис домену має вказувати на сервер. Статику роздає whitenoise, міграції й `collectstatic` виконуються при старті контейнера. Резервна копія: `.\scripts\backup-db.ps1` (додайте `-ComposeFile docker-compose.prod.yml` на сервері; відновлення — `-Restore <файл>`).

Локально планувальник теж можна підняти: `docker compose --profile api up -d` (API + scheduler у контейнерах).

## 6. Доступ з будь-якого телефона через ngrok

```powershell
ngrok config add-authtoken <токен з dashboard.ngrok.com>     # один раз
npm run api                                                 # 1-й термінал (з кореня)
npm run tunnel:api                                          # 2-й: покаже https://xxxx.ngrok-free.app
```

У `mobile/.env`: `EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app/api`, потім `cd mobile; npm run start:tunnel -- -c`. Адреса з `.env` має пріоритет над збереженою, а заголовок `ngrok-skip-browser-warning` вимикає сторінку-попередження ngrok. Постійну адресу дає безкоштовний статичний домен ngrok: `ngrok http --url=<ваш-домен>.ngrok-free.app 8000`.

## 7. CI

`.github/workflows/ci.yml` на кожен пул-реквест і push у `main`: тести бекенду на PostgreSQL, перевірка міграцій і схеми OpenAPI, TypeScript і Jest мобільного застосунку.
