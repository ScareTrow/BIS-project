from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from werkzeug.exceptions import Conflict, Forbidden, HTTPException, NotFound

from backend.telegram_bot.utils.database import get_app
from backend.website import db
from backend.website.application_service import (
    CATEGORY_NAMES, close_with_ratings, decide_response, notify_rating,
    open_application_button, rating_buttons, save_response_rating, validate_rating,
)
from backend.website.models import Application, ApplicationResponse, ModerationStatus, Rating, ResponseStatus, User


class RatingStates(StatesGroup):
    waiting_comment = State()


def owner(telegram_id, application):
    actor = User.query.filter_by(telegram_id=str(telegram_id)).first()
    if actor is None or application.user_id != actor.id:
        raise Forbidden('Действие доступно только автору заявки')
    return actor


def keyboard(rows):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(**button) for button in row] for row in rows if row
    ])


def helper_name(response):
    return ' '.join(filter(None, (response.responder.first_name, response.responder.last_name)))


def bound_response(response_id, *, lock_application=False):
    app_id = db.session.query(ApplicationResponse.application_id).filter_by(id=response_id).scalar()
    if app_id is None:
        raise NotFound('Отклик не найден')
    query = Application.query.filter_by(id=app_id)
    if lock_application:
        query = query.with_for_update()
    return query.first_or_404(), ApplicationResponse.query.get_or_404(response_id)


def can_finish(application):
    if application.is_resolved or application.is_false_call or application.moderation_status != ModerationStatus.APPROVED:
        raise Conflict('Заявка больше не доступна для завершения')


async def cmd_my_requests(message: Message):
    if message.chat.type != 'private':
        return
    with get_app().app_context():
        user = User.query.filter_by(telegram_id=str(message.from_user.id)).first()
        if not user:
            rows = None
        else:
            applications = Application.query.filter_by(user_id=user.id, is_resolved=False, is_false_call=False)
            rows = [[{'text': f'✅ Помощь получена · {CATEGORY_NAMES[app.category.value]} #{app.id}',
                      'callback_data': f'done:{app.id}'}]
                for app in applications.filter(
                    Application.moderation_status == ModerationStatus.APPROVED,
                    Application.responses.any(status=ResponseStatus.ACCEPTED),
                ).order_by(Application.date.desc()).limit(10)]
    if rows:
        await message.answer('Заявки, по которым помощь уже принята:', reply_markup=keyboard(rows))
    else:
        await message.answer('У вас нет заявок, ожидающих подтверждения помощи.' if rows is not None else 'Привяжите Telegram через профиль ASAR.')


async def cmd_rate(message: Message):
    if message.chat.type != 'private':
        return
    with get_app().app_context():
        user = User.query.filter_by(telegram_id=str(message.from_user.id)).first()
        rows = []
        if user:
            responses = ApplicationResponse.query.join(Application).filter(
                Application.user_id == user.id, Application.is_resolved.is_(True), Application.is_false_call.is_(False),
                ApplicationResponse.status == ResponseStatus.COMPLETED,
                ~Rating.query.filter(Rating.application_id == ApplicationResponse.application_id,
                    Rating.rater_id == user.id, Rating.rated_id == ApplicationResponse.responder_id).exists(),
            ).order_by(ApplicationResponse.id.desc()).limit(10)
            rows = [[{'text': f'{helper_name(response)} · #{response.application_id}',
                     'callback_data': f'review:choose:{response.id}'}] for response in responses]
    if rows:
        await message.answer('Выберите помощника для оценки:', reply_markup=keyboard(rows))
    else:
        await message.answer('Помощь по завершённым заявкам уже оценена.')


async def handle_request_action(callback: CallbackQuery, state: FSMContext):
    message = callback.message
    if not isinstance(message, Message) or message.chat.type != 'private':
        await callback.answer('Откройте личный чат с ботом.', show_alert=True)
        return
    parts = callback.data.split(':')
    try:
        if parts[0] == 'resp':
            decision, response_id = parts[1], int(parts[2])
            if decision not in ('accept', 'reject'):
                raise ValueError
            with get_app().app_context():
                application, response = bound_response(response_id, lock_application=True)
                actor = owner(callback.from_user.id, application)
                accept = decision == 'accept'
                decide_response(application, response, actor.id, accept=accept)
                text = f'✅ Отклик принят. Помощник: {helper_name(response)}' if accept else '❌ Отклик отклонён.'
                rows = [[{'text': '✅ Помощь получена', 'callback_data': f'done:{application.id}'}]] if accept else []
                link = open_application_button(application)
                if link:
                    rows.append(link)
                db.session.commit()
        elif parts[0] in ('done', 'close'):
            with get_app().app_context():
                application = Application.query.filter_by(id=int(parts[1])).with_for_update().first_or_404()
                owner(callback.from_user.id, application)
                can_finish(application)
                accepted = [item for item in application.responses if item.status == ResponseStatus.ACCEPTED]
                if not accepted:
                    raise Conflict('Для этой заявки нет принятого отклика')
                if parts[0] == 'close':
                    close_with_ratings(application, [])
                    db.session.commit()
                    text, rows = '✅ Заявка завершена.', []
                else:
                    first = accepted[0]
                    text = f'Оцените помощь: {helper_name(first)}'
                    rows = [rating_buttons(first), [{'text': 'Закрыть без оценки', 'callback_data': f'close:{application.id}'}]]
        elif parts[:2] == ['review', 'choose']:
            with get_app().app_context():
                application, response = bound_response(int(parts[2]))
                owner(callback.from_user.id, application)
                if not application.is_resolved or response.status != ResponseStatus.COMPLETED:
                    raise Conflict('Помощь ещё не завершена')
                text = f'Оцените помощь: {helper_name(response)}'
                rows = [rating_buttons(response)]
        elif parts[0] == 'rate':
            response_id, score = int(parts[1]), int(parts[2])
            validate_rating({'score': score})
            with get_app().app_context():
                application, response = bound_response(response_id)
                actor = owner(callback.from_user.id, application)
                if response.status not in (ResponseStatus.ACCEPTED, ResponseStatus.COMPLETED):
                    raise Conflict('Отклик больше не доступен для оценки')
                if Rating.query.filter_by(application_id=application.id, rater_id=actor.id, rated_id=response.responder_id).first():
                    raise Conflict('Вы уже оценили этот отклик')
            await state.set_data(dict(response_id=response_id, score=score, review_message_id=message.message_id))
            await state.set_state(RatingStates.waiting_comment)
            text = 'Напишите отзыв или нажмите «Пропустить».'
            rows = [[{'text': 'Пропустить', 'callback_data': f'review:skip:{response_id}'}]]
        elif parts[:2] == ['review', 'skip']:
            data = await state.get_data()
            if (await state.get_state() != RatingStates.waiting_comment.state
                    or data.get('response_id') != int(parts[2]) or data.get('review_message_id') != message.message_id):
                raise Conflict('Этот запрос отзыва больше не активен')
            text = await submit_review(callback.from_user.id, '', data, state)
            rows = []
        else:
            raise ValueError
    except HTTPException as error:
        await callback.answer(error.description, show_alert=True)
        return
    except (ValueError, IndexError):
        await callback.answer('Действие недоступно.', show_alert=True)
        return
    await callback.answer()
    await message.edit_text(text, reply_markup=keyboard(rows) if rows else None)


async def submit_review(telegram_id, comment, data, state):
    score, comment = validate_rating({'score': data.get('score'), 'comment': comment})
    with get_app().app_context():
        application, response = bound_response(data['response_id'], lock_application=True)
        actor = owner(telegram_id, application)
        if response.status == ResponseStatus.ACCEPTED:
            can_finish(application)
            close_with_ratings(application, [(response, score, comment)])
            saved = Rating.query.filter_by(application_id=application.id, rater_id=actor.id, rated_id=response.responder_id).first()
            text = '✅ Заявка завершена, оценка сохранена.' if saved else '✅ Заявка завершена. Оценку можно добавить позже.'
        else:
            rating = save_response_rating(response, actor.id, score, comment)
            notify_rating(rating)
            text = '✅ Оценка сохранена.'
        db.session.commit()
    await state.clear()
    return text


async def handle_rating_comment(message: Message, state: FSMContext):
    if message.chat.type != 'private':
        return
    comment = '' if message.text == '/skip' else message.text
    if comment is None:
        await message.answer('Отправьте текст отзыва или нажмите «Пропустить».')
        return
    try:
        text = await submit_review(message.from_user.id, comment, await state.get_data(), state)
    except HTTPException as error:
        await message.answer(error.description)
        return
    await message.answer(text)
