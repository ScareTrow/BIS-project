from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from .models import Note, User
from . import db


views = Blueprint('views', __name__)


@views.route('/')
def index():
    return render_template('index.html', user=current_user)


@views.route('/about')
def about():
    return render_template('about.html', user=current_user)


@views.route('/admin')
@login_required
def admin():
    if not current_user.isAdmin:
        return redirect(url_for('views.home'))

    notes = [note.description for note in Note.query.all()]

    return render_template('admin.html', user=current_user, notes=notes)


@views.route('/home')
@login_required
def home():    
    notes = [note.description for note in Note.query.all()]

    return render_template('home.html', user=current_user, notes=notes)


def _validate_task_photo(photo, task_id, total_notes):
    if not photo:
        return "Вставьте фотографию в качестве доказательства"

    valid_extensions = ('.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif')
    if not photo.lower().endswith(valid_extensions):
        return "Вставьте файл формата фотографии"

    if task_id < 1 or task_id > total_notes:
        return "Введите id проблемы корректно"

    return "ok"


@views.route('/show_task', methods=['GET', 'POST'])
@login_required
def show_task():
    all_notes = Note.query.all()
    notes = [[note.description, note.coordinates, note.status]
             for note in all_notes]

    if request.method == 'POST':
        photo = request.form.get('photo', '').strip()
        try:
            task_id = int(request.form.get('task-id', 0))
        except (ValueError, TypeError):
            task_id = 0

        message = _validate_task_photo(photo, task_id, len(all_notes))

        if message == "ok":
            note_to_update = all_notes[task_id - 1]
            note_to_update.status = 'pending'
            db.session.commit()
            flash('Заявка успешно отмечена как выполненная!', 'success')
        else:
            flash(message, 'error')

        all_notes = Note.query.all()
        notes = [[note.description, note.coordinates, note.status]
                 for note in all_notes]

    return render_template(
        'show_task.html',
        user=current_user,
        notes=notes,
        message='',
        isAdmin=current_user.isAdmin
    )


def _validate_task_submission(description, coordinates):
    if not coordinates or len(coordinates.strip()) == 0:
        return 'Введите координаты'

    if not description or len(description.strip()) == 0:
        return 'Введите проблему'

    return "ok"


@views.route('/send_task', methods=['GET', 'POST'])
@login_required
def send_task():
    if request.method == 'POST':
        description = request.form.get('description', '').strip()
        coordinates = request.form.get('coordinates', '').strip()

        message = _validate_task_submission(description, coordinates)

        if message == "ok":
            new_note = Note(
                coordinates=coordinates,
                description=description,
                status='In progress',
                user_id=current_user.id
            )
            db.session.add(new_note)
            db.session.commit()

            flash('Заявка успешно отправлена!', 'success')
            return redirect(url_for('views.home'))

        flash(message, 'error')

    return render_template('send_task.html', user=current_user, message='')


@views.route('/users_list')
@login_required
def users_list():
    if not current_user.isAdmin:
        return redirect(url_for('views.home'))

    users = User.query.all()

    return render_template('users_list.html', user=current_user, users=users)
