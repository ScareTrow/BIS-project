from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

from backend.telegram_bot.middleware.auth import require_auth
from backend.telegram_bot.states import ApplicationStates

BOT_CATEGORIES = {
    'food': '🛒 Продукты',
    'clothing': '👕 Вещи',
    'household': '🔧 Бытовая помощь',
    'delivery': '🚚 Доставка',
    'volunteering': '🤝 Волонтёрство',
    'social_project': '👥 Социальные инициативы',
    'medicine': '💊 Медицина',
    'shelter': '🏠 Убежище',
}


async def cmd_create(message: Message, state: FSMContext):
    if not await require_auth(message, state):
        return
    if message.chat.type != 'private':
        await message.answer('Откройте личный чат с ботом, чтобы создать заявку.')
        return
    await state.clear()
    keyboard = InlineKeyboardBuilder()
    for code, label in BOT_CATEGORIES.items():
        keyboard.button(text=label, callback_data=f'cat:{code}')
    keyboard.adjust(2)
    keyboard.row(InlineKeyboardButton(text='⬅️ Отмена', callback_data='cat:cancel'))
    prompt = await message.answer('Выберите категорию:', reply_markup=keyboard.as_markup())
    await state.update_data(category_message_id=prompt.message_id, sos_mode=False)
    await state.set_state(ApplicationStates.waiting_category)


async def select_category(callback: CallbackQuery, state: FSMContext):
    from backend.telegram_bot.utils.database import get_user_by_telegram_id
    source = callback.message
    data = await state.get_data()
    if (not isinstance(source, Message) or source.chat.type != 'private'
            or data.get('category_message_id') != source.message_id
            or await state.get_state() != ApplicationStates.waiting_category.state
            or not get_user_by_telegram_id(str(callback.from_user.id))):
        await callback.answer('Этот выбор больше недоступен.', show_alert=True)
        return
    code = callback.data.split(':', 1)[1]
    if code == 'cancel':
        await state.clear()
        await callback.answer()
        await source.edit_text('Создание заявки отменено.')
        return
    if code not in BOT_CATEGORIES:
        await callback.answer('Неизвестная категория.', show_alert=True)
        return
    await state.update_data(category=code)
    await state.set_state(ApplicationStates.waiting_description)
    await callback.answer()
    await source.edit_text(
        f'Категория: {BOT_CATEGORIES[code]}\n\n'
        'Отправьте описание длиной от 10 до 1000 символов. '
        'Затем приложите фото JPEG/PNG до 10 МБ и отправьте геолокацию.'
    )


async def prompt_category(message: Message):
    await message.answer('Выберите категорию кнопкой в сообщении выше.')
