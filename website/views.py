from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required, current_user
from .models import User
from . import db


views = Blueprint('views', __name__)


@views.route('/')
def index():
    return render_template('index.html', user=current_user)


@views.route('/admin')
@login_required
def admin():
    return render_template('admin.html', user=current_user)


@views.route('/home')
@login_required
def home():
    return render_template('home.html', user=current_user)
