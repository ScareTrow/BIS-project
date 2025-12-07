from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash, send_from_directory, current_app
from flask_login import login_required, current_user
from .models import Application, ApplicationResponse, ResponseStatus, Rating, ApplicationCategory, ModerationStatus, ApplicationMedia, Notification
from . import db
from sqlalchemy import func, or_, cast, String
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import os
import mimetypes
import json

views = Blueprint('views', __name__)


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
            'is_authenticated': True
        },
        'total_applications': total_applications,
        'active_applications': active_applications,
        'help_given': help_given,
        'resolved_applications': [{
            'id': app.id,
            'description': app.description,
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


@views.route('/admin/users')
@login_required
def users_list():
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.index'))
    from .models import User
    users = User.query.all()
    return render_template('admin_users.html', user=current_user, users=users)


@views.route('/send-task', methods=['GET', 'POST'])
@login_required
def send_task():
    if request.method == 'POST':
        from .models import User
        if current_user.is_blocked:
            if current_user.blocked_until and current_user.blocked_until > datetime.utcnow():
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
        
        try:
            expires_days = int(request.form.get('expires_days', 7))
        except (ValueError, TypeError):
            expires_days = 7
        
        if not description:
            flash('Описание обязательно для заполнения', 'error')
            return render_template('send_task.html', user=current_user)
        
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            flash('Некорректные координаты', 'error')
            return render_template('send_task.html', user=current_user)
        
        try:
            category = ApplicationCategory(category_str)
        except ValueError:
            flash('Некорректная категория', 'error')
            return render_template('send_task.html', user=current_user)
        
        new_application = Application(
            description=description,
            latitude=latitude,
            longitude=longitude,
            category=category,
            user_id=current_user.id,
            moderation_status=ModerationStatus.PENDING,
            expires_at=datetime.utcnow() + timedelta(days=expires_days)
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
                        if file_size > 10 * 1024 * 1024:
                            flash(f'Файл {filename} слишком большой (макс. 10MB)', 'error')
                            continue
                        
                        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
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


@views.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    if request.method == 'POST':
        from .models import User, NameChangeHistory
        from datetime import datetime, timedelta
        
        name_changes_remaining = 3
        
        if request.form.get('first_name') != current_user.first_name or \
           (request.form.get('last_name') or '') != (current_user.last_name or ''):
            month_ago = datetime.utcnow() - timedelta(days=30)
            recent_changes = NameChangeHistory.query.filter_by(
                user_id=current_user.id
            ).filter(
                NameChangeHistory.changed_at >= month_ago
            ).count()
            
            if recent_changes >= 3:
                flash('Вы достигли лимита изменений имени (3 раза в месяц)', 'error')
                return redirect(url_for('views.edit_profile'))
            
            old_first_name = current_user.first_name
            old_last_name = current_user.last_name
            
            current_user.first_name = request.form.get('first_name', current_user.first_name)
            current_user.last_name = request.form.get('last_name') or None
            
            history = NameChangeHistory(
                user_id=current_user.id,
                old_first_name=old_first_name,
                old_last_name=old_last_name,
                new_first_name=current_user.first_name,
                new_last_name=current_user.last_name
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
                        old_avatar_path = os.path.join(current_app.config['UPLOAD_FOLDER'], current_user.avatar)
                        if os.path.exists(old_avatar_path):
                            os.remove(old_avatar_path)
                    
                    filename = secure_filename(file.filename)
                    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
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
    import json
    
    month_ago = datetime.utcnow() - timedelta(days=30)
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
        except (json.JSONDecodeError, TypeError):
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
    
    applications = query.order_by(Application.date.desc()).all()
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


@views.route('/link-telegram', methods=['GET', 'POST'])
@login_required
def link_telegram():
    if request.method == 'POST':
        telegram_username = request.form.get('telegram_username', '').strip()
        
        if not telegram_username:
            flash('Введите имя пользователя Telegram', 'error')
            return render_template('link_telegram.html', user=current_user)
        
        from .models import User
        existing_user = User.query.filter_by(telegram_username=telegram_username).first()
        if existing_user and existing_user.id != current_user.id:
            flash('Этот Telegram аккаунт уже привязан к другому пользователю', 'error')
            return render_template('link_telegram.html', user=current_user)
        
        if telegram_username.startswith('@'):
            telegram_username = telegram_username[1:]
        
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


@views.route('/admin/users/<int:user_id>/make-admin', methods=['POST'])
@login_required
def make_admin(user_id):
    if not current_user.is_super_admin:
        flash('Доступ запрещен. Только супер-администратор может назначать администраторов.', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    if target_user.isAdmin:
        flash('Пользователь уже является администратором', 'warning')
        return redirect(url_for('views.users_list'))
    
    target_user.isAdmin = True
    db.session.commit()
    
    flash(f'Пользователь {target_user.first_name} {target_user.last_name or ""} назначен администратором', 'success')
    return redirect(url_for('views.users_list'))


@views.route('/admin/users/<int:user_id>/block', methods=['POST'])
@login_required
def block_user(user_id):
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    if target_user.is_super_admin:
        flash('Нельзя заблокировать супер-администратора', 'error')
        return redirect(url_for('views.admin_user_detail', user_id=user_id))
    
    days = request.form.get('days', type=int, default=7)
    reason = request.form.get('reason', '')
    
    target_user.is_blocked = True
    if days > 0:
        target_user.blocked_until = datetime.utcnow() + timedelta(days=days)
    else:
        target_user.blocked_until = None
    target_user.blocked_reason = reason
    db.session.commit()
    
    flash(f'Пользователь {target_user.first_name} {target_user.last_name or ""} заблокирован', 'success')
    return redirect(url_for('views.admin_user_detail', user_id=user_id))


@views.route('/admin/users/<int:user_id>/unblock', methods=['POST'])
@login_required
def unblock_user(user_id):
    if not current_user.isAdmin:
        flash('Доступ запрещен', 'error')
        return redirect(url_for('views.admin'))
    
    from .models import User
    target_user = User.query.get_or_404(user_id)
    
    target_user.is_blocked = False
    target_user.blocked_until = None
    target_user.blocked_reason = None
    db.session.commit()
    
    flash(f'Пользователь {target_user.first_name} {target_user.last_name or ""} разблокирован', 'success')
    return redirect(url_for('views.admin_user_detail', user_id=user_id))


@views.route('/admin/users/<int:user_id>/delete', methods=['POST'])
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
    db.session.delete(target_user)
    db.session.commit()
    
    flash(f'Пользователь {user_name} удален', 'success')
    return redirect(url_for('views.users_list'))


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


@views.route('/admin/applications/<int:app_id>/approve', methods=['POST'])
@login_required
def approve_application(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    application.moderation_status = ModerationStatus.APPROVED
    db.session.commit()
    
    create_notification(
        user_id=application.user_id,
        title='Заявка одобрена',
        message=f'Ваша заявка #{application.id} была одобрена модератором',
        notification_type='application_approved',
        related_application_id=application.id
    )
    db.session.commit()
    
    return jsonify({'success': True})


@views.route('/admin/applications/<int:app_id>/reject', methods=['POST'])
@login_required
def reject_application(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    application.moderation_status = ModerationStatus.REJECTED
    db.session.commit()
    
    create_notification(
        user_id=application.user_id,
        title='Заявка отклонена',
        message=f'Ваша заявка #{application.id} была отклонена модератором',
        notification_type='application_rejected',
        related_application_id=application.id
    )
    db.session.commit()
    
    return jsonify({'success': True})


@views.route('/admin/applications/<int:app_id>/mark-false', methods=['POST'])
@login_required
def mark_false_application(app_id):
    if not current_user.isAdmin:
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    application = Application.query.get_or_404(app_id)
    application.is_false_call = True
    application.is_resolved = True
    db.session.commit()
    
    return jsonify({'success': True})


@views.route('/applications/<int:app_id>/resolve', methods=['POST'])
@login_required
def resolve_application(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        return jsonify({'error': 'Вы можете решать только свои заявки'}), 403
    
    application.is_resolved = True
    application.resolved_at = datetime.utcnow()
    db.session.commit()
    
    accepted_responses = ApplicationResponse.query.filter_by(
        application_id=app_id,
        status=ResponseStatus.ACCEPTED
    ).all()
    
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
    return jsonify({'success': True})


@views.route('/applications/<int:app_id>/mark-false', methods=['POST'])
@login_required
def mark_false_call(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        return jsonify({'error': 'Вы можете помечать только свои заявки'}), 403
    
    application.is_false_call = True
    application.is_resolved = True
    db.session.commit()
    
    return jsonify({'success': True})


@views.route('/applications/<int:app_id>/respond', methods=['POST'])
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


@views.route('/applications/<int:app_id>/responses/<int:response_id>/accept', methods=['POST'])
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
    db.session.commit()
    
    return jsonify({'success': True})


@views.route('/applications/<int:app_id>/responses/<int:response_id>/reject', methods=['POST'])
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
    
    return jsonify({'success': True})


@views.route('/applications/<int:app_id>/rate-helper', methods=['GET', 'POST'])
@login_required
def rate_helper(app_id):
    application = Application.query.get_or_404(app_id)
    
    if application.user_id != current_user.id:
        flash('Вы можете оценивать только помощников по своим заявкам', 'error')
        return redirect(url_for('views.application_detail', app_id=app_id))
    
    if request.method == 'POST':
        helper_id = request.form.get('helper_id')
        rating_value = int(request.form.get('rating_value'))
        comment = request.form.get('comment', '').strip()
        
        if not helper_id:
            flash('Выберите помощника', 'error')
            return redirect(url_for('views.rate_helper', app_id=app_id))
        
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


@views.route('/api/map/points', methods=['GET'])
def get_map_points():
    applications = Application.query.filter_by(
        moderation_status=ModerationStatus.APPROVED
    ).filter(
        Application.is_resolved.is_(False),
        Application.is_false_call.is_(False)
    ).all()
    
    points = []
    for app in applications:
        points.append({
            'id': app.id,
            'latitude': app.latitude,
            'longitude': app.longitude,
            'category': app.category.value if app.category else 'food',
            'description': app.description,
            'is_sos': app.is_sos,
            'sos_count': app.sos_count if hasattr(app, 'sos_count') else 0,
            'expires_at': app.expires_at.isoformat() if app.expires_at else None,
            'date': app.date.isoformat() if app.date else None
        })
    
    return jsonify(points)


@views.route('/api/applications/list', methods=['GET'])
def get_applications_list_data():
    applications = Application.query.filter_by(
        moderation_status=ModerationStatus.APPROVED
    ).filter(
        Application.is_resolved.is_(False),
        Application.is_false_call.is_(False)
    ).order_by(Application.date.desc()).all()
    
    apps_data = []
    for app in applications:
        apps_data.append({
            'id': app.id,
            'category': app.category.value if app.category else 'food',
            'description': app.description[:100] + '...' if len(app.description) > 100 else app.description,
            'created_at': app.date.isoformat() if app.date else None,
            'is_sos': app.is_sos
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
    
    return jsonify({'success': True})


@views.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_notifications_read():
    Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).update({'is_read': True})
    db.session.commit()
    
    return jsonify({'success': True})


@views.route('/api/sos', methods=['POST'])
@login_required
def create_sos():
    from .models import User
    if current_user.is_blocked:
        if current_user.blocked_until and current_user.blocked_until > datetime.utcnow():
            return jsonify({'error': 'Вы заблокированы и не можете создавать заявки'}), 403
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
        expires_at=datetime.utcnow() + timedelta(days=1)
    )
    
    db.session.add(new_application)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'application_id': new_application.id,
        'message': 'SOS заявка создана и отправлена на модерацию'
    })


@views.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '').strip()
    search_type = request.args.get('type', 'all')
    
    if not query or len(query) < 2:
        return jsonify({
            'applications': [],
            'users': [],
            'cities': []
        })
    
    results = {
        'applications': [],
        'users': [],
        'cities': []
    }
    
    if search_type in ['all', 'applications']:
        applications = Application.query.filter(
            Application.moderation_status == ModerationStatus.APPROVED,
            Application.is_resolved == False,
            Application.is_false_call == False,
            or_(
                Application.description.ilike(f'%{query}%'),
                cast(Application.category, String).ilike(f'%{query}%')
            )
        ).limit(20).all()
        
        results['applications'] = [{
            'id': app.id,
            'description': app.description[:100] + '...' if len(app.description) > 100 else app.description,
            'category': app.category.value if app.category else 'food',
            'latitude': app.latitude,
            'longitude': app.longitude,
            'is_sos': app.is_sos,
            'created_at': app.date.isoformat() if app.date else None
        } for app in applications]
    
    if search_type in ['all', 'users']:
        from .models import User
        users = User.query.filter(
            or_(
                User.first_name.ilike(f'%{query}%'),
                User.last_name.ilike(f'%{query}%'),
                User.email.ilike(f'%{query}%'),
                User.city.ilike(f'%{query}%')
            )
        ).limit(20).all()
        
        results['users'] = [{
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'city': user.city,
            'avatar': user.avatar,
            'rating_count': user.rating_count,
            'average_rating': (user.rating_sum / user.rating_count) if user.rating_count > 0 else 0
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
