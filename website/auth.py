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
    if user:
        return "Пользователь с такой почтой уже существуе!"

    if len(email) < 4:
        return "Email должен содержать более 3 символов!"

    if len(first_name) < 2:
        return "Имя должно содержать более 1 символа!"

    if password1 != password2:
        return "Пароли не совпадают"

    if len(password1) < 7:
        return "Пароль должен содержать как минимум 7 символов!"

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

            db.session.add(new_user)
            db.session.commit()
            login_user(new_user, remember=True)
            flash('Регистрация успешна! Добро пожаловать!', 'success')
            return redirect(url_for('views.home'))

        flash(message, 'error')

    return render_template("sign_up.html", user=current_user, message='')
