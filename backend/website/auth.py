from flask import Blueprint, render_template, request, redirect, url_for, flash
from .models import User
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user


auth = Blueprint('auth', __name__)


def _authenticate_user(user, password):
    if check_password_hash(user.password, password):
        login_user(user, remember=True)
        return "admin" if user.isAdmin else "user"
    return "Неверный пароль! попробуйте ещё раз"


@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(email=email).first()

        if not user:
            message = "Пользователь не найден"
        else:
            message = _authenticate_user(user, password)

            if message == "user":
                flash('Добро пожаловать!', 'success')
                return redirect(url_for('views.home'))

            if message == "admin":
                flash('Добро пожаловать, администратор!', 'success')
                return redirect(url_for('views.admin'))

        flash(message, 'error')

    return render_template("login.html", user=current_user, message='')


@auth.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы успешно вышли из системы.', 'info')
    return redirect(url_for('views.index'))


def _validate_signup(user, email, first_name, password1, password2):
    import re
    
    if user:
        return "Пользователь с такой почтой уже существует!"

    if len(email) < 4:
        return "Email должен содержать более 3 символов!"

    if len(first_name) < 2:
        return "Имя должно содержать более 1 символа!"

    if password1 != password2:
        return "Пароли не совпадают"

    # NIST Password Policy (SP 800-63B)
    if len(password1) < 8:
        return "Пароль должен содержать минимум 8 символов"
    
    if len(password1) > 128:
        return "Пароль не должен превышать 128 символов"
    
    # Check for character variety
    has_upper = bool(re.search(r'[A-ZА-ЯЁ]', password1))
    has_lower = bool(re.search(r'[a-zа-яё]', password1))
    has_digit = bool(re.search(r'[0-9]', password1))
    has_special = bool(re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?\/\\~`]', password1))
    
    errors = []
    if not has_upper:
        errors.append("заглавную букву")
    if not has_lower:
        errors.append("строчную букву")
    if not has_digit:
        errors.append("цифру")
    if not has_special:
        errors.append("специальный символ (!@#$%^&*()_+-=[]{}|;:,.<>?)")
    
    if errors:
        return f"Пароль должен содержать: {', '.join(errors)}"
    
    # Check for common weak patterns
    common_patterns = [
        r'(.)\1{2,}',  # Repeated characters
        r'(012|123|234|345|456|567|678|789|890)',  # Sequential numbers
        r'(qwerty|asdfgh|zxcvbn|password|123456)',  # Common patterns
    ]
    
    for pattern in common_patterns:
        if re.search(pattern, password1, re.IGNORECASE):
            return "Пароль содержит слабые паттерны. Используйте более сложный пароль"

    return "ok"


@auth.route('/sign-up', methods=['GET', 'POST'])
def sign_up():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        first_name = request.form.get('firstName', '').strip()
        last_name = request.form.get('lastName', '').strip()
        password1 = request.form.get('password1', '')
        password2 = request.form.get('password2', '')

        user = User.query.filter_by(email=email).first()

        message = _validate_signup(
            user, email, first_name, password1, password2
        )

        if message == "ok":
            new_user = User(
                email=email,
                password=generate_password_hash(
                    password1, method='pbkdf2:sha256', salt_length=8
                ),
                first_name=first_name,
                last_name=last_name,
                isAdmin=False
            )

            telegram_id = request.args.get('telegram_id') or request.form.get('telegram_id')
            if telegram_id:
                new_user.telegram_id = str(telegram_id)
            
            db.session.add(new_user)
            db.session.commit()
            login_user(new_user, remember=True)
            flash('Регистрация успешна! Пожалуйста, заполните ваш профиль.', 'success')
            return redirect(url_for('views.edit_profile'))

        flash(message, 'error')

    return render_template("sign_up.html", user=current_user, message='')


@auth.route('/auth/telegram', methods=['GET'])
def telegram_auth():
    telegram_id = request.args.get('telegram_id')
    
    if not telegram_id:
        flash('Ошибка авторизации через Telegram', 'error')
        return redirect(url_for('views.index'))
    
    user = User.query.filter_by(telegram_id=telegram_id).first()
    
    if user:
        login_user(user, remember=True)
        flash('Вы успешно авторизованы через Telegram!', 'success')
        return redirect(url_for('views.home'))
    
    flash('Для использования Telegram бота необходимо войти в систему. Пожалуйста, войдите или зарегистрируйтесь.', 'info')
    return redirect(url_for('auth.login'))


# JSON API для фронтенда
@auth.route('/api/auth/login', methods=['POST'])
def api_login():
    from flask import jsonify
    data = request.get_json()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 401

    result = _authenticate_user(user, password)
    
    if result in ['user', 'admin']:
        return jsonify({
            'success': True,
            'message': 'Вход выполнен успешно',
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'isAdmin': user.isAdmin
            }
        })
    
    return jsonify({'success': False, 'message': result}), 401


@auth.route('/api/auth/logout', methods=['POST'])
@login_required
def api_logout():
    from flask import jsonify
    logout_user()
    return jsonify({'success': True, 'message': 'Выход выполнен успешно'})


@auth.route('/api/auth/signup', methods=['POST'])
def api_signup():
    from flask import jsonify
    data = request.get_json()
    email = data.get('email', '').strip()
    first_name = data.get('firstName', '').strip()
    last_name = data.get('lastName', '').strip()
    password1 = data.get('password1', '')
    password2 = data.get('password2', '')
    phone = data.get('phone', '').strip()
    city = data.get('city', '').strip()
    city_hidden = data.get('cityHidden', False)

    # Валидация телефона (обязательное поле)
    if not phone:
        return jsonify({'success': False, 'message': 'Номер телефона обязателен'}), 400
    
    # Простая валидация формата телефона
    import re
    phone_pattern = re.compile(r'^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$')
    if not phone_pattern.match(phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')):
        return jsonify({'success': False, 'message': 'Некорректный формат номера телефона'}), 400

    # Валидация города (обязательное поле)
    if not city:
        return jsonify({'success': False, 'message': 'Город проживания обязателен'}), 400

    user = User.query.filter_by(email=email).first()

    message = _validate_signup(user, email, first_name, password1, password2)

    if message == "ok":
        new_user = User(
            email=email,
            password=generate_password_hash(password1, method='pbkdf2:sha256', salt_length=8),
            first_name=first_name,
            last_name=last_name,
            isAdmin=False,
            city=city,
            city_hidden=bool(city_hidden)
        )

        telegram_id = data.get('telegram_id')
        if telegram_id:
            new_user.telegram_id = str(telegram_id)
        
        # Сохраняем телефон в social_links как временное решение
        # В будущем можно добавить отдельное поле phone_number в модель
        import json
        social_links = {'phone': phone}
        new_user.social_links = json.dumps(social_links, ensure_ascii=False)
        
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user, remember=True)
        
        return jsonify({
            'success': True,
            'message': 'Регистрация успешна! Пожалуйста, заполните ваш профиль.',
            'user': {
                'id': new_user.id,
                'email': new_user.email,
                'first_name': new_user.first_name,
                'last_name': new_user.last_name,
                'isAdmin': new_user.isAdmin
            }
        })

    return jsonify({'success': False, 'message': message}), 400