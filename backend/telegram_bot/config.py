import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
    WEB_APP_URL = os.getenv('WEB_APP_URL', 'http://localhost:3000')
    API_URL = os.getenv('API_URL', 'http://localhost:5000')
    
    @classmethod
    def validate(cls):
        if not cls.TELEGRAM_BOT_TOKEN:
            raise ValueError("TELEGRAM_BOT_TOKEN not set in environment variables")
        return True

