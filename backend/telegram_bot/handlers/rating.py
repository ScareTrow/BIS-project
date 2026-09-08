import logging
from aiogram import F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from backend.telegram_bot.utils.database import get_user_by_telegram_id
from backend.website import create_app, db
from backend.website.models import Application, ApplicationResponse, ResponseStatus, Rating, User

logger = logging.getLogger(__name__)


class RatingStates(StatesGroup):
    waiting_rating = State()
    waiting_comment = State()


async def cmd_rate(message: Message, state: FSMContext):
    telegram_id = str(message.from_user.id)
    
    try:
        flask_app = create_app()
        with flask_app.app_context():
            user = get_user_by_telegram_id(telegram_id)
            if not user:
                await message.answer("❌ Сначала привяжи свой Telegram аккаунт к сайту. Используй /start для инструкций.")
                return
            
            applications = Application.query.filter_by(
                user_id=user.id,
                is_resolved=True
            ).all()
            
            unrated_applications = []
            for app in applications:
                accepted_responses = ApplicationResponse.query.filter_by(
                    application_id=app.id,
                    status=ResponseStatus.ACCEPTED
                ).all()
                
                for response in accepted_responses:
                    existing_rating = Rating.query.filter_by(
                        rater_id=user.id,
                        rated_id=response.responder_id,
                        application_id=app.id
                    ).first()
                    if not existing_rating:
                        helper = User.query.get(response.responder_id)
                        if helper:
                            unrated_applications.append({
                                'app_id': app.id,
                                'helper_id': helper.id,
                                'helper_name': f"{helper.first_name} {helper.last_name or ''}".strip(),
                                'app_description': app.description[:50] + '...' if len(app.description) > 50 else app.description
                            })
            
            if not unrated_applications:
                await message.answer("✅ У тебя нет неоцененных волонтеров.")
                return
            
            keyboard_buttons = []
            for item in unrated_applications[:10]:
                keyboard_buttons.append([
                    InlineKeyboardButton(
                        text=f"Заявка #{item['app_id']} - {item['helper_name']}",
                        callback_data=f"rate_{item['app_id']}_{item['helper_id']}"
                    )
                ])
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
            
            await message.answer(
                "⭐ Выбери волонтера для оценки:\n\n" +
                "\n".join([f"• Заявка #{item['app_id']} - {item['helper_name']}" for item in unrated_applications[:10]]),
                reply_markup=keyboard
            )
    except Exception as e:
        logger.error(f"Error in cmd_rate: {e}", exc_info=True)
        await message.answer("😔 Произошла ошибка. Попробуй позже")


async def handle_rate_callback(callback: CallbackQuery, state: FSMContext):
    try:
        data = callback.data.split('_')
        app_id = int(data[1])
        helper_id = int(data[2])
        
        await state.update_data(app_id=app_id, helper_id=helper_id)
        await state.set_state(RatingStates.waiting_rating)
        
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="⭐ 5", callback_data="rating_5")],
                [InlineKeyboardButton(text="⭐ 4", callback_data="rating_4")],
                [InlineKeyboardButton(text="⭐ 3", callback_data="rating_3")],
                [InlineKeyboardButton(text="⭐ 2", callback_data="rating_2")],
                [InlineKeyboardButton(text="⭐ 1", callback_data="rating_1")],
            ]
        )
        
        await callback.message.edit_text(
            "⭐ Выбери оценку (1-5):",
            reply_markup=keyboard
        )
        await callback.answer()
    except Exception as e:
        logger.error(f"Error in handle_rate_callback: {e}", exc_info=True)
        await callback.answer("Ошибка", show_alert=True)


async def handle_rating_callback(callback: CallbackQuery, state: FSMContext):
    try:
        rating_value = int(callback.data.split('_')[1])
        state_data = await state.get_data()
        app_id = state_data.get('app_id')
        helper_id = state_data.get('helper_id')
        
        if not app_id or not helper_id:
            await callback.answer("Ошибка данных", show_alert=True)
            return
        
        await state.update_data(rating_value=rating_value)
        await state.set_state(RatingStates.waiting_comment)
        
        await callback.message.edit_text(
            "💬 Напиши комментарий к оценке (или отправь /skip чтобы пропустить):"
        )
        await callback.answer()
    except Exception as e:
        logger.error(f"Error in handle_rating_callback: {e}", exc_info=True)
        await callback.answer("Ошибка", show_alert=True)


async def handle_rating_comment(message: Message, state: FSMContext):
    telegram_id = str(message.from_user.id)
    comment = message.text
    
    if comment == '/skip':
        comment = ''
    
    try:
        flask_app = create_app()
        with flask_app.app_context():
            user = get_user_by_telegram_id(telegram_id)
            if not user:
                await message.answer("❌ Ошибка: пользователь не найден")
                await state.clear()
                return
            
            state_data = await state.get_data()
            app_id = state_data.get('app_id')
            helper_id = state_data.get('helper_id')
            rating_value = state_data.get('rating_value')
            
            if not app_id or not helper_id or not rating_value:
                await message.answer("❌ Ошибка: неполные данные")
                await state.clear()
                return
            
            application = Application.query.get(app_id)
            helper = User.query.get(helper_id)
            
            if not application or not helper:
                await message.answer("❌ Заявка или волонтер не найдены")
                await state.clear()
                return
            
            if application.user_id != user.id:
                await message.answer("❌ Ты можешь оценивать только волонтеров по своим заявкам")
                await state.clear()
                return
            
            existing_rating = Rating.query.filter_by(
                rater_id=user.id,
                rated_id=helper_id,
                application_id=app_id
            ).first()
            
            if existing_rating:
                await message.answer("❌ Ты уже оценил этого волонтера")
                await state.clear()
                return
            
            new_rating = Rating(
                rater_id=user.id,
                rated_id=helper_id,
                application_id=app_id,
                rating_value=rating_value,
                comment=comment[:1000] if comment else None
            )
            db.session.add(new_rating)
            
            helper.rating_sum += rating_value
            helper.rating_count += 1
            db.session.commit()
            
            response = ApplicationResponse.query.filter_by(
                application_id=app_id,
                responder_id=helper_id
            ).first()
            if response:
                response.status = ResponseStatus.COMPLETED
                db.session.commit()
            
            await message.answer(
                f"✅ Оценка успешно добавлена!\n\n"
                f"⭐ Оценка: {rating_value}/5\n"
                f"👤 Волонтер: {helper.first_name} {helper.last_name or ''}\n"
                f"📋 Заявка: #{app_id}"
            )
            
            await state.clear()
    except Exception as e:
        logger.error(f"Error in handle_rating_comment: {e}", exc_info=True)
        await message.answer("😔 Произошла ошибка при сохранении оценки")
        await state.clear()

