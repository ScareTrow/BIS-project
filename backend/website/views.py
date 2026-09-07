from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash, send_from_directory, current_app
from flask_login import login_required, current_user
from .models import Application, ApplicationResponse, ResponseStatus, Rating, ApplicationCategory, ModerationStatus, ApplicationMedia, Notification, News
from . import db
from sqlalchemy import func, or_, and_, cast, String
from datetime import datetime, timedelta, timezone
from werkzeug.utils import secure_filename
from urllib.parse import unquote
import os
import mimetypes
import json
import html
import re

views = Blueprint('views', __name__)

MAX_DESCRIPTION_LENGTH = 5000

def validate_description(description):
    if not description or len(description.strip()) == 0:
        return False, "Описание не может быть пустым"
    
    if len(description) > MAX_DESCRIPTION_LENGTH:
        return False, f"Описание слишком длинное (максимум {MAX_DESCRIPTION_LENGTH} символов)"
    
    script_pattern = re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL)
    if script_pattern.search(description):
        return False, "Описание не может содержать исполняемый код"
    
    dangerous_patterns = [
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe',
        r'<object',
        r'<embed',
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, description, re.IGNORECASE):
            return False, "Описание содержит недопустимые элементы"
    
    return True, None

def sanitize_description(description):
    description = html.escape(description)
    return description

def get_location_info(latitude, longitude):
    try:
        import requests
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={latitude}&lon={longitude}&zoom=10&addressdetails=1"
        headers = {'User-Agent': 'ASAR Application/1.0'}
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            address = data.get('address', {})
            city = address.get('city') or address.get('town') or address.get('village') or address.get('municipality')
            region = address.get('state') or address.get('region') or address.get('county')
            return city, region
    except (requests.RequestException, ValueError, KeyError) as e:
        current_app.logger.warning(f"Error getting location info: {e}")
        pass
    return None, None

def get_full_address(latitude, longitude):
    """Получить полный адрес из координат"""
    try:
        import requests
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={latitude}&lon={longitude}&zoom=18&addressdetails=1"
        headers = {'User-Agent': 'ASAR Application/1.0'}
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            display_name = data.get('display_name', '')
            if display_name:
                return display_name
            address = data.get('address', {})
            parts = []
            if address.get('road'):
                parts.append(address['road'])
            if address.get('house_number'):
                parts.append(address['house_number'])
            if address.get('city') or address.get('town') or address.get('village'):
                parts.append(address.get('city') or address.get('town') or address.get('village'))
            if address.get('state') or address.get('region'):
                parts.append(address.get('state') or address.get('region'))
            if parts:
                return ', '.join(parts)
    except (requests.RequestException, ValueError, KeyError) as e:
        current_app.logger.warning(f"Error getting full address: {e}")
        pass
    return None

def create_notification(user_id, title, message, notification_type, related_application_id=None, related_user_id=None, send_telegram=False):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        related_application_id=related_application_id,
        related_user_id=related_user_id
    )
    db.session.add(notification)
    db.session.flush()
    
    if send_telegram:
        try:
            from backend.telegram_bot.bot import bot
            from .models import User
            user = User.query.get(user_id)
            if user and user.telegram_id:
                telegram_message = f"🔔 {title}\n\n{message}"
                bot.send_message(chat_id=int(user.telegram_id), text=telegram_message)
        except Exception as e:
            current_app.logger.error(f"Error sending Telegram notification: {e}")
    
    return notification


@views.route('/api/user/current')
@login_required
def get_current_user():
    resolved_applications = Application.query.filter_by(
        user_id=current_user.id,
        is_resolved=True
    ).order_by(Application.resolved_at.desc()).limit(10).all()
    
    total_applications = Application.query.filter_by(user_id=current_user.id).count()
    active_applications = Application.query.filter(
        Application.user_id == current_user.id,
        Application.is_resolved == False,
        Application.is_false_call == False
    ).count()
    
    help_given = ApplicationResponse.query.filter_by(
        responder_id=current_user.id,
        status=ResponseStatus.COMPLETED
    ).count()
    
    received_ratings = Rating.query.filter_by(
        rated_id=current_user.id
    ).order_by(Rating.created_at.desc()).limit(10).all()
    
    from .models import NameChangeHistory
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_changes = NameChangeHistory.query.filter_by(
        user_id=current_user.id
    ).filter(
        NameChangeHistory.changed_at >= month_ago
    ).count()
    name_changes_remaining = max(0, 3 - recent_changes)
    
    return jsonify({
        'user': {
            'id': current_user.id,
            'email': current_user.email,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'avatar': current_user.avatar,
            'city': current_user.city,
            'social_links': current_user.social_links,
            'rating_sum': current_user.rating_sum,
            'rating_count': current_user.rating_count,
            'badge': current_user.badge,
            'isAdmin': current_user.isAdmin,
            'is_super_admin': current_user.is_super_admin if hasattr(current_user, 'is_super_admin') else False,
            'is_authenticated': True
        },
        'total_applications': total_applications,
        'active_applications': active_applications,
        'help_given': help_given,
        'name_changes_remaining': name_changes_remaining,
        'resolved_applications': [{
            'id': app.id,
            'description': app.description,
            'category': app.category.value if app.category else 'food',
            'status': app.moderation_status.value if app.moderation_status else 'pending',
            'is_resolved': app.is_resolved,
            'is_false_call': app.is_false_call,
            'city': app.city,
            'region': app.region,
            'date': app.date.isoformat() if app.date else None,
            'resolved_at': app.resolved_at.isoformat() if app.resolved_at else None
        } for app in resolved_applications],
        'received_ratings': [{
            'id': rating.id,
            'rating_value': rating.rating_value,
            'comment': rating.comment,
            'created_at': rating.created_at.isoformat(),
            'rater': {
                'first_name': rating.rater.first_name,
                'last_name': rating.rater.last_name
            }
        } for rating in received_ratings]
    })


@views.route('/api/user/applications', methods=['GET'])
@login_required
def get_user_applications():
    """Получить последние заявки пользователя"""
    limit = request.args.get('limit', type=int, default=10)
    offset = request.args.get('offset', type=int, default=0)
    
    applications = Application.query.filter_by(
        user_id=current_user.id
    ).order_by(Application.date.desc()).limit(limit).offset(offset).all()
    
    return jsonify({
        'applications': [{
            'id': app.id,
            'description': app.description,
            'category': app.category.value if app.category else 'food',
            'status': app.moderation_status.value if app.moderation_status else 'pending',
            'is_resolved': app.is_resolved,
            'is_false_call': app.is_false_call,
            'is_sos': app.is_sos,
            'city': app.city,
            'region': app.region,
            'latitude': app.latitude,
            'longitude': app.longitude,
            'date': app.date.isoformat() if app.date else None,
            'resolved_at': app.resolved_at.isoformat() if app.resolved_at else None,
            'priority': app.priority or 0,
            'responses_count': len(app.responses) if app.responses else 0
        } for app in applications],
        'total': Application.query.filter_by(user_id=current_user.id).count()
    })


@views.route('/api/user/responses', methods=['GET'])
@login_required
def get_user_responses():
    """Получить заявки, на которые пользователь откликнулся"""
    limit = request.args.get('limit', type=int, default=10)
    offset = request.args.get('offset', type=int, default=0)
    
    responses = ApplicationResponse.query.filter_by(
        responder_id=current_user.id
    ).order_by(ApplicationResponse.created_at.desc()).limit(limit).offset(offset).all()
    
    applications_data = []
    for response in responses:
        app = response.application
        applications_data.append({
            'id': app.id,
            'description': app.description,
            'category': app.category.value if app.category else 'food',
            'status': app.moderation_status.value if app.moderation_status else 'pending',
            'is_resolved': app.is_resolved,
            'is_false_call': app.is_false_call,
            'is_sos': app.is_sos,
            'city': app.city,
            'region': app.region,
            'latitude': app.latitude,
            'longitude': app.longitude,
            'date': app.date.isoformat() if app.date else None,
            'resolved_at': app.resolved_at.isoformat() if app.resolved_at else None,
            'priority': app.priority or 0,
            'response_status': response.status.value if response.status else 'pending',
            'response_id': response.id,
            'response_created_at': response.created_at.isoformat() if response.created_at else None,
            'author': {
                'id': app.user.id,
                'first_name': app.user.first_name,
                'last_name': app.user.last_name,
                'avatar': app.user.avatar
            } if app.user else None
        })
    
    return jsonify({
        'applications': applications_data,
        'total': ApplicationResponse.query.filter_by(responder_id=current_user.id).count()
    })


@views.route('/')
def index():
    view_mode = request.args.get('view', 'map')
    return render_template('index.html', user=current_user, view_mode=view_mode)


@views.route('/home')
@login_required
def home():
    applications = Application.query.filter_by(
        user_id=current_user.id
    ).order_by(Application.date.desc()).limit(10).all()
    return render_template('home.html', user=current_user, applications=applications)


@views.route('/about')
def about():
    return render_template('about.html', user=current_user)


@views.route('/admin')
@login_required
def admin():
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.index'))
    
    from .models import User
    from sqlalchemy import func
    
    total_applications = Application.query.count()
    pending_applications = Application.query.filter_by(moderation_status=ModerationStatus.PENDING).count()
    approved_applications = Application.query.filter_by(moderation_status=ModerationStatus.APPROVED).count()
    rejected_applications = Application.query.filter_by(moderation_status=ModerationStatus.REJECTED).count()
    
    total_responses = ApplicationResponse.query.count()
    volunteers_count = User.query.join(ApplicationResponse, User.id == ApplicationResponse.responder_id).filter(
        ApplicationResponse.status == ResponseStatus.COMPLETED
    ).distinct().count()
    false_calls_count = Application.query.filter_by(is_false_call=True).count()
    
    all_apps = Application.query.all()
    category_counts = {}
    for app in all_apps:
        if app.category:
            cat_value = app.category.value if hasattr(app.category, 'value') else str(app.category)
            category_counts[cat_value] = category_counts.get(cat_value, 0) + 1
    
    category_stats = [(cat, count) for cat, count in category_counts.items()]
    
    return render_template('admin_panel.html', 
                         user=current_user,
                         total_applications=total_applications,
                         pending_applications=pending_applications,
                         approved_applications=approved_applications,
                         rejected_applications=rejected_applications,
                         total_responses=total_responses,
                         volunteers_count=volunteers_count,
                         false_calls_count=false_calls_count,
                         category_stats=category_stats)


@views.route('/api/admin/stats')
@login_required
def get_admin_stats():
    if not current_user.is_authenticated or not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    from .models import User
    from sqlalchemy import func
    
    total_applications = Application.query.count()
    pending_applications = Application.query.filter_by(moderation_status=ModerationStatus.PENDING).count()
    approved_applications = Application.query.filter_by(moderation_status=ModerationStatus.APPROVED).count()
    rejected_applications = Application.query.filter_by(moderation_status=ModerationStatus.REJECTED).count()
    
    total_responses = ApplicationResponse.query.count()
    volunteers_count = User.query.join(ApplicationResponse, User.id == ApplicationResponse.responder_id).filter(
        ApplicationResponse.status == ResponseStatus.COMPLETED
    ).distinct().count()
    false_calls_count = Application.query.filter_by(is_false_call=True).count()
    
    all_apps = Application.query.all()
    category_counts = {}
    for app in all_apps:
        if app.category:
            cat_value = app.category.value if hasattr(app.category, 'value') else str(app.category)
            category_counts[cat_value] = category_counts.get(cat_value, 0) + 1
    
    category_stats = [{'category': cat, 'count': count} for cat, count in category_counts.items()]
    
    total_users = User.query.count()
    
    return jsonify({
        'total_users': total_users,
        'users': total_users,
        'total_applications': total_applications,
        'applications': total_applications,
        'pending_applications': pending_applications,
        'approved_applications': approved_applications,
        'rejected_applications': rejected_applications,
        'total_responses': total_responses,
        'volunteers_count': volunteers_count,
        'false_calls_count': false_calls_count,
        'category_stats': category_stats
    })


@views.route('/admin/users')
@login_required
def users_list():
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.index'))
    from .models import User
    users = User.query.all()
    return render_template('admin_users.html', user=current_user, users=users)


@views.route('/api/admin/users')
@login_required
def get_admin_users():
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    from .models import User
    users = User.query.all()
    
    users_data = []
    for user in users:
        total_apps = Application.query.filter_by(user_id=user.id).count()
        resolved_apps = Application.query.filter_by(user_id=user.id, is_resolved=True).count()
        false_calls = Application.query.filter_by(user_id=user.id, is_false_call=True).count()
        help_given = ApplicationResponse.query.filter_by(
            responder_id=user.id,
            status=ResponseStatus.COMPLETED
        ).count()
        
        avg_rating = (user.rating_sum / user.rating_count) if user.rating_count > 0 else 0
        
        users_data.append({
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar': user.avatar,
            'city': user.city,
            'isAdmin': user.isAdmin,
            'is_super_admin': getattr(user, 'is_super_admin', False),
            'is_blocked': user.is_blocked,
            'blocked_until': user.blocked_until.isoformat() if user.blocked_until else None,
            'blocked_reason': user.blocked_reason,
            'total_applications': total_apps,
            'resolved_applications': resolved_apps,
            'false_calls_count': false_calls,
            'help_given': help_given,
            'average_rating': round(avg_rating, 2),
            'rating_count': user.rating_count,
            'badge': user.badge
        })
    
    return jsonify(users_data)


@views.route('/send-task', methods=['GET', 'POST'])
@login_required
def send_task():
    if request.method == 'POST':
        from .models import User
        if current_user.is_blocked:
            if current_user.blocked_until and current_user.blocked_until > datetime.now(timezone.utc):
                flash('Вы заблокированы и не можете создавать заявки', 'error')
                return redirect(url_for('views.home'))
            else:
                current_user.is_blocked = False
                current_user.blocked_until = None
                db.session.commit()
        
        if current_user.rating_count > 0 and current_user.average_rating < 2.0:
            flash('Ваш рейтинг слишком низкий для создания заявок', 'error')
            return redirect(url_for('views.home'))
        
        try:
            latitude = float(request.form.get('latitude'))
            longitude = float(request.form.get('longitude'))
        except (ValueError, TypeError):
            flash('Некорректные координаты', 'error')
            return render_template('send_task.html', user=current_user)
        
        category_str = request.form.get('category')
        description = request.form.get('description', '').strip()
        
        is_valid, error_message = validate_description(description)
        if not is_valid:
            flash(error_message, 'error')
            return render_template('send_task.html', user=current_user)
        
        description = sanitize_description(description)
        
        try:
            expires_days = int(request.form.get('expires_days', 7))
        except (ValueError, TypeError):
            expires_days = 7
        
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            flash('Некорректные координаты', 'error')
            return render_template('send_task.html', user=current_user)
        
        try:
            category = ApplicationCategory(category_str)
        except ValueError:
            flash('Некорректная категория', 'error')
            return render_template('send_task.html', user=current_user)
        
        city, region = get_location_info(latitude, longitude)
        
        new_application = Application(
            description=description,
            latitude=latitude,
            longitude=longitude,
            category=category,
            user_id=current_user.id,
            moderation_status=ModerationStatus.PENDING,
            expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
            city=city,
            region=region,
            priority=0
        )
        
        db.session.add(new_application)
        db.session.flush()
        
        if 'media_files' in request.files:
            files = request.files.getlist('media_files')
            upload_folder = current_app.config['UPLOAD_FOLDER']
            
            for file in files:
                if file and file.filename:
                    try:
                        filename = secure_filename(file.filename)
                        if not filename:
                            continue
                        
                        file.seek(0, os.SEEK_END)
                        file_size = file.tell()
                        file.seek(0)
                        if file_size > 50 * 1024 * 1024:
                            flash(f'Файл {filename} слишком большой (макс. 50MB)', 'error')
                            continue
                        
                        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
                        unique_filename = f"app_{new_application.id}_{timestamp}_{filename}"
                        file_path = os.path.join(upload_folder, unique_filename)
                        
                        file.save(file_path)
                        
                        file_type, _ = mimetypes.guess_type(file_path)
                        if not file_type:
                            file_type = 'application/octet-stream'
                        
                        media = ApplicationMedia(
                            application_id=new_application.id,
                            file_path=unique_filename,
                            file_type=file_type
                        )
                        db.session.add(media)
                    except Exception as e:
                        current_app.logger.error(f"Error saving media file: {e}")
                        flash(f'Ошибка при сохранении файла {file.filename}', 'error')
        
            db.session.commit()
        flash('Заявка создана и отправлена на модерацию', 'success')
        return redirect(url_for('views.home'))
    
    return render_template('send_task.html', user=current_user)


@views.route('/show-task')
@login_required
def show_task():
    from .models import User
    applications = Application.query.filter_by(
        user_id=current_user.id
    ).order_by(Application.date.desc()).all()
    
    total_applications = Application.query.filter_by(user_id=current_user.id).count()
    active_applications = Application.query.filter(
        Application.user_id == current_user.id,
        Application.is_resolved == False,
        Application.is_false_call == False
    ).count()
    
    resolved_applications = Application.query.filter_by(
        user_id=current_user.id,
        is_resolved=True
    ).order_by(Application.resolved_at.desc()).limit(10).all()
    
    help_given = ApplicationResponse.query.filter_by(
        responder_id=current_user.id,
        status=ResponseStatus.COMPLETED
    ).count()
    
    received_ratings = Rating.query.filter_by(
        rated_id=current_user.id
    ).order_by(Rating.created_at.desc()).limit(10).all()
    
    top_helpers = db.session.query(
        User,
        func.count(ApplicationResponse.id).label('help_count')
    ).join(
        ApplicationResponse, User.id == ApplicationResponse.responder_id
    ).join(
        Application, ApplicationResponse.application_id == Application.id
    ).filter(
        Application.user_id == current_user.id,
        ApplicationResponse.status == ResponseStatus.COMPLETED
    ).group_by(User.id).order_by(func.count(ApplicationResponse.id).desc()).limit(5).all()
    
    return render_template('show_task.html',
                         user=current_user,
                         applications=applications,
                         total_applications=total_applications,
                         active_applications=active_applications,
                         resolved_applications=resolved_applications,
                         help_given=help_given,
                         received_ratings=received_ratings,
                         top_helpers=top_helpers)


@views.route('/api/profile/edit', methods=['POST'])
@login_required
def api_edit_profile():
    from .models import NameChangeHistory
    
    try:
        if request.form.get('first_name') != current_user.first_name or \
           (request.form.get('last_name') or '') != (current_user.last_name or ''):
            month_ago = datetime.now(timezone.utc) - timedelta(days=30)
            recent_changes = NameChangeHistory.query.filter_by(
                user_id=current_user.id
            ).filter(
                NameChangeHistory.changed_at >= month_ago
            ).count()
            
            if recent_changes >= 3:
                return jsonify({'error': 'Вы достигли лимита изменений имени (3 раза в месяц)'}), 400
            
            old_full_name = f"{current_user.first_name} {current_user.last_name or ''}".strip()
            
            current_user.first_name = request.form.get('first_name', current_user.first_name)
            current_user.last_name = request.form.get('last_name') or None
            
            new_full_name = f"{current_user.first_name} {current_user.last_name or ''}".strip()
            
            history = NameChangeHistory(
                user_id=current_user.id,
                old_name=old_full_name,
                new_name=new_full_name
            )
            db.session.add(history)
        
        if 'city' in request.form:
            current_user.city = request.form.get('city') or None
        
        if 'telegram_id' in request.form and request.form.get('telegram_id'):
            telegram_id = request.form.get('telegram_id').strip()
            from .models import User
            existing_user = User.query.filter_by(telegram_id=telegram_id).first()
            if existing_user and existing_user.id != current_user.id:
                return jsonify({'error': 'Этот Telegram ID уже привязан к другому аккаунту'}), 400
            current_user.telegram_id = telegram_id
        
        social_links_data = {}
        if 'instagram' in request.form and request.form.get('instagram'):
            social_links_data['instagram'] = request.form.get('instagram').strip()
        if 'vk' in request.form and request.form.get('vk'):
            social_links_data['vk'] = request.form.get('vk').strip()
        if 'telegram' in request.form and request.form.get('telegram'):
            social_links_data['telegram'] = request.form.get('telegram').strip()
        
        if social_links_data:
            current_user.social_links = json.dumps(social_links_data, ensure_ascii=False)
        else:
            current_user.social_links = None
        
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and file.filename:
                try:
                    if current_user.avatar:
                        old_avatar_path = os.path.join(
                            current_app.config['UPLOAD_FOLDER'],
                            unquote(current_user.avatar)
                        )
                        if os.path.exists(old_avatar_path):
                            try:
                                os.remove(old_avatar_path)
                            except (OSError, PermissionError) as e:
                                current_app.logger.warning(f"Error removing old avatar: {e}")
                                pass
                    
                    filename = secure_filename(file.filename)
                    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
                    unique_filename = f"avatar_{current_user.id}_{timestamp}_{filename}"
                    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                    file.save(file_path)
                    current_user.avatar = unique_filename
                except Exception as e:
                    current_app.logger.error(f"Error saving avatar: {e}")
                    return jsonify({'error': 'Ошибка при сохранении аватара'}), 500
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Профиль успешно обновлен',
            'user': {
                'id': current_user.id,
                'first_name': current_user.first_name,
                'last_name': current_user.last_name,
                'city': current_user.city,
                'avatar': current_user.avatar,
                'telegram_id': current_user.telegram_id,
                'social_links': social_links_data
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating profile: {e}")
        return jsonify({'error': 'Ошибка при обновлении профиля'}), 500


@views.route('/api/link-telegram', methods=['POST'])
@login_required
def api_link_telegram():
    """API endpoint для привязки Telegram ID к аккаунту пользователя"""
    from .models import User
    
    try:
        data = request.get_json()
        telegram_id = data.get('telegram_id', '').strip() if data else request.form.get('telegram_id', '').strip()
        
        if not telegram_id:
            return jsonify({'success': False, 'error': 'Telegram ID обязателен'}), 400
        
        existing_user = User.query.filter_by(telegram_id=telegram_id).first()
        if existing_user and existing_user.id != current_user.id:
            return jsonify({'success': False, 'error': 'Этот Telegram ID уже привязан к другому аккаунту'}), 400
        
        current_user.telegram_id = telegram_id
        if data and data.get('telegram_username'):
            current_user.telegram_username = data.get('telegram_username').strip()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Telegram аккаунт успешно привязан',
            'telegram_id': current_user.telegram_id
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error linking telegram: {e}")
        return jsonify({'success': False, 'error': 'Ошибка при привязке Telegram аккаунта'}), 500


@views.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    import json
    if request.method == 'POST':
        from .models import User, NameChangeHistory
        from datetime import datetime, timedelta, timezone
        
        name_changes_remaining = 3
        
        if request.form.get('first_name') != current_user.first_name or \
           (request.form.get('last_name') or '') != (current_user.last_name or ''):
            month_ago = datetime.now(timezone.utc) - timedelta(days=30)
            recent_changes = NameChangeHistory.query.filter_by(
                user_id=current_user.id
            ).filter(
                NameChangeHistory.changed_at >= month_ago
            ).count()
            
            if recent_changes >= 3:
                flash('Вы достигли лимита изменений имени (3 раза в месяц)', 'error')
                return redirect(url_for('views.edit_profile'))
            
            old_full_name = f"{current_user.first_name} {current_user.last_name or ''}".strip()
            
            current_user.first_name = request.form.get('first_name', current_user.first_name)
            current_user.last_name = request.form.get('last_name') or None
            
            new_full_name = f"{current_user.first_name} {current_user.last_name or ''}".strip()
            
            history = NameChangeHistory(
                user_id=current_user.id,
                old_name=old_full_name,
                new_name=new_full_name
            )
            db.session.add(history)
            name_changes_remaining = 3 - recent_changes - 1
        
        if 'city' in request.form:
            current_user.city = request.form.get('city') or None
        
        social_links_data = {}
        if 'instagram' in request.form and request.form.get('instagram'):
            social_links_data['instagram'] = request.form.get('instagram').strip()
        if 'vk' in request.form and request.form.get('vk'):
            social_links_data['vk'] = request.form.get('vk').strip()
        if 'telegram' in request.form and request.form.get('telegram'):
            social_links_data['telegram'] = request.form.get('telegram').strip()
        
        if social_links_data:
            current_user.social_links = json.dumps(social_links_data, ensure_ascii=False)
        else:
            current_user.social_links = None
        
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and file.filename:
                try:
                    if current_user.avatar:
                        old_avatar_path = os.path.join(
                            current_app.config['UPLOAD_FOLDER'],
                            unquote(current_user.avatar)
                        )
                        if os.path.exists(old_avatar_path):
                            try:
                                os.remove(old_avatar_path)
                            except (OSError, PermissionError) as e:
                                current_app.logger.warning(f"Error removing old avatar: {e}")
                                pass
                    
                    filename = secure_filename(file.filename)
                    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
                    unique_filename = f"avatar_{current_user.id}_{timestamp}_{filename}"
                    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                    file.save(file_path)
                    current_user.avatar = unique_filename
                except Exception as e:
                    current_app.logger.error(f"Error saving avatar: {e}")
                    flash('Ошибка при сохранении аватара', 'error')
        
        db.session.commit()
        flash('Профиль успешно обновлен', 'success')
        return redirect(url_for('views.profile'))
    
    from .models import NameChangeHistory
    from datetime import datetime, timedelta
    
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_changes = NameChangeHistory.query.filter_by(
        user_id=current_user.id
    ).filter(
        NameChangeHistory.changed_at >= month_ago
    ).count()
    name_changes_remaining = max(0, 3 - recent_changes)
    
    social_links = {}
    if current_user.social_links:
        try:
            social_links = json.loads(current_user.social_links)
        except (ValueError, TypeError):
            social_links = {}
    
    return render_template('edit_profile.html', 
                         user=current_user,
                         name_changes_remaining=name_changes_remaining,
                         social_links=social_links)


@views.route('/applications')
@login_required
def applications_list():
    query = Application.query.filter_by(
        moderation_status=ModerationStatus.APPROVED
    ).filter(
        Application.is_resolved.is_(False),
        Application.is_false_call.is_(False)
    )
    
    category_filter = request.args.get('category')
    if category_filter:
        try:
            category_enum = ApplicationCategory[category_filter.upper()]
            query = query.filter(Application.category == category_enum)
        except (KeyError, AttributeError):
            pass
    
    applications = query.order_by(Application.priority.desc(), Application.date.desc()).all()
    return render_template('applications_list.html', user=current_user, applications=applications)


@views.route('/applications/<int:app_id>')
@login_required
def application_detail(app_id):
    application = Application.query.get_or_404(app_id)
    responses = ApplicationResponse.query.filter_by(
        application_id=app_id
    ).all()
    user_response = None
    if current_user.is_authenticated:
        user_response = ApplicationResponse.query.filter_by(
            application_id=app_id,
            responder_id=current_user.id
        ).first()
    return render_template('application_detail.html', 
                          user=current_user, 
                          application=application,
                          responses=responses,
                          response=user_response)


@views.route('/api/applications/<int:app_id>', methods=['GET'])
def get_application(app_id):
    application = Application.query.get_or_404(app_id)
    
    responses = ApplicationResponse.query.filter_by(application_id=app_id).all()
    user_response = None
    if current_user.is_authenticated:
        user_response = ApplicationResponse.query.filter_by(
            application_id=app_id,
            responder_id=current_user.id
        ).first()
    
    media_files = ApplicationMedia.query.filter_by(application_id=app_id).all()
    
    full_address = get_full_address(application.latitude, application.longitude)
    if not full_address:
        full_address = f"{application.city or ''}, {application.region or ''}".strip(', ')
        if not full_address:
            full_address = f"{application.latitude:.6f}, {application.longitude:.6f}"
    
    creator = application.user
    creator_info = {
        'id': creator.id,
        'first_name': creator.first_name,
        'last_name': creator.last_name or '',
        'avatar': creator.avatar
    } if creator else None
    
    duration_days = None
    if application.expires_at and application.date:
        duration = application.expires_at - application.date
        duration_days = duration.days
    
    accepted_or_completed_responses = ApplicationResponse.query.filter(
        ApplicationResponse.application_id == app_id,
        ApplicationResponse.status.in_([ResponseStatus.ACCEPTED, ResponseStatus.COMPLETED])
    ).all()
    
    accepted_volunteers = []
    if current_user.is_authenticated and application.user_id == current_user.id:
        for resp in accepted_or_completed_responses:
            existing_rating = Rating.query.filter_by(
                rater_id=current_user.id,
                rated_id=resp.responder_id,
                application_id=app_id
            ).first()
            
            accepted_volunteers.append({
                'response_id': resp.id,
                'responder_id': resp.responder_id,
                'status': resp.status.value if resp.status else 'accepted',
                'responder': {
                    'id': resp.responder.id,
                    'first_name': resp.responder.first_name,
                    'last_name': resp.responder.last_name,
                    'avatar': resp.responder.avatar,
                    'average_rating': resp.responder.average_rating
                } if resp.responder else None,
                'is_rated': existing_rating is not None,
                'rating_value': existing_rating.rating_value if existing_rating else None
            })
    
    app_data = {
        'id': application.id,
        'number': application.id,
        'description': application.description,
        'latitude': application.latitude,
        'longitude': application.longitude,
        'address': full_address,
        'category': application.category.value if application.category else 'food',
        'date': application.date.isoformat() if application.date else None,
        'expires_at': application.expires_at.isoformat() if application.expires_at else None,
        'duration_days': duration_days,
        'status': application.moderation_status.value if application.moderation_status else 'pending',
        'is_sos': application.is_sos,
        'is_resolved': application.is_resolved,
        'is_false_call': application.is_false_call,
        'user_id': application.user_id,
        'creator': creator_info,
        'priority': application.priority or 0,
        'city': application.city,
        'region': application.region,
        'location': f"{application.city or 'Не указан'}, {application.region or 'Не указан'}" if application.city or application.region else 'Не указано',
        'media_files': [{
            'id': media.id,
            'file_path': media.file_path,
            'file_type': media.file_type
        } for media in media_files],
        'responses': [{
            'id': resp.id,
            'responder_id': resp.responder_id,
            'status': resp.status.value if resp.status else 'pending',
            'created_at': resp.created_at.isoformat() if resp.created_at else None,
            'responder': {
                'id': resp.responder.id,
                'first_name': resp.responder.first_name,
                'last_name': resp.responder.last_name,
                'avatar': resp.responder.avatar
            } if resp.responder else None
        } for resp in responses],
        'user_response': {
            'id': user_response.id,
            'status': user_response.status.value if user_response.status else 'pending',
            'created_at': user_response.created_at.isoformat() if user_response.created_at else None
        } if user_response else None,
        'is_author': current_user.is_authenticated and application.user_id == current_user.id,
        'accepted_volunteers': accepted_volunteers if current_user.is_authenticated and application.user_id == current_user.id else []
    }
    
    return jsonify(app_data)


@views.route('/link-telegram', methods=['GET', 'POST'])
@login_required
def link_telegram():
    if request.method == 'POST':
        telegram_id = request.form.get('telegram_id', '').strip()
        telegram_username = request.form.get('telegram_username', '').strip()
        
        if not telegram_id:
            flash('Введите Telegram ID', 'error')
            return render_template('link_telegram.html', user=current_user)
        
        from .models import User
        existing_user = User.query.filter_by(telegram_id=telegram_id).first()
        if existing_user and existing_user.id != current_user.id:
            flash('Этот Telegram ID уже привязан к другому аккаунту', 'error')
            return render_template('link_telegram.html', user=current_user)
        
        current_user.telegram_id = telegram_id
        
        if telegram_username:
            if telegram_username.startswith('@'):
                telegram_username = telegram_username[1:]
            existing_username_user = User.query.filter_by(telegram_username=telegram_username).first()
            if existing_username_user and existing_username_user.id != current_user.id:
                flash('Этот Telegram username уже используется другим пользователем', 'error')
                return render_template('link_telegram.html', user=current_user)
            current_user.telegram_username = telegram_username
        
        db.session.commit()
        flash('Telegram аккаунт успешно привязан', 'success')
        return redirect(url_for('views.home'))
    
    return render_template('link_telegram.html', user=current_user)


@views.route('/admin/applications')
@login_required
def admin_applications():
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.index'))
    status = request.args.get('status', 'pending')
    if status == 'pending':
        applications = Application.query.filter_by(
            moderation_status=ModerationStatus.PENDING
        ).order_by(Application.date.desc()).all()
    elif status == 'approved':
        applications = Application.query.filter_by(
            moderation_status=ModerationStatus.APPROVED
        ).order_by(Application.date.desc()).all()
    elif status == 'rejected':
        applications = Application.query.filter_by(
            moderation_status=ModerationStatus.REJECTED
        ).order_by(Application.date.desc()).all()
    else:
        applications = Application.query.order_by(Application.date.desc()).all()
    return render_template('admin_applications.html', 
                         user=current_user, 
                         applications=applications,
                         status=status)


@views.route('/api/admin/applications')
@login_required
def get_admin_applications():
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    status = request.args.get('status', 'all')
    
    if status == 'pending':
        applications = Application.query.filter_by(
            moderation_status=ModerationStatus.PENDING
        ).order_by(Application.date.desc()).all()
    elif status == 'approved':
        applications = Application.query.filter_by(
            moderation_status=ModerationStatus.APPROVED
        ).order_by(Application.date.desc()).all()
    elif status == 'rejected':
        applications = Application.query.filter_by(
            moderation_status=ModerationStatus.REJECTED
        ).order_by(Application.date.desc()).all()
    else:
        applications = Application.query.order_by(Application.date.desc()).all()
    
    from .models import User
    applications_data = []
    for app in applications:
        user = User.query.get(app.user_id)
        applications_data.append({
            'id': app.id,
            'description': app.description[:200] + '...' if len(app.description) > 200 else app.description,
            'full_description': app.description,
            'category': app.category.value if app.category else 'food',
            'latitude': app.latitude,
            'longitude': app.longitude,
            'city': app.city,
            'region': app.region,
            'date': app.date.isoformat() if app.date else None,
            'expires_at': app.expires_at.isoformat() if app.expires_at else None,
            'moderation_status': app.moderation_status.value if app.moderation_status else 'pending',
            'is_sos': app.is_sos,
            'is_resolved': app.is_resolved,
            'is_false_call': app.is_false_call,
            'priority': app.priority or 0,
            'user_id': app.user_id,
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email
            } if user else None,
            'moderator_id': app.moderator_id,
            'moderated_at': app.moderated_at.isoformat() if app.moderated_at else None,
            'responses_count': len(app.responses) if app.responses else 0
        })
    
    return jsonify(applications_data)


@views.route('/admin/users/<int:user_id>')
@login_required
def admin_user_detail(user_id):
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.index'))
    from .models import User
    from sqlalchemy import func
    target_user = User.query.get_or_404(user_id)
    user_applications = Application.query.filter_by(user_id=user_id).all()
    user_responses = ApplicationResponse.query.filter_by(responder_id=user_id).all()
    user_ratings = Rating.query.filter_by(rated_id=user_id).all()
    
    total_applications = len(user_applications)
    resolved_applications = Application.query.filter_by(
        user_id=user_id,
        is_resolved=True
    ).count()
    false_calls_count = Application.query.filter_by(
        user_id=user_id,
        is_false_call=True
    ).count()
    help_given = ApplicationResponse.query.filter_by(
        responder_id=user_id,
        status=ResponseStatus.COMPLETED
    ).count()
    received_ratings_count = len(user_ratings)
    
    recent_applications = Application.query.filter_by(
        user_id=user_id
    ).order_by(Application.date.desc()).limit(10).all()
    
    return render_template('admin_user_detail.html',
                          user=current_user,
                          target_user=target_user,
                          user_applications=user_applications,
                          user_responses=user_responses,
                          user_ratings=user_ratings,
                          total_applications=total_applications,
                          resolved_applications=resolved_applications,
                          false_calls_count=false_calls_count,
                          help_given=help_given,
                          received_ratings=received_ratings_count,
                          recent_applications=recent_applications)


@views.route('/api/admin/users/<int:user_id>/make-admin', methods=['POST'])
@login_required
def make_admin(user_id):
    if not current_user.is_super_admin:
        if request.content_type and 'application/json' in request.content_type:
            return jsonify({'error': 'Доступ запрещен. Только супер-администратор может назначать администраторов.'}), 403
        flash('Доступ запрещен. Только супер-администратор может назначать администраторов.', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    if target_user.isAdmin:
        if request.content_type and 'application/json' in request.content_type:
            return jsonify({'error': 'Пользователь уже является администратором'}), 400
        flash('Пользователь уже является администратором', 'warning')
        return redirect(url_for('views.users_list'))
    
    target_user.isAdmin = True
    db.session.commit()
    
    is_json = request.content_type and 'application/json' in request.content_type
    if is_json or request.path.startswith('/api/'):
        return jsonify({
            'success': True,
            'message': f'Пользователь {target_user.first_name} {target_user.last_name or ""} назначен администратором'
        }), 200
    
    flash(f'Пользователь {target_user.first_name} {target_user.last_name or ""} назначен администратором', 'success')
    return redirect(url_for('views.users_list'))


@views.route('/api/admin/users/<int:user_id>/block', methods=['POST'])
@login_required
def block_user(user_id):
    if not current_user.isAdmin:
        if request.content_type and 'application/json' in request.content_type:
            return jsonify({'error': 'Доступ запрещен'}), 403
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    if target_user.is_super_admin:
        if request.content_type and 'application/json' in request.content_type:
            return jsonify({'error': 'Нельзя заблокировать супер-администратора'}), 400
        flash('Нельзя заблокировать супер-администратора', 'error')
        return redirect(url_for('views.admin_user_detail', user_id=user_id))
    
    is_json = request.content_type and 'application/json' in request.content_type
    if is_json:
        data = request.get_json() or {}
        days = data.get('days', 7)
        reason = data.get('reason', '')
    else:
        days = request.form.get('days', type=int, default=7)
        reason = request.form.get('reason', '')
    
    target_user.is_blocked = True
    if days > 0:
        target_user.blocked_until = datetime.now(timezone.utc) + timedelta(days=days)
    else:
        target_user.blocked_until = None
    target_user.blocked_reason = reason
    
    if target_user.blocked_until:
        block_message = f'Ваш аккаунт заблокирован до {target_user.blocked_until.strftime("%d.%m.%Y %H:%M")}'
    else:
        block_message = 'Ваш аккаунт заблокирован на неопределенный срок'
    
    if reason:
        block_message += f'. Причина: {reason}'
    else:
        block_message += '.'
    
    block_message += ' Вы не можете создавать новые заявки до окончания блокировки.'
    
    create_notification(
        user_id=target_user.id,
        title='Аккаунт заблокирован',
        message=block_message,
        notification_type='block',
        related_user_id=current_user.id,
        send_telegram=True
    )
    
    db.session.commit()
    
    if is_json or request.path.startswith('/api/'):
        return jsonify({
            'success': True,
            'message': f'Пользователь {target_user.first_name} {target_user.last_name or ""} заблокирован'
        }), 200
    
    flash(f'Пользователь {target_user.first_name} {target_user.last_name or ""} заблокирован', 'success')
    return redirect(url_for('views.admin_user_detail', user_id=user_id))


@views.route('/api/admin/users/<int:user_id>/unblock', methods=['POST'])
@login_required
def unblock_user(user_id):
    if not current_user.isAdmin:
        if request.content_type and 'application/json' in request.content_type:
            return jsonify({'error': 'Доступ запрещен'}), 403
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    target_user.is_blocked = False
    target_user.blocked_until = None
    target_user.blocked_reason = None
    
    create_notification(
        user_id=target_user.id,
        title='Аккаунт разблокирован',
        message='Ваш аккаунт был разблокирован. Теперь вы можете создавать новые заявки.',
        notification_type='unblock',
        related_user_id=current_user.id,
        send_telegram=True
    )
    
    db.session.commit()
    
    is_json = request.content_type and 'application/json' in request.content_type
    if is_json or request.path.startswith('/api/'):
        return jsonify({
            'success': True,
            'message': f'Пользователь {target_user.first_name} {target_user.last_name or ""} разблокирован'
        }), 200
    
    flash(f'Пользователь {target_user.first_name} {target_user.last_name or ""} разблокирован', 'success')
    return redirect(url_for('views.admin_user_detail', user_id=user_id))


@views.route('/api/admin/users/<int:user_id>/delete', methods=['POST'])
@login_required
def delete_user(user_id):
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    if target_user.is_super_admin:
        flash('Нельзя удалить супер-администратора', 'error')
        return redirect(url_for('views.admin_user_detail', user_id=user_id))
    
    user_name = f'{target_user.first_name} {target_user.last_name or ""}'
    
    try:
        from .models import Notification, NameChangeHistory, Note
        
        applications = Application.query.filter_by(user_id=user_id).all()
        application_ids = [app.id for app in applications]
        
        if application_ids:
            Notification.query.filter(Notification.related_application_id.in_(application_ids)).delete(synchronize_session=False)
        
        Notification.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        
        Notification.query.filter_by(related_user_id=user_id).delete(synchronize_session=False)
        
        for app in applications:
            db.session.delete(app)
        
        name_changes = NameChangeHistory.query.filter_by(user_id=user_id).all()
        for name_change in name_changes:
            db.session.delete(name_change)
        
        notes = Note.query.filter_by(user_id=user_id).all()
        for note in notes:
            db.session.delete(note)
        
        db.session.flush()
        
        responses = ApplicationResponse.query.filter_by(responder_id=user_id).all()
        for response in responses:
            db.session.delete(response)
        
        ratings_given = Rating.query.filter_by(rater_id=user_id).all()
        for rating in ratings_given:
            db.session.delete(rating)
        
        ratings_received = Rating.query.filter_by(rated_id=user_id).all()
        for rating in ratings_received:
            db.session.delete(rating)
        
        Application.query.filter_by(moderator_id=user_id).update({Application.moderator_id: None})
        
        db.session.flush()
        
        db.session.delete(target_user)
        db.session.commit()
        
        flash(f'Пользователь {user_name} удален', 'success')
        return redirect(url_for('views.users_list'))
    except Exception as e:
        db.session.rollback()
        flash(f'Ошибка при удалении пользователя: {str(e)}', 'error')
        return redirect(url_for('views.admin_user_detail', user_id=user_id))


@views.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    from .models import User
    user = User.query.get_or_404(user_id)
    
    total_applications = Application.query.filter_by(user_id=user_id).count()
    active_applications = Application.query.filter(
        Application.user_id == user_id,
        Application.is_resolved == False
    ).count()
    resolved_applications = Application.query.filter_by(
        user_id=user_id,
        is_resolved=True
    ).count()
    false_calls_count = Application.query.filter_by(
        user_id=user_id,
        is_false_call=True
    ).count()
    
    help_given = ApplicationResponse.query.filter_by(
        responder_id=user_id,
        status=ResponseStatus.COMPLETED
    ).count()
    help_total = ApplicationResponse.query.filter_by(responder_id=user_id).count()
    
    received_ratings = Rating.query.filter_by(rated_id=user_id).order_by(Rating.created_at.desc()).limit(10).all()
    
    avg_rating = (user.rating_sum / user.rating_count) if user.rating_count > 0 else 0
    
    return jsonify({
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'avatar': user.avatar,
        'city': user.city,
        'social_links': user.social_links,
        'rating_sum': user.rating_sum,
        'rating_count': user.rating_count,
        'average_rating': round(avg_rating, 2),
        'badge': user.badge,
        'isAdmin': user.isAdmin if hasattr(user, 'isAdmin') else False,
        'is_super_admin': user.is_super_admin if hasattr(user, 'is_super_admin') else False,
        'is_blocked': user.is_blocked if hasattr(user, 'is_blocked') else False,
        'blocked_until': user.blocked_until.isoformat() if hasattr(user, 'blocked_until') and user.blocked_until else None,
        'blocked_reason': user.blocked_reason if hasattr(user, 'blocked_reason') else None,
        'total_applications': total_applications,
        'active_applications': active_applications,
        'resolved_applications': resolved_applications,
        'false_calls_count': false_calls_count,
        'help_given': help_given,
        'help_total': help_total,
        'received_ratings': [{
            'id': rating.id,
            'rating_value': rating.rating_value,
            'comment': rating.comment,
            'created_at': rating.created_at.isoformat(),
            'rater': {
                'first_name': rating.rater.first_name,
                'last_name': rating.rater.last_name
            }
        } for rating in received_ratings]
    })


@views.route('/users/<int:user_id>')
@login_required
def view_user_profile(user_id):
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    total_applications = Application.query.filter_by(user_id=user_id).count()
    active_applications = Application.query.filter(
        Application.user_id == user_id,
        Application.is_resolved.is_(False),
        Application.is_false_call.is_(False)
    ).count()
    resolved_applications = Application.query.filter_by(
        user_id=user_id,
        is_resolved=True
    ).order_by(Application.resolved_at.desc()).all()
    false_calls_count = Application.query.filter_by(
        user_id=user_id,
        is_false_call=True
    ).count()
    help_given = ApplicationResponse.query.filter_by(
        responder_id=user_id,
        status=ResponseStatus.COMPLETED
    ).count()
    help_total = ApplicationResponse.query.filter_by(
        responder_id=user_id
    ).count()
    
    received_ratings = Rating.query.filter_by(
        rated_id=user_id
    ).order_by(Rating.created_at.desc()).limit(10).all()
    
    return render_template('view_user_profile.html', 
                          user=current_user,
                          target_user=target_user,
                          total_applications=total_applications,
                          active_applications=active_applications,
                          resolved_applications=resolved_applications,
                          false_calls_count=false_calls_count,
                          help_given=help_given,
                          help_total=help_total,
                          received_ratings=received_ratings)


@views.route('/profile')
@login_required
def profile():
    from .models import User
    resolved_applications = Application.query.filter_by(
        user_id=current_user.id,
        is_resolved=True
    ).order_by(Application.resolved_at.desc()).limit(10).all()
    
    total_applications = Application.query.filter_by(user_id=current_user.id).count()
    active_applications = Application.query.filter(
        Application.user_id == current_user.id,
        Application.is_resolved == False,
        Application.is_false_call == False
    ).count()
    
    resolved_applications_count = Application.query.filter_by(
        user_id=current_user.id,
        is_resolved=True
    ).count()
    
    help_given = ApplicationResponse.query.filter_by(
        responder_id=current_user.id,
        status=ResponseStatus.COMPLETED
    ).count()
    
    received_ratings = Rating.query.filter_by(
        rated_id=current_user.id
    ).order_by(Rating.created_at.desc()).limit(10).all()
    
    top_helpers = db.session.query(
        User,
        func.count(ApplicationResponse.id).label('help_count')
    ).join(
        ApplicationResponse, User.id == ApplicationResponse.responder_id
    ).join(
        Application, ApplicationResponse.application_id == Application.id
    ).filter(
        Application.user_id == current_user.id,
        ApplicationResponse.status == ResponseStatus.COMPLETED
    ).group_by(User.id).order_by(func.count(ApplicationResponse.id).desc()).limit(5).all()
    
    top_by_rating = db.session.query(
        User,
        func.avg(Rating.rating_value).label('avg_rating'),
        func.count(Rating.id).label('rating_count')
    ).join(
        Rating, User.id == Rating.rated_id
    ).filter(
        Rating.rater_id == current_user.id
    ).group_by(User.id).order_by(func.avg(Rating.rating_value).desc()).limit(5).all()
    
    false_calls_count = Application.query.filter_by(
        user_id=current_user.id,
        is_false_call=True
    ).count()
    
    return render_template('profile.html',
                         user=current_user,
                         total_applications=total_applications,
                         active_applications=active_applications,
                         resolved_applications=resolved_applications,
                         resolved_applications_count=resolved_applications_count,
                         help_given=help_given,
                         received_ratings=received_ratings,
                         top_helpers=top_helpers,
                         top_by_rating=top_by_rating,
                         false_calls_count=false_calls_count)


@views.route('/leaderboard')
@login_required
def leaderboard():
    from .models import User
    
    top_volunteers = db.session.query(
        User,
        func.count(ApplicationResponse.id).label('help_count')
    ).join(
        ApplicationResponse, User.id == ApplicationResponse.responder_id
    ).filter(
        ApplicationResponse.status == ResponseStatus.COMPLETED
    ).group_by(User.id).order_by(func.count(ApplicationResponse.id).desc()).limit(20).all()
    
    top_by_rating = db.session.query(
        User,
        func.avg(Rating.rating_value).label('avg_rating'),
        func.count(Rating.id).label('rating_count')
    ).join(
        Rating, User.id == Rating.rated_id
    ).group_by(User.id).having(func.count(Rating.id) >= 3).order_by(func.avg(Rating.rating_value).desc()).limit(20).all()
    
    return render_template('leaderboard.html',
                         user=current_user,
                         top_volunteers=top_volunteers,
                         top_by_rating=top_by_rating)


@views.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    from .models import User
    
    top_volunteers = db.session.query(
        User,
        func.count(ApplicationResponse.id).label('help_count')
    ).join(
        ApplicationResponse, User.id == ApplicationResponse.responder_id
    ).filter(
        ApplicationResponse.status == ResponseStatus.COMPLETED
    ).group_by(User.id).order_by(func.count(ApplicationResponse.id).desc()).limit(10).all()
    
    leaderboard_data = []
    for rank, (user, help_count) in enumerate(top_volunteers, 1):
        avg_rating = (user.rating_sum / user.rating_count) if user.rating_count > 0 else 0
        leaderboard_data.append({
            'rank': rank,
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar': user.avatar,
            'help_count': help_count,
            'average_rating': round(avg_rating, 2),
            'rating_count': user.rating_count,
            'badge': user.badge
        })
    
    return jsonify(leaderboard_data)


@views.route('/api/admin/applications/<int:app_id>/approve', methods=['POST'])
@login_required
def approve_application(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    application.moderation_status = ModerationStatus.APPROVED
    application.moderator_id = current_user.id
    application.moderated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    from .models import User
    user = User.query.get(application.user_id)
    
    current_app.logger.info(f"Approving application {app_id} for user {application.user_id}. User telegram_id: {user.telegram_id if user else 'None'}")
    
    create_notification(
        user_id=application.user_id,
        title='Заявка одобрена',
        message=f'Ваша заявка #{application.id} была одобрена модератором',
        notification_type='application_approved',
        related_application_id=application.id
    )
    db.session.commit()
    
    if user and user.telegram_id:
        current_app.logger.info(f"User {user.id} has telegram_id {user.telegram_id}, attempting to send notification")
        try:
            from backend.telegram_bot.utils.notifications import send_notification
            category_names = {
                'food': 'Продукты',
                'medicine': 'Медицина',
                'shelter': 'Убежище',
                'emergency': 'Экстренная помощь'
            }
            category_name = category_names.get(application.category.value if application.category else 'food', 'Неизвестно')
            message = f'Ваша заявка #{application.id} ({category_name}) была одобрена модератором и теперь видна другим пользователям.'
            current_app.logger.info(f"Attempting to send Telegram notification to user {user.id} (telegram_id: {user.telegram_id}) for approved application {application.id}")
            result = send_notification(
                telegram_id=str(user.telegram_id),
                title='Заявка одобрена',
                message=message,
                notification_type='application_approved'
            )
            if result:
                current_app.logger.info(f"Successfully sent Telegram notification to user {user.id} for approved application {application.id}")
            else:
                current_app.logger.warning(f"Failed to send Telegram notification to user {user.id} for approved application {application.id}")
        except Exception as e:
            current_app.logger.error(f"Error sending Telegram notification for approved application {application.id}: {e}", exc_info=True)
    
    return jsonify({
        'success': True,
        'message': 'Заявка успешно одобрена',
        'application': {
            'id': application.id,
            'status': application.moderation_status.value,
            'moderated_at': application.moderated_at.isoformat() if application.moderated_at else None,
            'category': application.category.value
        }
    })


@views.route('/api/admin/applications/<int:app_id>/reject', methods=['POST'])
@login_required
def reject_application(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    application.moderation_status = ModerationStatus.REJECTED
    application.moderator_id = current_user.id
    application.moderated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    from .models import User
    user = User.query.get(application.user_id)
    
    current_app.logger.info(f"Rejecting application {app_id} for user {application.user_id}. User telegram_id: {user.telegram_id if user else 'None'}")
    
    create_notification(
        user_id=application.user_id,
        title='Заявка отклонена',
        message=f'Ваша заявка #{application.id} была отклонена модератором',
        notification_type='application_rejected',
        related_application_id=application.id
    )
    db.session.commit()
    
    if user and user.telegram_id:
        current_app.logger.info(f"User {user.id} has telegram_id {user.telegram_id}, attempting to send notification")
        try:
            from backend.telegram_bot.utils.notifications import send_notification
            category_names = {
                'food': 'Продукты',
                'medicine': 'Медицина',
                'shelter': 'Убежище',
                'emergency': 'Экстренная помощь'
            }
            category_name = category_names.get(application.category.value if application.category else 'food', 'Неизвестно')
            message = f'Ваша заявка #{application.id} ({category_name}) была отклонена модератором.'
            current_app.logger.info(f"Attempting to send Telegram notification to user {user.id} (telegram_id: {user.telegram_id}) for rejected application {application.id}")
            result = send_notification(
                telegram_id=str(user.telegram_id),
                title='Заявка отклонена',
                message=message,
                notification_type='application_rejected'
            )
            if result:
                current_app.logger.info(f"Successfully sent Telegram notification to user {user.id} for rejected application {application.id}")
            else:
                current_app.logger.warning(f"Failed to send Telegram notification to user {user.id} for rejected application {application.id}")
        except Exception as e:
            current_app.logger.error(f"Error sending Telegram notification for rejected application {application.id}: {e}", exc_info=True)
    
    return jsonify({
        'success': True,
        'message': 'Заявка отклонена',
        'application': {
            'id': application.id,
            'status': application.moderation_status.value
        }
    })


@views.route('/api/admin/applications/<int:app_id>/mark-false', methods=['POST'])
@login_required
def mark_false_application(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    application.is_false_call = True
    application.is_resolved = True
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Заявка помечена как ложная',
        'application': {
            'id': application.id,
            'is_false_call': application.is_false_call,
            'is_resolved': application.is_resolved
        }
    })


@views.route('/api/admin/applications/<int:app_id>/set-priority', methods=['POST'])
@login_required
def set_application_priority(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    
    try:
        priority = int(request.json.get('priority', 0))
        if priority < 0 or priority > 5:
            return jsonify({'error': 'Приоритет должен быть от 0 до 5'}), 400
        application.priority = priority
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Приоритет заявки #{application.id} установлен на {priority}',
            'application': {
                'id': application.id,
                'priority': application.priority,
                'category': application.category.value
            }
        })
    except (ValueError, TypeError):
        return jsonify({'error': 'Некорректное значение приоритета'}), 400


@views.route('/api/applications/<int:app_id>/resolve', methods=['POST'])
@login_required
def resolve_application(app_id):
    application = Application.query.get_or_404(app_id)
    
    is_owner = application.user_id == current_user.id
    user_response = ApplicationResponse.query.filter_by(
        application_id=app_id,
        responder_id=current_user.id,
        status=ResponseStatus.ACCEPTED
    ).first()
    is_accepted_volunteer = user_response is not None
    
    if not is_owner and not is_accepted_volunteer:
        return jsonify({'error': 'Вы можете решать только свои заявки или заявки, на которые вас приняли'}), 403
    
    accepted_responses = ApplicationResponse.query.filter_by(
        application_id=app_id,
        status=ResponseStatus.ACCEPTED
    ).all()
    
    application.is_resolved = True
    application.resolved_at = datetime.now(timezone.utc)
    
    if is_owner and accepted_responses:
        unrated_count = 0
        for response in accepted_responses:
            existing_rating = Rating.query.filter_by(
                rater_id=current_user.id,
                rated_id=response.responder_id,
                application_id=app_id
            ).first()
            if not existing_rating:
                unrated_count += 1
        
        if unrated_count > 0:
            create_notification(
                user_id=current_user.id,
                title='Оцените волонтеров',
                message=f'Заявка #{application.id} завершена. Пожалуйста, оцените {unrated_count} волонтер(ов), которые помогли',
                notification_type='rate_volunteers',
                related_application_id=application.id
            )
    
    for response in accepted_responses:
        response.status = ResponseStatus.COMPLETED
        create_notification(
            user_id=response.responder_id,
            title='Заявка решена',
            message=f'Заявка #{application.id}, на которую вы откликнулись, была отмечена как решенная',
            notification_type='application_resolved',
            related_application_id=application.id
        )
    
    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'Заявка успешно решена',
        'application': {
            'id': application.id,
            'is_resolved': application.is_resolved,
            'resolved_at': application.resolved_at.isoformat() if application.resolved_at else None,
            'responses_completed': len(accepted_responses)
        }
    })


@views.route('/api/applications/<int:app_id>/mark-false', methods=['POST'])
@login_required
def mark_false_call(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        return jsonify({'error': 'Вы можете помечать только свои заявки'}), 403
    
    application.is_false_call = True
    application.is_resolved = True
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Заявка помечена как ложная',
        'application': {
            'id': application.id,
            'is_false_call': application.is_false_call,
            'is_resolved': application.is_resolved
        }
    })


@views.route('/api/applications/<int:app_id>/respond', methods=['POST'])
@login_required
def respond_to_application(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id == current_user.id:
        return jsonify({'error': 'Нельзя откликнуться на свою заявку'}), 400
    
    if application.moderation_status != ModerationStatus.APPROVED:
        return jsonify({'error': 'Заявка не одобрена'}), 400
    
    if application.is_resolved or application.is_false_call:
        return jsonify({'error': 'Заявка уже решена или помечена как ложная'}), 400
    
    existing_response = ApplicationResponse.query.filter_by(
        application_id=app_id,
        responder_id=current_user.id
    ).first()
    
    if existing_response:
        return jsonify({'error': 'Вы уже откликнулись на эту заявку'}), 400
    
    new_response = ApplicationResponse(
        application_id=app_id,
        responder_id=current_user.id,
        status=ResponseStatus.PENDING
    )
    db.session.add(new_response)
    db.session.commit()
    
    create_notification(
        user_id=application.user_id,
        title='Новый отклик',
        message=f'{current_user.first_name} откликнулся на вашу заявку #{application.id}',
        notification_type='new_response',
        related_application_id=application.id,
        related_user_id=current_user.id
    )
    db.session.commit()
    
    return jsonify({'success': True, 'response_id': new_response.id})


@views.route('/api/applications/<int:app_id>/responses/<int:response_id>/accept', methods=['POST'])
@login_required
def accept_response(app_id, response_id):
    application = Application.query.get_or_404(app_id)
    response = ApplicationResponse.query.get_or_404(response_id)
    
    if application.user_id != current_user.id:
        return jsonify({'error': 'Вы можете принимать отклики только на свои заявки'}), 403
    
    if response.application_id != app_id:
        return jsonify({'error': 'Отклик не относится к этой заявке'}), 400
    
    accepted_responses = ApplicationResponse.query.filter_by(
        application_id=app_id,
        status=ResponseStatus.ACCEPTED
    ).all()
    
    for acc_resp in accepted_responses:
        acc_resp.status = ResponseStatus.CANCELLED
        create_notification(
            user_id=acc_resp.responder_id,
            title='Отклик отклонен',
            message=f'Ваш отклик на заявку #{application.id} был отклонен',
            notification_type='response_rejected',
            related_application_id=application.id
        )
    
    response.status = ResponseStatus.ACCEPTED
    db.session.commit()
    
    create_notification(
        user_id=response.responder_id,
        title='Отклик принят',
        message=f'Ваш отклик на заявку #{application.id} был принят',
        notification_type='response_accepted',
        related_application_id=application.id
    )
    
    create_notification(
        user_id=application.user_id,
        title='Оцените волонтера',
        message=f'После завершения помощи обязательно оцените волонтера по заявке #{application.id}',
        notification_type='rate_volunteer_reminder',
        related_application_id=application.id,
        related_user_id=response.responder_id,
        send_telegram=True
    )
    db.session.commit()
    
    from .models import User
    responder = User.query.get(response.responder_id)
    
    return jsonify({
        'success': True,
        'message': 'Отклик успешно принят',
        'response': {
            'id': response.id,
            'status': response.status.value,
            'application_id': application.id,
            'responder': {
                'id': responder.id,
                'name': f"{responder.first_name} {responder.last_name or ''}".strip()
            } if responder else None
        }
    })


@views.route('/api/applications/<int:app_id>/responses/<int:response_id>/reject', methods=['POST'])
@login_required
def reject_response(app_id, response_id):
    application = Application.query.get_or_404(app_id)
    response = ApplicationResponse.query.get_or_404(response_id)
    
    if application.user_id != current_user.id:
        return jsonify({'error': 'Вы можете отклонять отклики только на свои заявки'}), 403
    
    if response.application_id != app_id:
        return jsonify({'error': 'Отклик не относится к этой заявке'}), 400
    
    response.status = ResponseStatus.CANCELLED
    db.session.commit()
    
    create_notification(
        user_id=response.responder_id,
        title='Отклик отклонен',
        message=f'Ваш отклик на заявку #{application.id} был отклонен',
        notification_type='response_rejected',
        related_application_id=application.id
    )
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Отклик отклонен',
        'response': {
            'id': response.id,
            'status': response.status.value,
            'application_id': application.id
        }
    })


@views.route('/rate-helper/<int:app_id>', methods=['GET', 'POST'])
@login_required
def rate_helper(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        flash('Вы можете оценивать только помощников по своим заявкам', 'error')
        return redirect(url_for('views.application_detail', app_id=app_id))
    
    if request.method == 'POST':
        helper_id = request.form.get('helper_id')
        
        if not helper_id:
            flash('Выберите помощника', 'error')
            return redirect(url_for('views.rate_helper', app_id=app_id))
        
        try:
            rating_value = int(request.form.get('rating_value'))
            if rating_value < 1 or rating_value > 5:
                flash('Оценка должна быть от 1 до 5', 'error')
                return redirect(url_for('views.rate_helper', app_id=app_id))
        except (ValueError, TypeError):
            flash('Некорректное значение оценки', 'error')
            return redirect(url_for('views.rate_helper', app_id=app_id))
        
        comment = request.form.get('comment', '').strip()
        
        from .models import User
        helper = User.query.get_or_404(int(helper_id))
        
        existing_rating = Rating.query.filter_by(
            rater_id=current_user.id,
            rated_id=helper.id,
            application_id=app_id
        ).first()
        
        if existing_rating:
            flash('Вы уже оценили этого помощника', 'error')
            return redirect(url_for('views.application_detail', app_id=app_id))
        
        new_rating = Rating(
            rater_id=current_user.id,
            rated_id=helper.id,
            application_id=app_id,
            rating_value=rating_value,
            comment=comment
        )
        db.session.add(new_rating)
        
        helper.rating_sum += rating_value
        helper.rating_count += 1
        db.session.commit()
        
        response = ApplicationResponse.query.filter_by(
            application_id=app_id,
            responder_id=helper.id
        ).first()
        if response:
            response.status = ResponseStatus.COMPLETED
        
        create_notification(
            user_id=helper.id,
            title='Новая оценка',
            message=f'{current_user.first_name} оценил вашу помощь по заявке #{application.id}',
            notification_type='rating_received',
            related_application_id=application.id,
            related_user_id=current_user.id
        )
        db.session.commit()
    
        flash('Оценка успешно добавлена', 'success')
        return redirect(url_for('views.application_detail', app_id=app_id))
    
    accepted_responses = ApplicationResponse.query.filter_by(
        application_id=app_id,
        status=ResponseStatus.ACCEPTED
    ).all()
    
    return render_template('rate_helper.html', 
                         user=current_user,
                         application=application,
                         accepted_responses=accepted_responses)


@views.route('/api/applications/<int:app_id>/rate-helper', methods=['POST'])
@login_required
def api_rate_helper(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        return jsonify({'success': False, 'message': 'Вы можете оценивать только помощников по своим заявкам'}), 403
    
    data = request.get_json()
    helper_id = data.get('helper_id')
    
    if not helper_id:
        return jsonify({'success': False, 'message': 'Выберите помощника'}), 400
    
    try:
        rating_value = int(data.get('rating_value'))
        if rating_value < 1 or rating_value > 5:
            return jsonify({'success': False, 'message': 'Оценка должна быть от 1 до 5'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Некорректное значение оценки'}), 400
    
    comment = data.get('comment', '').strip()
    
    from .models import User
    helper = User.query.get_or_404(int(helper_id))
    
    existing_rating = Rating.query.filter_by(
        rater_id=current_user.id,
        rated_id=helper.id,
        application_id=app_id
    ).first()
    
    if existing_rating:
        return jsonify({'success': False, 'message': 'Вы уже оценили этого помощника'}), 400
    
    new_rating = Rating(
        rater_id=current_user.id,
        rated_id=helper.id,
        application_id=app_id,
        rating_value=rating_value,
        comment=comment
    )
    db.session.add(new_rating)
    
    helper.rating_sum += rating_value
    helper.rating_count += 1
    db.session.commit()
    
    response = ApplicationResponse.query.filter_by(
        application_id=app_id,
        responder_id=helper.id
    ).first()
    if response:
        response.status = ResponseStatus.COMPLETED
    
    create_notification(
        user_id=helper.id,
        title='Новая оценка',
        message=f'{current_user.first_name} оценил вашу помощь по заявке #{application.id}',
        notification_type='rating_received',
        related_application_id=application.id,
        related_user_id=current_user.id
    )
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Оценка успешно добавлена'})


@views.route('/api/applications/<int:app_id>/rate-volunteer-simple', methods=['POST'])
@login_required
def api_rate_volunteer_simple(app_id):
    """Упрощенная оценка волонтера: плюс или минус"""
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        return jsonify({'success': False, 'message': 'Вы можете оценивать только помощников по своим заявкам'}), 403
    
    if not application.is_resolved:
        return jsonify({'success': False, 'message': 'Можно оценивать волонтеров только после завершения заявки'}), 400
    
    data = request.get_json()
    helper_id = data.get('helper_id')
    is_positive = data.get('is_positive')
    
    if not helper_id:
        return jsonify({'success': False, 'message': 'Выберите помощника'}), 400
    
    if is_positive is None:
        return jsonify({'success': False, 'message': 'Укажите оценку (плюс или минус)'}), 400
    
    from .models import User
    helper = User.query.get_or_404(int(helper_id))
    
    response = ApplicationResponse.query.filter_by(
        application_id=app_id,
        responder_id=helper.id,
        status=ResponseStatus.ACCEPTED
    ).first()
    
    if not response:
        response = ApplicationResponse.query.filter_by(
            application_id=app_id,
            responder_id=helper.id,
            status=ResponseStatus.COMPLETED
        ).first()
        
        if not response:
            return jsonify({'success': False, 'message': 'Этот пользователь не был принят на эту заявку'}), 400
    
    existing_rating = Rating.query.filter_by(
        rater_id=current_user.id,
        rated_id=helper.id,
        application_id=app_id
    ).first()
    
    if existing_rating:
        return jsonify({'success': False, 'message': 'Вы уже оценили этого помощника'}), 400
    
    rating_value = 5 if is_positive else 1
    
    new_rating = Rating(
        rater_id=current_user.id,
        rated_id=helper.id,
        application_id=app_id,
        rating_value=rating_value,
        comment=None
    )
    db.session.add(new_rating)
    
    helper.rating_sum += rating_value
    helper.rating_count += 1
    helper.update_badge()
    
    db.session.commit()
    
    create_notification(
        user_id=helper.id,
        title='Новая оценка',
        message=f'{current_user.first_name} оценил вашу помощь по заявке #{application.id} ({rating_value}/5)',
        notification_type='rating_received',
        related_application_id=application.id,
        related_user_id=current_user.id
    )
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Оценка успешно добавлена',
        'rating': {
            'id': new_rating.id,
            'value': rating_value,
            'is_positive': is_positive
        }
    })


@views.route('/api/map/points', methods=['GET'])
def get_map_points():
    from sqlalchemy import or_, and_, func
    from flask_login import current_user
    
    city = request.args.get('city', '').strip()
    
    if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
        conditions = [
            or_(
                Application.moderation_status == ModerationStatus.APPROVED,
                and_(
                    Application.user_id == current_user.id,
                    Application.moderation_status == ModerationStatus.PENDING
                )
            ),
            Application.is_resolved.is_(False),
            Application.is_false_call.is_(False)
        ]
    else:
        conditions = [
            Application.moderation_status == ModerationStatus.APPROVED,
            Application.is_resolved.is_(False),
            Application.is_false_call.is_(False)
        ]
    
    query = Application.query.filter(*conditions)
    
    if city and city != 'all':
        query = query.filter(
            func.coalesce(Application.city, '').ilike(f'%{city}%')
        )
    
    applications = query.all()
    
    points = []
    for app in applications:
        is_own = (hasattr(current_user, 'is_authenticated') and 
                  current_user.is_authenticated and 
                  hasattr(app, 'user_id') and 
                  app.user_id == current_user.id)
        points.append({
            'id': app.id,
            'latitude': app.latitude,
            'longitude': app.longitude,
            'category': app.category.value if app.category else 'food',
            'description': app.description,
            'is_sos': app.is_sos,
            'sos_count': app.sos_count if hasattr(app, 'sos_count') else 0,
            'expires_at': app.expires_at.isoformat() if app.expires_at else None,
            'date': app.date.isoformat() if app.date else None,
            'moderation_status': app.moderation_status.value if app.moderation_status else 'pending',
            'is_own': is_own
        })
    
    return jsonify(points)


@views.route('/api/applications/list', methods=['GET'])
def get_applications_list_data():
    from sqlalchemy import or_, and_, func
    from flask_login import current_user
    
    city = request.args.get('city', '').strip()
    
    if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
        query = Application.query.filter(
            or_(
                Application.moderation_status == ModerationStatus.APPROVED,
                and_(
                    Application.user_id == current_user.id,
                    Application.moderation_status == ModerationStatus.PENDING
                )
            ),
            Application.is_resolved.is_(False),
            Application.is_false_call.is_(False)
        )
    else:
        query = Application.query.filter_by(
            moderation_status=ModerationStatus.APPROVED
        ).filter(
            Application.is_resolved.is_(False),
            Application.is_false_call.is_(False)
        )
    
    if city and city != 'all':
        query = query.filter(
            func.coalesce(Application.city, '').ilike(f'%{city}%')
        )
    
    applications = query.order_by(Application.priority.desc(), Application.date.desc()).all()
    
    apps_data = []
    for app in applications:
        description_preview = app.description[:200] + '...' if len(app.description) > 200 else app.description
        is_own = (hasattr(current_user, 'is_authenticated') and 
                  current_user.is_authenticated and 
                  hasattr(app, 'user_id') and 
                  app.user_id == current_user.id)
        apps_data.append({
            'id': app.id,
            'number': app.id,
            'category': app.category.value if app.category else 'food',
            'description': description_preview,
            'city': app.city or 'Не указан',
            'region': app.region or 'Не указан',
            'location': f"{app.city or 'Не указан'}, {app.region or 'Не указан'}" if app.city or app.region else f"{app.latitude:.4f}, {app.longitude:.4f}",
            'priority': app.priority,
            'date': app.date.isoformat() if app.date else None,
            'created_at': app.date.isoformat() if app.date else None,
            'expires_at': app.expires_at.isoformat() if app.expires_at else None,
            'is_sos': app.is_sos,
            'latitude': app.latitude,
            'longitude': app.longitude,
            'moderation_status': app.moderation_status.value if app.moderation_status else 'pending',
            'is_own': is_own
        })
    
    return jsonify(apps_data)


@views.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    
    unread_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).count()
    
    return jsonify({
        'notifications': [{
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'notification_type': n.notification_type,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat() if n.created_at else None,
            'related_application_id': n.related_application_id,
            'related_user_id': n.related_user_id
        } for n in notifications],
        'unread_count': unread_count
    })


@views.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=current_user.id
    ).first_or_404()
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Уведомление отмечено как прочитанное',
        'notification': {
            'id': notification.id,
            'is_read': notification.is_read
        }
    })


@views.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_notifications_read():
    updated_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).update({'is_read': True})
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Отмечено как прочитанных: {updated_count}',
        'updated_count': updated_count
    })


@views.route('/api/applications', methods=['POST'])
@login_required
def api_create_application():
    from .models import User
    user_id = current_user.id
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 401
    
    if user.is_blocked:
        if user.blocked_until and user.blocked_until > datetime.now(timezone.utc):
            blocked_info = {
                'error': 'Вы заблокированы и не можете создавать заявки',
                'blocked': True,
                'blocked_until': user.blocked_until.isoformat(),
                'blocked_reason': user.blocked_reason
            }
            return jsonify(blocked_info), 403
        else:
            user.is_blocked = False
            user.blocked_until = None
            db.session.commit()
    
    if user.rating_count > 0 and user.average_rating < 2.0:
        return jsonify({'error': 'Ваш рейтинг слишком низкий для создания заявок'}), 403
    
    if request.content_type and 'multipart/form-data' in request.content_type:
        latitude = request.form.get('latitude')
        longitude = request.form.get('longitude')
        category_str = request.form.get('category', 'food')
        description = request.form.get('description', '').strip()
        expires_days = request.form.get('expires_days', '7')
        
        try:
            latitude = float(latitude) if latitude else None
            longitude = float(longitude) if longitude else None
            expires_days = int(expires_days) if expires_days else 7
        except (ValueError, TypeError):
            return jsonify({'error': 'Некорректные данные'}), 400
        
        media_files = request.files.getlist('media_files')
        if not media_files or len(media_files) == 0 or all(not f.filename for f in media_files):
            return jsonify({'error': 'Необходимо приложить хотя бы один медиафайл в качестве доказательства'}), 400
    else:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Неверный формат данных'}), 400
        
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        category_str = data.get('category', 'food')
        description = data.get('description', '').strip()
        expires_days = data.get('expires_days', 7)
        media_files = []
    
    if not description:
        return jsonify({'error': 'Описание обязательно'}), 400
    
    if latitude is None or longitude is None:
        return jsonify({'error': 'Координаты обязательны'}), 400
    
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return jsonify({'error': 'Некорректные координаты'}), 400
    
    try:
        category = ApplicationCategory(category_str)
    except ValueError:
        return jsonify({'error': 'Некорректная категория'}), 400
    
    is_valid, error_message = validate_description(description)
    if not is_valid:
        return jsonify({'error': error_message}), 400
    
    description = sanitize_description(description)
    
    city, region = get_location_info(latitude, longitude)
    
    new_application = Application(
        description=description,
        latitude=latitude,
        longitude=longitude,
        category=category,
        user_id=user.id,
        moderation_status=ModerationStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
        city=city,
        region=region,
        priority=0
    )
    
    db.session.add(new_application)
    db.session.flush()
    
    if media_files:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        for file in media_files:
            if file and file.filename:
                try:
                    filename = secure_filename(file.filename)
                    if not filename:
                        continue
                    
                    file.seek(0, os.SEEK_END)
                    file_size = file.tell()
                    file.seek(0)
                    if file_size > 50 * 1024 * 1024:  # 50 МБ на файл
                        db.session.rollback()
                        return jsonify({'error': f'Файл {filename} слишком большой (макс. 50MB)'}), 400
                    
                    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
                    unique_filename = f"app_{new_application.id}_{timestamp}_{filename}"
                    file_path = os.path.join(upload_folder, unique_filename)
                    
                    file.save(file_path)
                    
                    file_type, _ = mimetypes.guess_type(file_path)
                    if not file_type:
                        file_type = 'application/octet-stream'
                    
                    media = ApplicationMedia(
                        application_id=new_application.id,
                        file_path=unique_filename,
                        file_type=file_type
                    )
                    db.session.add(media)
                except Exception as e:
                    current_app.logger.error(f"Error saving media file: {e}")
                    db.session.rollback()
                    return jsonify({'error': f'Ошибка при сохранении файла {file.filename}'}), 500
    
    if request.content_type and 'multipart/form-data' in request.content_type:
        verification_doc = request.files.get('verification_document')
        if verification_doc and verification_doc.filename:
            if category in [ApplicationCategory.FOOD, ApplicationCategory.MEDICINE, ApplicationCategory.SHELTER]:
                try:
                    filename = secure_filename(verification_doc.filename)
                    if filename and (filename.endswith('.pdf') or verification_doc.content_type == 'application/pdf'):
                        verification_doc.seek(0, os.SEEK_END)
                        file_size = verification_doc.tell()
                        verification_doc.seek(0)
                        if file_size > 50 * 1024 * 1024:
                            db.session.rollback()
                            return jsonify({'error': 'Документ подтверждения слишком большой (макс. 50MB)'}), 400
                        
                        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
                        unique_filename = f"verify_{new_application.id}_{timestamp}_{filename}"
                        file_path = os.path.join(upload_folder, unique_filename)
                        
                        verification_doc.save(file_path)
                        
                        verification_media = ApplicationMedia(
                            application_id=new_application.id,
                            file_path=unique_filename,
                            file_type='application/pdf'
                        )
                        db.session.add(verification_media)
                except Exception as e:
                    current_app.logger.error(f"Error saving verification document: {e}")
                    pass
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'id': new_application.id,
        'application_id': new_application.id,
        'application': {'id': new_application.id},
        'message': 'Заявка создана и отправлена на модерацию'
    })


@views.route('/api/sos', methods=['POST'])
@login_required
def create_sos():
    from .models import User
    if current_user.is_authenticated:
        try:
            db.session.refresh(current_user)
        except Exception:
            user_id = current_user.id
            current_user = User.query.get(user_id)
            if not current_user:
                return jsonify({'error': 'Пользователь не найден'}), 401
    
    if current_user.is_blocked:
        if current_user.blocked_until and current_user.blocked_until > datetime.now(timezone.utc):
            blocked_info = {
                'error': 'Вы заблокированы и не можете создавать заявки',
                'blocked': True,
                'blocked_until': current_user.blocked_until.isoformat(),
                'blocked_reason': current_user.blocked_reason
            }
            return jsonify(blocked_info), 403
        else:
            current_user.is_blocked = False
            current_user.blocked_until = None
            db.session.commit()
    
    if current_user.rating_count > 0 and current_user.average_rating < 2.0:
        return jsonify({'error': 'Ваш рейтинг слишком низкий для создания заявок'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Неверный формат данных'}), 400
    
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if latitude is None or longitude is None:
        return jsonify({'error': 'Координаты обязательны'}), 400
    
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return jsonify({'error': 'Некорректные координаты'}), 400
    
    new_application = Application(
        description="SOS - Экстренная ситуация",
        latitude=latitude,
        longitude=longitude,
        category=ApplicationCategory.EMERGENCY,
        user_id=current_user.id,
        moderation_status=ModerationStatus.PENDING,
        is_sos=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1)
    )
    
    db.session.add(new_application)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'id': new_application.id,
        'application_id': new_application.id,
        'application': {'id': new_application.id},
        'message': 'SOS заявка создана и отправлена на модерацию'
    })


@views.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '').strip()
    search_type = request.args.get('type', 'all')
    
    category_filter = request.args.get('category')
    sos_only = request.args.get('sos_only', type=bool, default=False)
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', type=float, default=10)
    sort_by = request.args.get('sort', default='relevance')  # relevance, date, priority, distance
    page = request.args.get('page', type=int, default=1)
    per_page = request.args.get('per_page', type=int, default=20)
    
    if not query or len(query) < 2:
        return jsonify({
            'applications': [],
            'users': [],
            'cities': [],
            'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}
        })
    
    results = {
        'applications': [],
        'users': [],
        'cities': [],
        'pagination': {}
    }
    
    if search_type in ['all', 'applications']:
        from sqlalchemy import case, and_
        
        category_map = {
            'продукты': ApplicationCategory.FOOD,
            'медицина': ApplicationCategory.MEDICINE,
            'убежище': ApplicationCategory.SHELTER,
            'экстренная': ApplicationCategory.EMERGENCY,
            'food': ApplicationCategory.FOOD,
            'medicine': ApplicationCategory.MEDICINE,
            'shelter': ApplicationCategory.SHELTER,
            'emergency': ApplicationCategory.EMERGENCY,
        }
        
        query_lower = query.lower()
        category_match = None
        for key, cat in category_map.items():
            if key in query_lower:
                category_match = cat
                break
        
        query_words = query.split()
        
        base_filter = and_(
            Application.moderation_status == ModerationStatus.APPROVED,
            Application.is_resolved == False,
            Application.is_false_call == False
        )
        
        search_conditions = []
        if len(query_words) > 1:
            for word in query_words:
                search_conditions.append(
                    or_(
                        Application.description.ilike(f'%{word}%'),
                        func.coalesce(Application.city, '').ilike(f'%{word}%'),
                        func.coalesce(Application.region, '').ilike(f'%{word}%')
                    )
                )
            search_filter = and_(*search_conditions)
        else:
            search_filter = or_(
                Application.description.ilike(f'%{query}%'),
                func.coalesce(Application.city, '').ilike(f'%{query}%'),
                func.coalesce(Application.region, '').ilike(f'%{query}%')
            )
        
        if category_match:
            search_filter = or_(search_filter, Application.category == category_match)
        
        applications_query = Application.query.filter(base_filter, search_filter)
        
        if category_filter:
            try:
                category_enum = ApplicationCategory[category_filter.upper()]
                applications_query = applications_query.filter(Application.category == category_enum)
            except (KeyError, ValueError):
                pass
        
        if sos_only:
            applications_query = applications_query.filter(Application.is_sos == True)
        
        relevance = case(
            (Application.description.ilike(f'{query}%'), 100),
            (Application.description.ilike(f'%{query}%'), 50),
            else_=0
        )
        
        sos_bonus = case((Application.is_sos == True, 20), else_=0)
        priority_bonus = Application.priority * 5
        freshness_bonus = case(
            (func.extract('day', func.now() - Application.date) <= 1, 10),
            (func.extract('day', func.now() - Application.date) <= 7, 5),
            else_=0
        )
        
        total_relevance = relevance + sos_bonus + priority_bonus + freshness_bonus
        
        if lat and lng:
            distance_expr = func.sqrt(
                func.pow(Application.latitude - lat, 2) + 
                func.pow(Application.longitude - lng, 2)
            ) * 111
            
            applications_query = applications_query.filter(distance_expr <= radius)
            
            if sort_by == 'distance':
                applications_query = applications_query.order_by(distance_expr.asc())
            elif sort_by == 'date':
                applications_query = applications_query.order_by(Application.date.desc())
            elif sort_by == 'priority':
                applications_query = applications_query.order_by(Application.priority.desc(), Application.date.desc())
            else:
                applications_query = applications_query.order_by(total_relevance.desc(), Application.date.desc())
        else:
            if sort_by == 'date':
                applications_query = applications_query.order_by(Application.date.desc())
            elif sort_by == 'priority':
                applications_query = applications_query.order_by(Application.priority.desc(), Application.date.desc())
            else:
                applications_query = applications_query.order_by(total_relevance.desc(), Application.date.desc())
        
        pagination = applications_query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        applications = pagination.items
        
        results['applications'] = [{
            'id': app.id,
            'description': app.description[:100] + '...' if len(app.description) > 100 else app.description,
            'full_description': app.description,
            'category': app.category.value if app.category else 'food',
            'latitude': app.latitude,
            'longitude': app.longitude,
            'is_sos': app.is_sos,
            'priority': app.priority,
            'city': app.city,
            'region': app.region,
            'created_at': app.date.isoformat() if app.date else None,
            'expires_at': app.expires_at.isoformat() if app.expires_at else None,
            'type': 'application'
        } for app in applications]
        
        results['pagination'] = {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    
    if search_type in ['all', 'users']:
        from .models import User
        search_query = query.lstrip('@')
        users_query = User.query.filter(
            or_(
                User.first_name.ilike(f'%{search_query}%'),
                User.email.ilike(f'%{search_query}%'),
                func.coalesce(User.last_name, '').ilike(f'%{search_query}%'),
                func.coalesce(User.city, '').ilike(f'%{search_query}%'),
                func.coalesce(User.telegram_username, '').ilike(f'%{search_query}%')
            ),
            User.is_blocked == False
        )
        
        users_query = users_query.order_by(
            (User.rating_sum / func.nullif(User.rating_count, 0)).desc(),
            User.rating_count.desc()
        )
        
        users = users_query.limit(20).all()
        
        results['users'] = [{
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name or '',
            'email': user.email,
            'city': user.city or '',
            'avatar': user.avatar or '',
            'rating_count': user.rating_count or 0,
            'average_rating': round((user.rating_sum / user.rating_count), 2) if user.rating_count and user.rating_count > 0 else 0,
            'type': 'user'  # Для редиректа
        } for user in users]
    
    if search_type in ['all', 'cities']:
        kazakhstan_cities = [
            'Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Павлодар',
            'Усть-Каменогорск', 'Семей', 'Атырау', 'Костанай', 'Кызылорда', 'Уральск',
            'Петропавловск', 'Актау', 'Темиртау', 'Туркестан', 'Кокшетау', 'Талдыкорган',
            'Экибастуз', 'Рудный', 'Жанаозен', 'Жезказган', 'Балхаш', 'Сарань', 'Каскелен',
            'Кентау', 'Арал', 'Аксу', 'Лисаковск', 'Риддер', 'Степногорск', 'Щучинск'
        ]
        
        matching_cities = [city for city in kazakhstan_cities if query.lower() in city.lower()]
        results['cities'] = matching_cities[:10]
        
        if search_type in ['all', 'applications'] and matching_cities:
            for city in matching_cities:
                if query.lower() in city.lower() or city.lower().startswith(query.lower()):
                    city_apps = Application.query.filter(
                        and_(
                            Application.moderation_status == ModerationStatus.APPROVED,
                            Application.is_resolved == False,
                            Application.is_false_call == False,
                            func.coalesce(Application.city, '').ilike(f'%{city}%')
                        )
                    ).limit(10).all()
                    
                    existing_app_ids = {app.get('id') for app in results['applications']}
                    for app in city_apps:
                        if app.id not in existing_app_ids:
                            results['applications'].append({
                                'id': app.id,
                                'description': app.description[:100] + '...' if len(app.description) > 100 else app.description,
                                'full_description': app.description,
                                'category': app.category.value if app.category else 'food',
                                'latitude': app.latitude,
                                'longitude': app.longitude,
                                'is_sos': app.is_sos,
                                'priority': app.priority,
                                'city': app.city,
                                'region': app.region,
                                'created_at': app.date.isoformat() if app.date else None,
                                'expires_at': app.expires_at.isoformat() if app.expires_at else None,
                                'type': 'application'
                            })
                    break
    
    return jsonify(results)


@views.route('/api/cities/search', methods=['GET'])
def search_cities():
    query = request.args.get('q', '').strip().lower()
    
    if not query or len(query) < 2:
        return jsonify({'cities': []})
    
    kazakhstan_cities = [
        'Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Павлодар',
        'Усть-Каменогорск', 'Семей', 'Атырау', 'Костанай', 'Кызылорда', 'Уральск',
        'Петропавловск', 'Актау', 'Темиртау', 'Туркестан', 'Кокшетау', 'Талдыкорган',
        'Экибастуз', 'Рудный', 'Жанаозен', 'Жезказган', 'Балхаш', 'Сарань', 'Каскелен',
        'Кентау', 'Арал', 'Аксу', 'Лисаковск', 'Риддер', 'Степногорск', 'Щучинск'
    ]
    
    matching_cities = [city for city in kazakhstan_cities if query in city.lower()]
    
    return jsonify({'cities': matching_cities[:10]})


@views.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


@views.route('/api/uploads/<filename>')
def api_uploaded_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


@views.route('/api/stats/regional', methods=['GET'])
def get_regional_stats():
    """Получить региональную статистику заявок"""
    city = request.args.get('city', 'Алматы')
    
    total_query = Application.query.filter(
        Application.moderation_status == ModerationStatus.APPROVED,
        Application.is_false_call == False
    )
    
    if city and city != 'all':
        total_query = total_query.filter(
            func.coalesce(Application.city, '').ilike(f'{city}%')
        )
    
    total = total_query.count()
    
    active_query = total_query.filter(Application.is_resolved == False)
    active = active_query.count()
    
    emergency = active_query.filter(Application.is_sos == True).count()
    
    return jsonify({
        'total': total,
        'active': active,
        'emergency': emergency,
        'city': city
    })


@views.route('/api/telegram-bot-info', methods=['GET'])
@login_required
def get_telegram_bot_info():
    """Получить информацию о Telegram боте"""
    try:
        from backend.telegram_bot.config import Config
        from aiogram import Bot
        
        if not Config.TELEGRAM_BOT_TOKEN:
            return jsonify({
                'username': None,
                'bot_url': None,
                'message': 'Telegram бот не настроен'
            })
        
        bot_info = None
        try:
            import asyncio
            bot = Bot(token=Config.TELEGRAM_BOT_TOKEN)
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            bot_info = loop.run_until_complete(bot.get_me())
            loop.run_until_complete(bot.session.close())
        except Exception as e:
            current_app.logger.warning(f"Could not get bot info: {e}")
        
        if bot_info and bot_info.username:
            return jsonify({
                'username': bot_info.username,
                'bot_url': f'https://t.me/{bot_info.username}'
            })
        else:
            return jsonify({
                'username': None,
                'bot_url': None,
                'message': 'Используйте команду /start в Telegram боте'
            })
    except Exception as e:
        current_app.logger.error(f"Error getting bot info: {e}")
        return jsonify({
            'username': None,
            'bot_url': None,
            'message': 'Используйте команду /start в Telegram боте'
        })


@views.route('/api/news', methods=['GET'])
def get_news():
    """Получить список новостей"""
    limit = request.args.get('limit', type=int, default=20)
    offset = request.args.get('offset', type=int, default=0)
    
    query = News.query.filter_by(is_published=True)
    total = query.count()
    news_items = query.order_by(News.created_at.desc()).limit(limit).offset(offset).all()
    
    return jsonify({
        'news': [{
            'id': item.id,
            'title': item.title,
            'content': item.content,
            'news_type': item.news_type,
            'author': {
                'id': item.author.id,
                'first_name': item.author.first_name,
                'last_name': item.author.last_name
            },
            'created_at': item.created_at.isoformat() if item.created_at else None,
            'updated_at': item.updated_at.isoformat() if item.updated_at else None
        } for item in news_items],
        'total': total
    })


@views.route('/api/news/<int:news_id>', methods=['GET'])
def get_single_news(news_id):
    """Получить одну новость по ID"""
    news = News.query.get_or_404(news_id)
    
    if not news.is_published:
        return jsonify({'error': 'Новость не найдена'}), 404
    
    return jsonify({
        'id': news.id,
        'title': news.title,
        'content': news.content,
        'news_type': news.news_type,
        'author': {
            'id': news.author.id,
            'first_name': news.author.first_name,
            'last_name': news.author.last_name
        },
        'created_at': news.created_at.isoformat() if news.created_at else None,
        'updated_at': news.updated_at.isoformat() if news.updated_at else None
    })


@views.route('/api/admin/news', methods=['GET'])
@login_required
def get_admin_news():
    """Получить все новости для админа"""
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    limit = request.args.get('limit', type=int, default=50)
    offset = request.args.get('offset', type=int, default=0)
    
    query = News.query
    total = query.count()
    news_items = query.order_by(News.created_at.desc()).limit(limit).offset(offset).all()
    
    return jsonify({
        'news': [{
            'id': item.id,
            'title': item.title,
            'content': item.content,
            'news_type': item.news_type,
            'author': {
                'id': item.author.id,
                'first_name': item.author.first_name,
                'last_name': item.author.last_name
            },
            'is_published': item.is_published,
            'created_at': item.created_at.isoformat() if item.created_at else None,
            'updated_at': item.updated_at.isoformat() if item.updated_at else None
        } for item in news_items],
        'total': total
    })


@views.route('/api/admin/news', methods=['POST'])
@login_required
def create_news():
    """Создать новую новость (только для админов)"""
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Данные не предоставлены'}), 400
    
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    news_type = data.get('news_type', 'general')
    is_published = data.get('is_published', True)
    
    if not title or not content:
        return jsonify({'error': 'Заголовок и содержание обязательны'}), 400
    
    if len(title) > 200:
        return jsonify({'error': 'Заголовок слишком длинный (максимум 200 символов)'}), 400
    
    news = News(
        title=title,
        content=content,
        news_type=news_type,
        author_id=current_user.id,
        is_published=is_published
    )
    
    db.session.add(news)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'news': {
            'id': news.id,
            'title': news.title,
            'content': news.content,
            'news_type': news.news_type,
            'is_published': news.is_published,
            'created_at': news.created_at.isoformat() if news.created_at else None
        }
    }), 201


@views.route('/api/admin/news/<int:news_id>', methods=['PUT'])
@login_required
def update_news(news_id):
    """Обновить новость (только для админов)"""
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    news = News.query.get_or_404(news_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Данные не предоставлены'}), 400
    
    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': 'Заголовок не может быть пустым'}), 400
        if len(title) > 200:
            return jsonify({'error': 'Заголовок слишком длинный (максимум 200 символов)'}), 400
        news.title = title
    
    if 'content' in data:
        content = data['content'].strip()
        if not content:
            return jsonify({'error': 'Содержание не может быть пустым'}), 400
        news.content = content
    
    if 'news_type' in data:
        news.news_type = data['news_type']
    
    if 'is_published' in data:
        news.is_published = data['is_published']
    
    news.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'news': {
            'id': news.id,
            'title': news.title,
            'content': news.content,
            'news_type': news.news_type,
            'is_published': news.is_published,
            'updated_at': news.updated_at.isoformat() if news.updated_at else None
        }
    })


@views.route('/api/admin/news/<int:news_id>', methods=['DELETE'])
@login_required
def delete_news(news_id):
    """Удалить новость (только для админов)"""
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    news = News.query.get_or_404(news_id)
    db.session.delete(news)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Новость удалена'})
