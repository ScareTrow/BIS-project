# ASAR Telegram Bot

Отдельный сервис для работы с Telegram ботом платформы ASAR.

## Установка

1. Установите зависимости:
```bash
pip install aiogram
```

2. Настройте переменные окружения в `.env`:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
WEB_APP_URL=http://localhost:5000
```

## Запуск

```bash
python telegram_bot/bot.py
```

## Функционал

- `/start` - Авторизация и начало работы
- `/create` - Создание заявки
- `/sos` - Экстренная ситуация
- `/resources` - Просмотр точек ресурсов
- `/help` - Справка

## Интеграция с веб-приложением

Бот использует общую базу данных с веб-приложением через Flask app context.

