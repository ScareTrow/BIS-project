# Синхронизация базы данных для разработчиков

## Быстрый старт

### Первая настройка (новый разработчик)

1. **Создать базу данных** (если еще не создана):
   ```bash
   psql -U postgres -c "CREATE DATABASE asar_db;"
   ```

2. **Настройка `.env`** в корне проекта:
   ```bash
   cp .env.example .env
   # Отредачь .env и заполни свои данные БД
   ```

3. **Применить миграции**:
   ```bash
   cd backend
   flask --app main:app db upgrade
   ```

4. **(Опционально) Загрузить тестовые данные**:
   ```bash
   psql -U postgres -d asar_db -f seed_data.sql
   ```

### После получения изменений из Git

Если кто-то добавил новые миграции:

```bash
cd backend
flask --app main:app db upgrade
```

## Работа с миграциями

### Создание новой миграции

После изменения моделей в `backend/website/models.py`:

```bash
cd backend
flask --app main:app db migrate -m "Описание изменений"
flask --app main:app db upgrade  # Применить миграцию локально
```

### Коммит миграций

```bash
git add backend/migrations/versions/*.py
git commit -m "Add migration: Описание изменений"
git push
```

### Откат миграции

Если нужно откатить последнюю миграцию:

```bash
cd backend
flask --app main:app db downgrade -1
```

## Настройка DataGrip

1. Создай новое подключение PostgreSQL:
   - Host: `localhost` (или из `.env`)
   - Port: `5432` (или из `.env`)
   - Database: `asar_db` (или из `.env`)
   - User: `postgres` (или из `.env`)
   - Password: из твоего `.env`

2. После подключения обнови схему: **F5** или правый клик → **Refresh**

3. Если таблицы не видны:
   - Проверь, что PostgreSQL запущен
   - Убедись, что миграции применены: `flask --app main:app db upgrade`

## Полезные команды

```bash
# Просмотр текущей версии миграции
flask --app main:app db current

# Просмотр истории миграций
flask --app main:app db history

# Сброс базы данных (ОСТОРОЖНО: удалит все данные!)
cd backend
python reset_database.py
flask --app main:app db upgrade
```

## Troubleshooting

### Ошибка: "Could not locate a Flask application"

Используйте явное указание приложения:
```bash
flask --app main:app db <command>
```

Или создайте файл `backend/.flaskenv`:
```
FLASK_APP=main:app
```

### Таблицы не видны в DataGrip

1. Проверь подключение к правильной базе данных
2. Убедись, что миграции применены: `flask --app main:app db upgrade`
3. Обновите схему в DataGrip (F5)

### Конфликт миграций

Если возник конфликт версий миграций:
```bash
# Просмотрите текущую версию
flask --app main:app db current

# Примените все миграции до последней
flask --app main:app db upgrade head
```

