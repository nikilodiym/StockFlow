# StockFlow
Система складського обліку: Django REST API, React адмінпанель, React Native Android-клієнт.

## Запуск демо на Windows

Підготуйте API та демо-акаунти (виконується один раз). Потрібен Docker Desktop для PostgreSQL; детально — [server/README.md](server/README.md).

```powershell
docker compose up -d db
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
python manage.py migrate
python manage.py seed_demo
cd ..
```

Запустіть API та вебпанель у двох окремих вікнах PowerShell з кореня проєкту:

```powershell
npm run api
```

```powershell
npm install
npm run dev
```

Відкрийте адресу Vite, яку покаже термінал (зазвичай `http://localhost:5173`). Вебпанель підключається до API на `http://localhost:8000/api`.

Демо для локального запуску: `admin@gmail.com` / `admin`, `manager@gmail.com` / `manager`, `worker@gmail.com` / `worker`.

Swagger: `http://localhost:8000/api/docs/`, Browsable API: будь-яка `http://localhost:8000/api/...` у браузері, тести: `npm run test:api`.

## Мобільний клієнт

Архітектура (feature-based) і деталі — у [mobile/README.md](mobile/README.md). Запуск з папки `mobile`:

```powershell
cd mobile
npm install
npx expo start
npm test   # тести мобільного застосунку
```

Або з кореня репозиторію запустіть `npm run mobile`.
Передбачені Expo SQLite офлайн-черга та ручне введення; для камери використовується expo-camera. Для реального Android сканування потрібен Android-пристрій/емулятор та збірка Expo.

Для PostgreSQL задайте DATABASE_URL і DJANGO_SECRET_KEY. У продакшені вимкнути DEBUG, обмежити ALLOWED_HOSTS, налаштувати HTTPS, секрети та резервне копіювання.


### Підключення телефона/емулятора до API

Доступ з будь-якої мережі (не лише спільна Wi-Fi) — через ngrok, див. `server/README.md`, розділ 6. Продакшен на сервері з HTTPS — розділ 5.

Застосунок сам шукає сервер при запуску і при вході: спершу збережена адреса, потім IP комп'ютера, з якого завантажено застосунок (Metro), потім `10.0.2.2` (Android-емулятор) і `localhost`. Тому він працює на будь-якому емуляторі (Pixel 6, Pixel 9 …) і на фізичному телефоні без ручного налаштування. Адресу завжди можна задати вручну в «Налаштуваннях».

Якщо пише «Немає з'єднання» / «Не вдалося увійти»:

1. **База і API запущені:** `docker compose up -d db`, потім `npm run api` (слухає `0.0.0.0:8000`, тобто доступний з мережі). Без бази API не стартує або вхід падає; кнопка «Перевірити з'єднання» тепер прямо пише «база даних недоступна».
2. **Фізичний телефон — у тій самій Wi-Fi**, що й комп'ютер (не мобільний інтернет, не гостьова мережа).
3. **Брандмауер Windows пропускає порт 8000** (один раз, PowerShell від адміністратора):
   ```powershell
   New-NetFirewallRule -DisplayName "StockFlow API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
   ```
   Мережа Wi-Fi у Windows має бути «Приватна» (Параметри → Мережа → властивості).
4. **Перевірка з телефона:** відкрийте в браузері телефона `http://<IPv4 комп'ютера>:8000/api/health/` (IPv4 — з `ipconfig`). Якщо сторінка не відкривається — проблема в мережі/брандмауері, а не в застосунку.

Для зовнішнього використання потрібен HTTPS.

Експорт Android JavaScript bundle: `cd mobile`, `npx expo export --platform android --no-bytecode`. Це не APK. Для встановлюваної Android-збірки потрібен Android SDK/Android Studio або налаштований EAS Build.

У поточному демо адмінпанель має моковані ряди графіків, а клієнт мобільного застосунку — локальну початкову номенклатуру. Деякі повні функції ТЗ (екран розв'язання конфліктів, push-сповіщення, імпорт CSV/Excel та повне редагування документів) ще потребують реалізації.
