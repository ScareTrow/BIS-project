import logging
import os
import sys
from datetime import datetime, timedelta, timezone
# from aiogram import F
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.website import create_app, db
from backend.website.models import (
    Application, ApplicationMedia, ApplicationCategory, ModerationStatus
)
from backend.telegram_bot.middleware.auth import require_auth
from backend.telegram_bot.utils.helpers import haversine_distance, validate_coordinates
from backend.telegram_bot.states import ApplicationStates

logger = logging.getLogger(__name__)


async def process_description(message: Message, state: FSMContext):
    user = await require_auth(message, state)
    if not user:
        return
    
    try:
        description = ""
        if message.photo:
            description = message.caption or ""
            await state.update_data(photo_file_id=message.photo[-1].file_id)
        elif message.text:
            description = message.text
        
        if not description:
            await message.answer("Отправьте описание заявки")
            return
        
        await state.update_data(description=description)
        await state.set_state(ApplicationStates.waiting_location)
        logger.info(f"Description saved, state set to waiting_location for user {user.id}")
        
        data = await state.get_data()
        help_msg_id = data.get('help_message_id')
        if help_msg_id:
            try:
                await message.bot.delete_message(chat_id=message.chat.id, message_id=help_msg_id)
            except Exception as e:
                logger.debug(f"Could not delete help message: {e}")
                pass
        
        await message.answer(
            "✅ Описание получено!\n\n"
            "📍 Теперь отправь геолокацию для создания заявки (Используй закрепку для шейра)"
        )
    except Exception as e:
        logger.error(f"Error processing description: {e}", exc_info=True)
        await message.answer(f"Произошла ошибка при обработке описания: {str(e)}")


async def process_location(message: Message, state: FSMContext):
    user = await require_auth(message, state)
    if not user:
        return
    
    location = message.location
    
    if not validate_coordinates(location.latitude, location.longitude):
        await message.answer("Некорректные координаты")
        await state.clear()
        return
    
    try:
        flask_app = create_app()
        
        logger.info(f"Processing location for user {user.id}, lat:{location.latitude}, lon: {location.longitude}")
        
        with flask_app.app_context():
            data = await state.get_data()
            description = data.get('description', '')
            
            logger.info(f"State data: description={description[:50] if description else 'None'}, photo_file_id={data.get('photo_file_id')}")
            
            if not description:
                await message.answer("Сначала отправьте описание заявки")
                return
            
            category_str = data.get('category', 'emergency')
            category_map = {
                'food': ApplicationCategory.FOOD,
                'medicine': ApplicationCategory.MEDICINE,
                'shelter': ApplicationCategory.SHELTER,
                'emergency': ApplicationCategory.EMERGENCY
            }
            app_category = category_map.get(category_str.lower(), ApplicationCategory.EMERGENCY)
            
            new_app = Application(
                description=description,
                latitude=location.latitude,
                longitude=location.longitude,
                category=app_category,
                expires_at=datetime.now(timezone.utc) + timedelta(days=3),
                is_sos=False,
                user_id=user.id,
                moderation_status=ModerationStatus.PENDING
            )
            
            db.session.add(new_app)
            db.session.flush()
            
            photo_file_id = data.get('photo_file_id')
            if photo_file_id:
                try:
                    file = await message.bot.get_file(photo_file_id)
                    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                    uploads_dir = os.path.join(backend_dir, 'instance', 'uploads')
                    os.makedirs(uploads_dir, exist_ok=True)
                    file_path = os.path.join(
                        uploads_dir,
                        f"telegram_{new_app.id}_{file.file_id}.jpg"
                    )
                    await message.bot.download_file(file.file_path, file_path)
                    
                    media = ApplicationMedia(
                        application_id=new_app.id,
                        file_path=os.path.basename(file_path),
                        file_type='image/jpeg'
                    )
                    db.session.add(media)
                except Exception as e:
                    logger.error(f"Error saving photo: {e}")
            
            db.session.commit()
            logger.info(f"Application created successfully: ID={new_app.id}, user_id={user.id}")
            
            data = await state.get_data()
            help_msg_id = data.get('help_message_id')
            if help_msg_id:
                try:
                    await message.bot.delete_message(chat_id=message.chat.id, message_id=help_msg_id)
                except:
                    pass
            
            await state.clear()
            
            success_text = (
                f"<b>Заявка создана!</b> 🎉\n\n"
                f"ID: <code>{new_app.id}</code>\n"
                f"Категория: {app_category.value}\n\n"
                "⏳ Ожидает модерации. Ты получишь уведомление при одобрении"
            )
            
            await message.answer(success_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Error processing location: {e}", exc_info=True)
        await message.answer(f"Произошла ошибка при создании заявки: {str(e)}")
        await state.clear()


async def process_sos_location(message: Message, state: FSMContext):
    user = await require_auth(message, state)
    if not user:
        return
    
    location = message.location
    
    if not validate_coordinates(location.latitude, location.longitude):
        await message.answer("Некорректные координаты")
        await state.clear()
        return
    
    try:
        flask_app = create_app()
        
        with flask_app.app_context():
            new_app = Application(
                description="SOS - Экстренная ситуация",
                latitude=location.latitude,
                longitude=location.longitude,
                category=ApplicationCategory.EMERGENCY,
                expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                is_sos=True,
                user_id=user.id,
                moderation_status=ModerationStatus.PENDING
            )
            
            existing_sos = Application.query.filter_by(is_sos=True).all()
            new_app.sos_count = 1
            
            for existing in existing_sos:
                distance = haversine_distance(
                    location.latitude, location.longitude,
                    existing.latitude, existing.longitude
                )
                if distance <= 500:
                    existing.sos_count += 1
                    new_app.sos_count += 1
                    if existing.sos_count >= 3 or new_app.sos_count >= 3:
                        logger.warning(f"ALERT: Multiple SOS detected! Count: {new_app.sos_count}")
            
            db.session.add(new_app)
            db.session.commit()
            
            data = await state.get_data()
            help_msg_id = data.get('help_message_id')
            if help_msg_id:
                try:
                    await message.bot.delete_message(chat_id=message.chat.id, message_id=help_msg_id)
                except:
                    pass
            
            await state.clear()
            
            sos_text = (
                f"🚨 <b>SOS заявка создана!</b>\n\n"
                f"📋 ID: <code>{new_app.id}</code>\n"
                f"📍 Координаты: {location.latitude:.4f}, {location.longitude:.4f}\n"
                f"⚠️ Количество SOS в радиусе: {new_app.sos_count}\n\n"
                "⏳ Ожидает модерации. Помощь уже в пути!"
            )
            
            await message.answer(sos_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Error processing SOS location: {e}", exc_info=True)
        await message.answer(f"Ошибка создании сос заявки: {str(e)}")
        await state.clear()

