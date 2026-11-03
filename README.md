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

Запускайте Expo з папки `mobile`, щоб він використовував `expo-router/entry`:

```powershell
cd mobile
npm install
npx expo start
```

Або з кореня репозиторію запустіть `npm run mobile`.
Передбачені Expo SQLite офлайн-черга та ручне введення; для камери використовується expo-camera. Для реального Android сканування потрібен Android-пристрій/емулятор та збірка Expo.

Для PostgreSQL задайте DATABASE_URL і DJANGO_SECRET_KEY. У продакшені вимкнути DEBUG, обмежити ALLOWED_HOSTS, налаштувати HTTPS, секрети та резервне копіювання.


Android-емулятор звертається до комп'ютера за адресою `http://10.0.2.2:8000/api`. На фізичному телефоні відкрийте «Налаштування» у застосунку й укажіть IPv4-адресу комп'ютера в локальній мережі. Для зовнішнього використання потрібен HTTPS.

Експорт Android JavaScript bundle: `cd mobile`, `npx expo export --platform android --no-bytecode`. Це не APK. Для встановлюваної Android-збірки потрібен Android SDK/Android Studio або налаштований EAS Build.

У поточному демо адмінпанель має моковані ряди графіків, а клієнт мобільного застосунку — локальну початкову номенклатуру. Деякі повні функції ТЗ (екран розв'язання конфліктів, push-сповіщення, імпорт CSV/Excel та повне редагування документів) ще потребують реалізації.
