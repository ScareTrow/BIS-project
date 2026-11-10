import io
import logging
from datetime import datetime, timedelta, timezone

from aiogram.fsm.context import FSMContext
from aiogram.types import Message
from werkzeug.datastructures import FileStorage
from werkzeug.exceptions import HTTPException

from backend.website import create_app, db
from backend.website.models import Application, ApplicationCategory, ModerationStatus
from backend.website.application_service import check_requester, publish_sos, save_photos
from backend.website.validation import coordinates, validate_photos, MAX_FILE_BYTES
from backend.telegram_bot.middleware.auth import require_auth
from backend.telegram_bot.states import ApplicationStates

logger = logging.getLogger(__name__)


def photo_reference(message):
    if message.photo:
        photo = message.photo[-1]
        return photo.file_id, 'proof.jpg', photo.file_size
    document = message.document
    if document and document.file_name and document.file_name.lower().endswith(('.jpg', '.jpeg', '.png')):
        return document.file_id, document.file_name, document.file_size
    return None


async def remember_photo(message, state):
    photo = photo_reference(message)
    if not photo:
        await message.answer('Отправьте фотографию JPEG/PNG, до 10 МБ')
        return False
    if photo[2] and photo[2] > MAX_FILE_BYTES:
        await message.answer('Файл слишком большой (максимум 10 МБ)')
        return False
    await state.update_data(photo_file_id=photo[0], photo_filename=photo[1])
    return True


async def process_description(message: Message, state: FSMContext):
    if not await require_auth(message, state):
        return
    from backend.website.views import validate_description
    description = (message.caption if message.photo or message.document else message.text) or ''
    valid, error = validate_description(description.strip())
    if not valid:
        await message.answer(error)
        return
    await state.update_data(description=description.strip())
    if message.photo or message.document:
        if not await remember_photo(message, state):
            return
        await state.set_state(ApplicationStates.waiting_location)
        await message.answer('Описание и фото получены. Отправьте геолокацию заявки.')
    else:
        await state.set_state(ApplicationStates.waiting_photo)
        await message.answer('Теперь отправьте фотографию JPEG/PNG, до 10 МБ.')


async def process_photo(message: Message, state: FSMContext):
    if not await require_auth(message, state):
        return
    if await remember_photo(message, state):
        data = await state.get_data()
        await state.set_state(ApplicationStates.waiting_sos_location if data.get('sos_mode') else ApplicationStates.waiting_location)
        await message.answer('Фото получено. Отправьте геолокацию: текущую или выбранную вручную в Telegram.')


async def create_at_location(message, state, *, sos):
    user = await require_auth(message, state)
    if not user:
        return
    data = await state.get_data()
    if not data.get('photo_file_id'):
        await state.update_data(sos_mode=sos)
        await state.set_state(ApplicationStates.waiting_photo)
        await message.answer('Для заявки нужна фотография JPEG/PNG, до 10 МБ.')
        return
    app = create_app()
    with app.app_context():
        try:
            latitude, longitude = coordinates(message.location.latitude, message.location.longitude)
            file = await message.bot.get_file(data['photo_file_id'])
            if file.file_size and file.file_size > MAX_FILE_BYTES:
                raise ValueError('Файл слишком большой (максимум 10 МБ)')
            content = io.BytesIO()
            await message.bot.download_file(file.file_path, destination=content)
            content.seek(0)
            photo = FileStorage(stream=content, filename=data.get('photo_filename', 'proof.jpg'))
            validate_photos([photo])
            requester = check_requester(user.id, sos=sos)
            from backend.website.views import validate_description, sanitize_description
            description = 'SOS — Экстренная ситуация' if sos else data.get('description', '')
            valid, error = validate_description(description)
            if not valid:
                raise ValueError(error)
            application = Application(description=sanitize_description(description),
                latitude=latitude, longitude=longitude,
                category=ApplicationCategory.EMERGENCY if sos else ApplicationCategory(data.get('category', 'household')),
                user_id=requester.id, city=requester.city, created_via='telegram',
                moderation_status=ModerationStatus.PENDING, status='pending',
                expires_at=datetime.now(timezone.utc) + timedelta(days=1 if sos else 3))
            db.session.add(application)
            db.session.flush()
            save_photos(application, [photo])
            if sos:
                publish_sos(application)
            else:
                from backend.website.community import apply_triage
                apply_triage(application)
            db.session.commit()
            aid = application.id
        except (ValueError, HTTPException) as error:
            db.session.rollback()
            await message.answer(error.description if isinstance(error, HTTPException) else str(error))
            return
        except Exception:
            db.session.rollback()
            logger.exception('Unable to create Telegram request')
            await message.answer('Не удалось сохранить заявку. Попробуйте ещё раз.')
            return
    await state.clear()
    await message.answer(f'Заявка #{aid} создана. ' + (
        'SOS сразу опубликован на карте. Ближайшим волонтёрам отправлено оповещение.'
        if sos else 'Ожидает проверки модератором.'))


async def process_location(message: Message, state: FSMContext):
    await create_at_location(message, state, sos=False)


async def process_sos_location(message: Message, state: FSMContext):
    await create_at_location(message, state, sos=True)


async def save_volunteer_location(message: Message, state: FSMContext):
    user = await require_auth(message, state)
    if not user:
        return
    from backend.website.models import VolunteerPreference
    app = create_app()
    with app.app_context():
        latitude, longitude = coordinates(message.location.latitude, message.location.longitude)
        pref = db.session.get(VolunteerPreference, user.id)
        if pref is None:
            pref = VolunteerPreference(user_id=user.id)
            db.session.add(pref)
        pref.latitude, pref.longitude = latitude, longitude
        db.session.commit()
    await state.clear()
    await message.answer('Местоположение сохранено. Вы будете получать заявки в радиусе 10 км. Изменить или удалить точку можно в профиле на сайте.')
