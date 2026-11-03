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

Кожен додаток: `models.py`, `serializers.py`, `services.py` (бізнес-логіка), `views.py`, `urls.py`, `admin.py`, `tests/`.

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
| **Postman** | `server/postman/StockFlow.postman_collection.json` | Import → файл. Запит **Auth / Login** сам зберігає токен у `{{access}}` для всіх інших запитів |
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

| | |
|---|---|
| `POST /api/auth/login/`, `/auth/pin/`, `/auth/pin/set/`, `/auth/refresh/`, `/auth/logout/`, `GET /auth/me/` | авторизація |
| `/api/users/`, `/memberships/`, `/devices/` | керування доступом (адмін) |
| `/api/products/` (+ `by-barcode/?code=`), `/categories/`, `/units/`, `/product-units/`, `/barcodes/`, `/imports/` | номенклатура |
| `/api/warehouses/`, `/stock/` (+ `history/`), `/stock-movements/` | склади й залишки |
| `/api/documents/` (+ `{id}/post/`, `{id}/cancel/`, `{id}/discrepancies/`), `/dashboard/` | документи |
| `POST /api/sync/push/`, `GET /api/sync/pull/`, `/sync/batches/`, `/sync/conflicts/` (+ `{id}/resolve/`), `/notifications/` | синхронізація |
| `POST /api/sync/` | старий формат поточного мобільного застосунку (сумісність) |

## Сумісність з поточними фронтами

Схема змінилась (залишки по складах, штрихкоди окремою таблицею), але API віддає й старі поля:
`product.stock` (сума по складах або `?warehouse=`), `product.unit` (назва), `product.barcode` (основний код),
`product.category` (назва); роль `admin` у `/users/` = `is_staff`; старий `/api/sync/` перекладається на push.
Залишок у формі створення товару стає проведеним документом «Прихід» (залишки змінюються лише документами).
