# StockFlow
Система складського обліку: Django REST API, React адмінпанель, React Native Android-клієнт.

## API локально
```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py makemigrations inventory
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```
Демо: admin@gmail.com / admin (тільки для локального запуску).

## Вебпанель
```powershell
cd web
npm install
npm run dev
```
Вебпанель спробує під'єднатись до API на http://localhost:8000/api і показує демо-дані, якщо API не запущено.

## Мобільний клієнт
```powershell
cd mobile
npm install
npx expo start
```
Передбачені Expo SQLite офлайн-черга та ручне введення; для камери використовується expo-camera. Для реального Android сканування потрібен Android-пристрій/емулятор та збірка Expo.

Для PostgreSQL задайте DATABASE_URL і DJANGO_SECRET_KEY. У продакшені вимкнути DEBUG, обмежити ALLOWED_HOSTS, налаштувати HTTPS, секрети та резервне копіювання.


# PostgreSQL для розробки
У корені проєкту: `docker compose up -d db`, далі для API встановіть `DATABASE_URL` та `DJANGO_SECRET_KEY` як у `server/.env.example`.

Android-емулятор звертається до комп'ютера за адресою `http://10.0.2.2:8000/api`. На фізичному телефоні відкрийте «Налаштування» у застосунку й укажіть IPv4-адресу комп'ютера в локальній мережі. Для зовнішнього використання потрібен HTTPS.

Експорт Android JavaScript bundle: `cd mobile`, `npx expo export --platform android --no-bytecode`. Це не APK. Для встановлюваної Android-збірки потрібен Android SDK/Android Studio або налаштований EAS Build.

У поточному демо адмінпанель має моковані ряди графіків, а клієнт мобільного застосунку — локальну початкову номенклатуру. Деякі повні функції ТЗ (екран розв'язання конфліктів, push-сповіщення, імпорт CSV/Excel та повне редагування документів) ще потребують реалізації.
