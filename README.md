# ASAR Platform

Платформа для экстренной помощи и обмена ресурсами

## Требования

- Python 3.13
- PostgreSQL
- Node.js 18+

## Установка

### 1. Установка зависимостей

```bash
cd backend
pip install -r requirements.txt
```

### Установка Next.js

```bash
cd frontend
npm install
```

#### Настройка

Создайте файл `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Запуск

#### Development режим

```bash
npm run dev
```

Аппка будет воркать по адресу [http://localhost:3000](http://localhost:3000)

#### Production сборка

```bash
npm run build
npm start
```
 

### 2. Установка PostgreSQL

#### Windows

1. Скачайть установщик с https://www.postgresql.org/download/windows/
2. Запустить мануальный установщик
3. Запомнить (обязательно) пароль для пользователя `postgres` (будет использован в .env)

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS

```bash
brew install postgresql
brew services start postgresql
```

### 3. Создание базы данных

Подключись к PostgreSQL:

```bash
psql -U postgres
```

Создай базу данных:

```sql
CREATE DATABASE asar_db;
\q
```

Или через командную строку:

```bash
psql -U postgres -c "CREATE DATABASE asar_db;"
```

### 4. Настройка переменных окружения

Создать файл `.env` в корне проекта (скопируй из `.env.example`):

```bash
cp .env.example .env
# Отредактируй .env файл и заполни свои данные
```

Пример содержимого `.env`:

```env
SECRET_KEY=your-secret-key-here
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=asar_db
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
WEB_APP_URL=http://localhost:5000
FLASK_DEBUG=False
```

### 5. Синхронизация базы данных

#### Первая настройка (новый разработчик):

1. Убедитесь, что база данных `asar_db` создана (см. шаг 3)

2. Примените миграции базы данных:
   ```bash
   cd backend
   flask --app main:app db upgrade
   ```

3. (Опционально) Загрузите тестовые данные:
   ```bash
   psql -U postgres -d asar_db -f seed_data.sql
   ```

#### После получения изменений из Git:

Если были добавлены новые миграции базы данных:
```bash
cd backend
flask --app main:app db upgrade
```

#### Создание новой миграции:

После изменения моделей в `backend/website/models.py`:
```bash
cd backend
flask --app main:app db migrate -m "Описание изменений"
flask --app main:app db upgrade
git add backend/migrations/
git commit -m "Add migration: Описание изменений"
```

### 6. Создание первого супер-администратора

```bash
cd backend
python create_super_admin.py
```

### 7. Запуск приложения

```bash
cd backend
python main.py
```

Если все ок:

```
Connecting to PostgreSQL database: asar_db@localhost:5432
Database tables created/verified
```

## Запуск Telegram бота

В отдельном терминале прописать:

```bash
cd backend
python telegram_bot/bot.py
```

### Настройка Telegram бота

1. Создай бота через [@BotFather](https://t.me/BotFather)
2. Получи токен бота
3. Добавь токен в `.env` файл:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   ```

### Функционал бота

- `/start` - Авторизация и начало работы
- `/create` - Создание заявки
- `/sos` - Экстренная ситуация
- `/resources` - Просмотр точек ресурсов
- `/help` - Справка

## Настройка DataGrip / DBeaver

### Подключение к базе данных

1. Создайте новое подключение PostgreSQL в DataGrip/DBeaver:
   - **Host**: `localhost` (или значение из `.env`)
   - **Port**: `5432` (или значение из `.env`)
   - **Database**: `asar_db` (или значение из `.env`)
   - **User**: `postgres` (или значение из `.env`)
   - **Password**: пароль из вашего `.env` файла

2. После подключения обновите схему базы данных:
   - В DataGrip: правый клик на базе данных → **Refresh** (или F5)
   - В DBeaver: правый клик на базе данных → **Refresh**

3. Если таблицы не видны:
   - Убедитесь, что PostgreSQL запущен
   - Проверьте, что база данных `asar_db` существует
   - Убедитесь, что миграции применены: `flask --app main:app db upgrade`

### Проверка подключения через psql

```bash
psql -U postgres -d asar_db
\dt  # список таблиц
\q   # выход
```

## Отладка карты

### API ключ не требуется 

Leaflet с OpenStreetMap работает бесплатно без апишки

### Проверка загрузки карты

1. Открой браузер и перейди на главную страницу
2. Открой консоль разработчика (F12)
3. Проверь сообщения в консоли:
   - Должно быть: "Page loaded, checking for Leaflet and map container..."
   - Должно быть: "All dependencies ready, initializing map..."
   - Должно быть: "Map initialized successfully"

## Структура проекта

```
backend/
  ├── website/              # Основное веб-приложение Flask
  │   ├── templates/        # HTML шаблоны
  │   ├── static/           # Статические файлы (CSS, JS, изображения)
  │   ├── models.py         # Модели базы данных
  │   ├── views.py          # Маршруты и логика
  │   └── auth.py           # Аутентификация
  ├── telegram_bot/         # Telegram бот (отдельный сервис)
  │   ├── handlers/         # Обработчики команд
  │   ├── middleware/       # Middleware
  │   ├── utils/            # Утилиты
  │   └── bot.py            # Точка входа бота
  ├── instance/             # Загруженные файлы
  ├── main.py              # Точка входа Flask приложения
  └── requirements.txt     # Зависимости Python

frontend/
  ├── app/                      # Маршруты Next.js (App Router)
  │   ├── layout.tsx           # Общий layout
  │   ├── page.tsx             # Главная
  │   ├── applications/        # Раздел заявок
  │   │   └── [id]/            # Динамический маршрут
  │   │       └── page.tsx
  │   └── profile/             # Профиль пользователя
  │       ├── layout.tsx
  │       └── page.tsx
  ├── components/              # Повторно используемые компоненты
  │   ├── common/              # Общие UI-элементы
  │   │   ├── CategoryBadge.tsx
  │   │   └── SearchBar.tsx
  │   ├── home/                # Компоненты домашней страницы
  │   │   ├── ApplicationMarker.tsx
  │   │   ├── ListView.tsx
  │   │   ├── MapView.tsx
  │   │   ├── MapView.client.tsx
  │   │   └── ViewToggle.tsx
  │   └── layout/              # Навигация, шапка, подвал
  │       ├── Header.tsx
  │       ├── Footer.tsx
  │       └── NotificationsDropdown.tsx
  ├── hooks/                   # Кастомные React-хуки
  │   ├── useUser.ts
  │   └── useFetch.ts
  ├── lib/                     # Вспомогательная логика
  │   ├── api.ts               # API клиент
  │   ├── constants.ts
  │   └── helpers.ts
  ├── styles/                  # Глобальные и модульные стили
  │   ├── globals.css
  │   └── variables.css
  ├── public/                  # Статические ресурсы
  │   ├── images/
  │   └── icons/
  ├── types/                   # TS типы
  │   ├── application.d.ts
  │   └── user.d.ts
  ├── next.config.js
  ├── tsconfig.json
  ├── package.json
  └── .gitignore

```

## Функционал

### Для пользователей:
- Просмотр карты с точками интереса (ЧП, ресурсы, медикаменты)
- Создание заявок через веб-интерфейс или Telegram бота
- Отклик на заявки других пользователей
- Система рейтингов и бейджей
- SOS функционал для экстренных ситуаций
- Привязка Telegram аккаунта для работы через бота

### Для модераторов:
- Модерация заявок (одобрение/отклонение)
- Статистика и аналитика
- Управление пользователями
- Создание новых администраторов (только супер-админ)


