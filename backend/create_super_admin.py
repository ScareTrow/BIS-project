import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.website import create_app, db
from backend.website.models import User
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    existing_super_admin = User.query.filter_by(is_super_admin=True).first()
    
    if existing_super_admin:
        print("Super admin already exists!")
        print(f"Email: {existing_super_admin.email}")
    else:
        email = input("Enter super admin email: ")
        password = input("Enter super admin password: ")
        first_name = input("Enter first name: ")
        last_name = input("Enter last name (optional): ").strip() or None
        
        super_admin = User(
            email=email,
            password=generate_password_hash(
                password, method='pbkdf2:sha256', salt_length=8
            ),
            first_name=first_name,
            last_name=last_name,
            isAdmin=True,
            is_super_admin=True
        )
        
        db.session.add(super_admin)
        db.session.commit()
        
        print(f"Super admin created successfully!")
        print(f"Email: {email}")

