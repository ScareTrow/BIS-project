"""Mutual-aid workflows shared by HTTP endpoints and Telegram handlers."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from . import db
from .models import (
    Application,
    ApplicationCategory,
    ApplicationResponse,
    ModerationStatus,
    ResponseStatus,
    User,
    Notification,
    Capability,
    UserCapability,
    ApplicationCapability,
    VolunteerPreference,
    ApplicationNeed,
    Contribution,
    Resource,
    ResourceConfirmation,
    TriageRule,
    ModerationAction,
    Rating,
)
from .validation import coordinates

community = Blueprint("community", __name__)
PRIORITIES = {"normal": 0, "high": 3, "sos": 5}
DEFAULT_CAPABILITIES = [
    ("has_car", "Есть машина"),
    ("deliver_food", "Могу доставить продукты"),
    ("transport_items", "Могу перевозить вещи"),
    ("translate", "Могу переводить"),
    ("household_help", "Могу помочь с бытовыми задачами"),
]


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def text(value, limit, required=False):
    if not isinstance(value, str) or len(value.strip()) > limit:
        raise ValueError("Некорректный текст")
    value = value.strip()
    if required and not value:
        raise ValueError("Заполните обязательные поля")
    return value


def quantity(value, positive=False):
    try:
        if isinstance(value, bool):
            raise ValueError()
        value = Decimal(str(value))
        if not value.is_finite() or value < 0 or value > Decimal("999999999.999"):
            raise ValueError()
        if value != value.quantize(Decimal(".001")) or (positive and value == 0):
            raise ValueError()
        return value
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(
            "Количество должно быть неотрицательным числом с точностью до 0.001"
        ) from None


def capability_ids(value):
    if not isinstance(value, list) or len(value) > 30:
        raise ValueError("Выберите возможности из справочника")
    if any(isinstance(v, bool) or not isinstance(v, int) for v in value):
        raise ValueError("Некорректные возможности")
    if len(value) != len(set(value)):
        raise ValueError("Возможности не должны повторяться")
    if value and Capability.query.filter(Capability.id.in_(value)).count() != len(
        value
    ):
        raise ValueError("Неизвестная возможность")
    return value


def parse_application_extras(data):
    def array(key):
        value = data.get(key, [])
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise ValueError("Некорректные данные потребностей") from None
        return value

    ids = capability_ids(array("capability_ids"))
    needs = array("needs")
    if not isinstance(needs, list) or len(needs) > 30:
        raise ValueError("Некорректный список потребностей")
    parsed = []
    for need in needs:
        if not isinstance(need, dict):
            raise ValueError("Некорректная потребность")
        parsed.append(
            dict(
                resource_name=text(need.get("resource_name"), 160, True),
                unit=text(need.get("unit"), 32, True),
                quantity_needed=quantity(need.get("quantity_needed"), True),
            )
        )
    priority = data.get("priority", "normal")
    if priority not in ("normal", "sos"):
        raise ValueError(
            "Обычная заявка или SOS; высокий приоритет назначает модератор"
        )
    return dict(
        ids=ids,
        needs=parsed,
        needed_help=text(data.get("needed_help", ""), 5000),
        priority=priority,
    )


def apply_triage(application):
    if application.is_sos or application.priority_source == "admin":
        return
    matches = []
    for rule in TriageRule.query.filter_by(is_active=True).all():
        if rule.category and rule.category != application.category.value:
            continue
        if (
            rule.keyword
            and rule.keyword.casefold() not in application.description.casefold()
        ):
            continue
        matches.append(rule)
    if matches:
        rule = sorted(
            matches, key=lambda r: (-PRIORITIES[r.priority], r.rule_order, r.id)
        )[0]
        if PRIORITIES[rule.priority] > (application.priority or 0):
            application.priority = PRIORITIES[rule.priority]
            application.priority_source = "auto"


def attach_application_extras(application, extras):
    application.needed_help = extras["needed_help"] or None
    application.is_sos = extras["priority"] == "sos"
    application.priority = 5 if application.is_sos else 0
    application.priority_source = "user_sos" if application.is_sos else "user_normal"
    for cid in extras["ids"]:
        db.session.add(
            ApplicationCapability(application_id=application.id, capability_id=cid)
        )
    for need in extras["needs"]:
        db.session.add(ApplicationNeed(application_id=application.id, **need))
    apply_triage(application)


def matching_users(application):
    required = {
        r.capability_id
        for r in ApplicationCapability.query.filter_by(application_id=application.id)
    }
    users = (
        User.query.join(VolunteerPreference, VolunteerPreference.user_id == User.id)
        .filter(
            VolunteerPreference.is_available.is_(True),
            User.id != application.user_id,
            func.lower(User.city) == (application.city or "").lower(),
            User.is_blocked.is_(False),
        )
        .all()
        if application.city
        else []
    )
    return [
        u
        for u in users
        if required.issubset(
            {r.capability_id for r in UserCapability.query.filter_by(user_id=u.id)}
        )
    ]


def notify_matching(application):
    queued = []
    for user in matching_users(application):
        # Do not notify twice when an administrator repeats an approval.
        if Notification.query.filter_by(
            user_id=user.id,
            related_application_id=application.id,
            notification_type="new_request",
        ).first():
            continue
        db.session.add(
            Notification(
                user_id=user.id,
                title="Рядом нужна помощь",
                message=f"Заявка #{application.id}: {application.description[:150]}",
                notification_type="new_request",
                related_application_id=application.id,
            )
        )
        queued.append(user.id)
    db.session.flush()
    return queued


def dispatch_matching(application, recipient_ids):
    from backend.telegram_bot.config import Config

    if not Config.TELEGRAM_BOT_TOKEN:
        return
    from backend.telegram_bot.utils.notifications import send_notification

    for user_id in recipient_ids:
        user = db.session.get(User, user_id)
        if user.telegram_id:
            send_notification(
                str(user.telegram_id),
                "Рядом нужна помощь",
                f"Заявка #{application.id}: {application.description[:150]}",
                "new_request",
            )


def record_moderation(
    application, action, previous_status, previous_priority, reason=None
):
    db.session.add(
        ModerationAction(
            application_id=application.id,
            admin_id=current_user.id,
            action=action,
            reason=reason,
            previous_status=previous_status,
            new_status=application.moderation_status.value,
            previous_priority=previous_priority,
            new_priority=application.priority,
        )
    )


def need_data(need):
    entries = Contribution.query.filter_by(need_id=need.id).all()
    promised = sum(
        (c.quantity_promised for c in entries if c.status != "cancelled"), Decimal(0)
    )
    delivered = sum((c.quantity_delivered for c in entries), Decimal(0))
    return dict(
        id=need.id,
        resource_name=need.resource_name,
        unit=need.unit,
        quantity_needed=float(need.quantity_needed),
        quantity_promised=float(promised),
        quantity_delivered=float(delivered),
        still_needed=float(max(need.quantity_needed - delivered, 0)),
        unpromised=float(max(need.quantity_needed - promised, 0)),
    )


def contribution_data(c):
    return dict(
        id=c.id,
        application_id=c.application_id,
        need_id=c.need_id,
        response_id=c.response_id,
        quantity_promised=float(c.quantity_promised),
        quantity_delivered=float(c.quantity_delivered),
        status=c.status,
    )


def expire_confirmations():
    expired = ResourceConfirmation.query.filter(
        ResourceConfirmation.answer.is_(None), ResourceConfirmation.expires_at <= now()
    ).all()
    for confirmation in expired:
        resource = db.session.get(Resource, confirmation.resource_id)
        # A later answered reminder must not be overwritten by an older one.
        latest = (
            ResourceConfirmation.query.filter_by(resource_id=resource.id)
            .order_by(ResourceConfirmation.id.desc())
            .first()
        )
        if latest.id == confirmation.id and (
            not resource.last_confirmed_at
            or utc(resource.last_confirmed_at) <= utc(confirmation.reminder_sent_at)
        ):
            resource.availability = "outdated"


def resource_data(r):
    return dict(
        id=r.id,
        owner_id=r.owner_id,
        name=r.name,
        description=r.description,
        category=r.category,
        city=r.city,
        latitude=r.latitude,
        longitude=r.longitude,
        availability=r.availability,
        last_confirmed_at=(
            r.last_confirmed_at.isoformat() if r.last_confirmed_at else None
        ),
    )


@community.errorhandler(ValueError)
def validation_error(error):
    db.session.rollback()
    return jsonify(error=str(error)), 400


@community.errorhandler(IntegrityError)
def conflicting_change(error):
    db.session.rollback()
    return (
        jsonify(error="Данные изменились. Обновите страницу и повторите действие."),
        409,
    )


def payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("Ожидается JSON объект")
    return data


@community.get("/api/capabilities")
def get_capabilities():
    return jsonify(
        [
            dict(id=c.id, code=c.code, name=c.name)
            for c in Capability.query.order_by(Capability.id)
        ]
    )


@community.route("/api/user/capabilities", methods=["GET", "PUT"])
@login_required
def preferences():
    pref = db.session.get(VolunteerPreference, current_user.id)
    if request.method == "PUT":
        data = payload()
        ids = capability_ids(data.get("capability_ids", []))
        available = data.get("is_available", False)
        if not isinstance(available, bool):
            raise ValueError("Доступность должна быть true/false")
        if available and not current_user.city:
            raise ValueError("Сначала выберите город в профиле")
        if pref is None:
            pref = VolunteerPreference(user_id=current_user.id)
            db.session.add(pref)
        pref.is_available = available
        UserCapability.query.filter_by(user_id=current_user.id).delete()
        for cid in ids:
            db.session.add(UserCapability(user_id=current_user.id, capability_id=cid))
        db.session.commit()
    return jsonify(
        is_available=bool(pref and pref.is_available),
        capability_ids=[
            r.capability_id
            for r in UserCapability.query.filter_by(user_id=current_user.id)
        ],
    )


@community.get("/api/applications/matching")
@login_required
def matching():
    applications = (
        Application.query.filter_by(
            moderation_status=ModerationStatus.APPROVED,
            is_resolved=False,
            is_false_call=False,
        )
        .order_by(Application.priority.desc(), Application.date.desc())
        .all()
    )
    return jsonify(
        [
            dict(
                id=a.id,
                description=a.description,
                city=a.city,
                category=a.category.value,
            )
            for a in applications
            if any(u.id == current_user.id for u in matching_users(a))
        ]
    )


@community.get("/api/applications/<int:app_id>/aid")
def application_aid(app_id):
    a = Application.query.get_or_404(app_id)
    owner = current_user.is_authenticated and (
        current_user.id == a.user_id or current_user.isAdmin
    )
    if a.moderation_status != ModerationStatus.APPROVED and not owner:
        return jsonify(error="Заявка недоступна"), 404
    mine = (
        ApplicationResponse.query.filter_by(
            application_id=app_id, responder_id=current_user.id
        ).first()
        if current_user.is_authenticated
        else None
    )
    entries = Contribution.query.filter_by(application_id=app_id).all()
    return jsonify(
        needed_help=a.needed_help,
        priority_source=a.priority_source,
        capabilities=[
            r.capability_id
            for r in ApplicationCapability.query.filter_by(application_id=app_id)
        ],
        needs=[
            need_data(n) for n in ApplicationNeed.query.filter_by(application_id=app_id)
        ],
        contributions=[
            contribution_data(c)
            for c in entries
            if owner or (mine and c.response_id == mine.id)
        ],
        response_id=mine.id if mine else None,
        rated_response_ids=(
            [
                r.id
                for r in a.responses
                if Rating.query.filter_by(
                    application_id=a.id, rater_id=a.user_id, rated_id=r.responder_id
                ).first()
            ]
            if owner
            else []
        ),
    )


@community.put("/api/responses/<int:response_id>/contributions")
@login_required
def save_contribution(response_id):
    response = ApplicationResponse.query.get_or_404(response_id)
    if response.responder_id != current_user.id:
        return jsonify(error="Доступ запрещён"), 403
    application = response.application
    if (
        response.status != ResponseStatus.ACCEPTED
        or application.is_resolved
        or application.is_false_call
        or application.moderation_status != ModerationStatus.APPROVED
    ):
        return (
            jsonify(
                error="Взнос доступен только для принятого отклика на активную заявку"
            ),
            409,
        )
    data = payload()
    nid = data.get("need_id")
    if isinstance(nid, bool) or not isinstance(nid, int):
        raise ValueError("Некорректная потребность")
    # Serialize promises against the same need on PostgreSQL.
    need = (
        ApplicationNeed.query.filter_by(id=nid, application_id=application.id)
        .with_for_update()
        .first()
    )
    if not need:
        raise ValueError("Потребность не относится к этой заявке")
    promised = quantity(data.get("quantity_promised"), True)
    delivered = quantity(data.get("quantity_delivered", 0))
    if delivered > promised:
        raise ValueError("Доставлено больше, чем обещано")
    existing = Contribution.query.filter_by(
        need_id=need.id, response_id=response.id
    ).first()
    if existing and delivered < existing.quantity_delivered:
        raise ValueError("Уже доставленное количество нельзя уменьшить")
    others = Contribution.query.filter(
        Contribution.need_id == need.id,
        Contribution.response_id != response.id,
        Contribution.status != "cancelled",
    ).all()
    if (
        sum((c.quantity_promised for c in others), Decimal(0)) + promised
        > need.quantity_needed
    ):
        return jsonify(error="Обещание превышает остаток потребности"), 409
    c = existing or Contribution(
        application_id=application.id, need_id=need.id, response_id=response.id
    )
    c.quantity_promised, c.quantity_delivered = promised, delivered
    c.status = "delivered" if delivered == promised else "promised"
    db.session.add(c)
    db.session.commit()
    return jsonify(contribution_data(c))


@community.post("/api/responses/<int:response_id>/complete")
@login_required
def complete_response(response_id):
    response = ApplicationResponse.query.get_or_404(response_id)
    if response.application.user_id != current_user.id:
        return jsonify(error="Завершение подтверждает автор заявки"), 403
    if response.status != ResponseStatus.ACCEPTED:
        return jsonify(error="Отклик должен быть принят"), 409
    if (
        response.application.is_false_call
        or response.application.moderation_status != ModerationStatus.APPROVED
    ):
        return jsonify(error="Заявка больше не доступна для помощи"), 409
    if Contribution.query.filter_by(response_id=response.id, status="promised").first():
        return jsonify(error="Сначала доставьте обещанные ресурсы"), 409
    response.status = ResponseStatus.COMPLETED
    db.session.add(
        Notification(
            user_id=response.responder_id,
            title="Помощь подтверждена",
            message=f"Автор подтвердил помощь по заявке #{response.application_id}",
            notification_type="response_completed",
            related_application_id=response.application_id,
        )
    )
    db.session.commit()
    return jsonify(success=True)


@community.post("/api/responses/<int:response_id>/rating")
@login_required
def rate_response(response_id):
    response = ApplicationResponse.query.get_or_404(response_id)
    if response.application.user_id != current_user.id:
        return jsonify(error="Оценку оставляет автор заявки"), 403
    if response.status != ResponseStatus.COMPLETED:
        return jsonify(error="Помощь ещё не завершена"), 409
    data = payload()
    score = data.get("score")
    if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 5:
        raise ValueError("Оценка должна быть от 1 до 5")
    if Rating.query.filter_by(
        application_id=response.application_id,
        rater_id=current_user.id,
        rated_id=response.responder_id,
    ).first():
        return jsonify(error="Вы уже оценили этот отклик"), 409
    rating = Rating(
        application_id=response.application_id,
        rater_id=current_user.id,
        rated_id=response.responder_id,
        rating_value=score,
        comment=text(data.get("comment", ""), 1000),
    )
    db.session.add(rating)
    db.session.flush()
    helper = db.session.get(User, response.responder_id)
    received = Rating.query.filter_by(rated_id=helper.id).all()
    helper.rating_sum = sum(r.rating_value for r in received)
    helper.rating_count = len(received)
    helper.update_badge()
    db.session.add(
        Notification(
            user_id=helper.id,
            title="Новая оценка",
            message=f"Ваша помощь по заявке #{response.application_id} оценена на {score}/5",
            notification_type="rating_received",
            related_application_id=response.application_id,
        )
    )
    db.session.commit()
    return jsonify(success=True, id=rating.id), 201


@community.route("/api/resources", methods=["GET", "POST"])
def resources():
    if request.method == "POST":
        if not current_user.is_authenticated:
            return jsonify(error="Authentication required"), 401
        data = payload()
        lat, lon = coordinates(data.get("latitude"), data.get("longitude"))
        category = ApplicationCategory(data.get("category", "food")).value
        r = Resource(
            owner_id=current_user.id,
            name=text(data.get("name"), 160, True),
            description=text(data.get("description", ""), 5000),
            city=text(data.get("city"), 200, True),
            category=category,
            latitude=lat,
            longitude=lon,
            availability="available",
            last_confirmed_at=now(),
        )
        db.session.add(r)
        db.session.commit()
        return jsonify(resource_data(r)), 201
    expire_confirmations()
    db.session.commit()
    query = Resource.query
    city = request.args.get("city", "").strip()
    if city:
        query = query.filter(func.lower(Resource.city) == city.lower())
    return jsonify([resource_data(r) for r in query.order_by(Resource.id.desc())])


@community.post("/api/resources/<int:resource_id>/reminders")
@login_required
def create_reminder(resource_id):
    r = Resource.query.get_or_404(resource_id)
    if r.owner_id != current_user.id and not current_user.isAdmin:
        return jsonify(error="Доступ запрещён"), 403
    outstanding = (
        ResourceConfirmation.query.filter_by(resource_id=r.id, answer=None)
        .filter(ResourceConfirmation.expires_at > now())
        .first()
    )
    if outstanding:
        return jsonify(error="Подтверждение уже ожидается"), 409
    c = ResourceConfirmation(
        resource_id=r.id,
        responsible_user_id=r.owner_id,
        reminder_sent_at=now(),
        expires_at=now() + timedelta(hours=24),
    )
    db.session.add(c)
    db.session.flush()
    db.session.add(
        Notification(
            user_id=r.owner_id,
            title="Подтвердите доступность ресурса",
            message=f"{r.name}: откройте «Ресурсы», чтобы подтвердить доступность.",
            notification_type="resource_reminder",
        )
    )
    db.session.commit()
    send_resource_reminder(c)
    return jsonify(id=c.id, expires_at=c.expires_at.isoformat()), 201


def send_resource_reminder(confirmation):
    from backend.telegram_bot.config import Config

    user = db.session.get(User, confirmation.responsible_user_id)
    if not Config.TELEGRAM_BOT_TOKEN or not user.telegram_id:
        return
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    from backend.telegram_bot.utils.notifications import send_notification

    resource = db.session.get(Resource, confirmation.resource_id)
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Доступен",
                    callback_data=f"resource_confirm_{confirmation.id}_available",
                ),
                InlineKeyboardButton(
                    text="Недоступен",
                    callback_data=f"resource_confirm_{confirmation.id}_unavailable",
                ),
            ]
        ]
    )
    send_notification(
        str(user.telegram_id),
        "Ресурс ещё доступен?",
        resource.name,
        "resource_reminder",
        reply_markup=keyboard,
    )


def answer_confirmation(confirmation, user_id, answer):
    if confirmation.responsible_user_id != user_id:
        raise PermissionError("Подтверждение доступно только ответственному")
    if answer not in ("available", "unavailable"):
        raise ValueError("Выберите доступен/недоступен")
    if confirmation.answer is not None or utc(confirmation.expires_at) <= now():
        raise ValueError("Подтверждение уже обработано или просрочено")
    resource = db.session.get(Resource, confirmation.resource_id)
    if resource.owner_id != user_id:
        raise PermissionError("Ответственный изменился")
    confirmation.answer, confirmation.answered_at = answer, now()
    resource.availability, resource.last_confirmed_at = answer, now()


@community.get("/api/resource-confirmations")
@login_required
def confirmations():
    expire_confirmations()
    db.session.commit()
    return jsonify(
        [
            dict(
                id=c.id,
                resource_id=c.resource_id,
                answer=c.answer,
                expires_at=c.expires_at.isoformat(),
            )
            for c in ResourceConfirmation.query.filter_by(
                responsible_user_id=current_user.id
            ).order_by(ResourceConfirmation.id.desc())
        ]
    )


@community.post("/api/resource-confirmations/<int:confirmation_id>/answer")
@login_required
def confirm_resource(confirmation_id):
    c = ResourceConfirmation.query.get_or_404(confirmation_id)
    try:
        answer_confirmation(c, current_user.id, payload().get("answer"))
    except PermissionError as error:
        return jsonify(error=str(error)), 403
    db.session.commit()
    return jsonify(success=True)


@community.route("/api/admin/triage-rules", methods=["GET", "POST"])
@login_required
def triage_rules():
    if not current_user.isAdmin:
        return jsonify(error="Доступ запрещён"), 403
    if request.method == "POST":
        data = payload()
        category = data.get("category") or None
        if category:
            category = ApplicationCategory(category).value
        keyword = text(data.get("keyword", ""), 160) or None
        if not category and not keyword:
            raise ValueError("Нужна категория или ключевое слово")
        priority = data.get("priority")
        if priority not in PRIORITIES:
            raise ValueError("Некорректный приоритет")
        order = data.get("rule_order", 0)
        active = data.get("is_active", True)
        if (
            isinstance(order, bool)
            or not isinstance(order, int)
            or not isinstance(active, bool)
        ):
            raise ValueError("Некорректные настройки правила")
        db.session.add(
            TriageRule(
                category=category,
                keyword=keyword,
                priority=priority,
                rule_order=order,
                is_active=active,
            )
        )
        db.session.commit()
    return jsonify(
        [
            dict(
                id=r.id,
                category=r.category,
                keyword=r.keyword,
                priority=r.priority,
                rule_order=r.rule_order,
                is_active=r.is_active,
            )
            for r in TriageRule.query.order_by(TriageRule.rule_order, TriageRule.id)
        ]
    )


@community.get("/api/admin/community/analytics")
@login_required
def analytics():
    if not current_user.isAdmin:
        return jsonify(error="Доступ запрещён"), 403
    apps = Application.query.filter_by(
        moderation_status=ModerationStatus.APPROVED,
        is_resolved=False,
        is_false_call=False,
    ).all()
    groups = {}
    heat = {}
    for a in apps:
        city = a.city or "Не указан"
        groups[city] = groups.get(city, 0) + 1
        point = (round(a.latitude, 2), round(a.longitude, 2))
        heat[point] = heat.get(point, 0) + 1
    return jsonify(
        regions=[dict(city=k, count=v) for k, v in sorted(groups.items())],
        heatmap=[dict(latitude=k[0], longitude=k[1], count=v) for k, v in heat.items()],
    )


def register_commands(app):
    @app.cli.command("seed-capabilities")
    def seed_capabilities():
        for code, name in DEFAULT_CAPABILITIES:
            if not Capability.query.filter_by(code=code).first():
                db.session.add(Capability(code=code, name=name))
        db.session.commit()
        print("Capabilities ready")

    @app.cli.command("expire-resource-confirmations")
    def expire_resources():
        expire_confirmations()
        db.session.commit()
        print("Expired resource information marked outdated")

    @app.cli.command("remind-resources")
    def remind_resources():
        """Run daily; prompt owners whose information is at least seven days old."""
        expire_confirmations()
        cutoff = now() - timedelta(days=7)
        queue = []
        for resource in Resource.query.all():
            if resource.last_confirmed_at and utc(resource.last_confirmed_at) > cutoff:
                continue
            if (
                ResourceConfirmation.query.filter_by(
                    resource_id=resource.id, answer=None
                )
                .filter(ResourceConfirmation.expires_at > now())
                .first()
            ):
                continue
            confirmation = ResourceConfirmation(
                resource_id=resource.id,
                responsible_user_id=resource.owner_id,
                reminder_sent_at=now(),
                expires_at=now() + timedelta(hours=24),
            )
            db.session.add(confirmation)
            db.session.add(
                Notification(
                    user_id=resource.owner_id,
                    title="Подтвердите доступность ресурса",
                    message=f"{resource.name}: откройте раздел «Ресурсы».",
                    notification_type="resource_reminder",
                )
            )
            queue.append(confirmation)
        db.session.commit()
        for confirmation in queue:
            send_resource_reminder(confirmation)
        print(f"Resource reminders prepared: {len(queue)}")
