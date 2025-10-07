from flask import Blueprint, render_template, request, flash
from flask_login import login_required, current_user
from .models import Note, User
from . import db


views = Blueprint('views', __name__)


@views.route('/')
def index():
    return render_template('index.html', user=current_user)


@views.route('/admin')
@login_required
def admin():
    notes = []
    for note in Note.query.all():
        notes.append(note.data)
    return render_template('admin.html', user=current_user, notes=notes)


@views.route('/home')
@login_required
def home():
    notes = []
    for note in Note.query.all():
        notes.append(note.data)
    return render_template('home.html', user=current_user, notes=notes)


@views.route('/show_task')
@login_required
def show_task():
    return render_template('show_task.html', user=current_user)


@views.route('/send_task', methods=['GET', 'POST'])
@login_required
def send_task():
    if request.method == 'POST':
        note = request.form.get('note', "")
        if len(note) < 1:
            flash('Введите задачу.', category='error')
        else:
            new_note = Note(data=note, user_id=current_user.id,
                            status='In progress')
            db.session.add(new_note)
            db.session.commit()
    return render_template('send_task.html', user=current_user)


@views.route('/contacts')
def contacts():
    return render_template('contacts.html', user=current_user)


@views.route('/contacts-login')
def contacts_login():
    return render_template('contacts-login.html', user=current_user)


@views.route('/users_list', methods=['GET', 'POST'])
def users_list():
    users = []
    for user in User.query.all():
        users.append(user.first_name)
    if request.method == 'POST':
        pass
    return render_template('users_list.html', user=current_user, users=users)
