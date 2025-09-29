from flask import Blueprint, render_template, request, flash, redirect, url_for
from .models import User
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user


auth = Blueprint('auth', __name__)


@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        if email == 'admin@bk.ru' and password == 'admin':
            return redirect(url_for('views.admin'))
        else:
            user = User.query.filter_by(email=email).first()
            if user:
                if check_password_hash(user.password, password):
                    login_user(user, remember=True)
                    return redirect(url_for('views.home'))
                else:
                    flash('Неверный пароль. Попробуйте ещё раз.', category='error')
            else:
                flash('Пользователь не найден.', category='error')
    return render_template("login.html", user=current_user)


@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('views.index'))


@auth.route('/sign-up', methods=['GET', 'POST'])
def sign_up():
    if request.method == 'POST':
        email = request.form.get('email')
        first_name = request.form.get('firstName')
        last_name = request.form.get('lastName')
        address = request.form.get('address')
        phone = request.form.get('phone')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')
        user = User.query.filter_by(email=email).first()
        if user:
            flash('Пользователь с таким именем уже существует.', category='error')
        elif len(email) < 4:
            flash('Логин должен иметь более 3 символов.', category='error')
        elif len(first_name) < 2:
            flash('Имя должно иметь более 1 символа.', category='error')
        elif password1 != password2:
            flash('Пароли не совпадают.', category='error')
        elif len(password1) < 7:
            flash('Пароль должен иметь как минимум 7 символов.', category='error')
        else:
            new_user = User(email=email, first_name=first_name,
                            last_name=last_name, address=address,
                            phone=phone, password=generate_password_hash(password1,
                                                                         method='sha256'))
            db.session.add(new_user)
            db.session.commit()
            login_user(new_user, remember=True)
            return redirect(url_for('views.home'))
    return render_template("sign_up.html", user=current_user)
