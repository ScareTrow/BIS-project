"""
Тесты для админ-панели
"""
import pytest
from backend.website.models import User, Application, ModerationStatus, ApplicationCategory
from backend.website import db


@pytest.mark.admin
class TestAdminPanel:
    """Тесты для админ-панели"""
    
    def test_admin_stats(self, client, admin_user):
        """Тест получения статистики админа"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.get('/api/admin/stats')
        assert response.status_code == 200
        data = response.get_json()
        assert 'total_users' in data or 'users' in data
        assert 'total_applications' in data or 'applications' in data
    
    def test_admin_stats_unauthorized(self, client, test_user):
        """Тест получения статистики не-админом"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.get('/api/admin/stats')
        assert response.status_code in [401, 403]
    
    def test_get_admin_applications(self, client, admin_user, test_application_pending):
        """Тест получения списка заявок для модерации"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.get('/api/admin/applications')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    def test_approve_application(self, client, admin_user, test_application_pending):
        """Тест одобрения заявки"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(f'/api/admin/applications/{test_application_pending.id}/approve')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.get(test_application_pending.id)
            assert application.moderation_status == ModerationStatus.APPROVED
            assert application.moderator_id == admin_user.id
    
    def test_reject_application(self, client, admin_user, test_application_pending):
        """Тест отклонения заявки"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(f'/api/admin/applications/{test_application_pending.id}/reject')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.get(test_application_pending.id)
            assert application.moderation_status == ModerationStatus.REJECTED
    
    def test_mark_application_false_admin(self, client, admin_user, test_application):
        """Тест пометки заявки как ложный вызов админом"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(f'/api/admin/applications/{test_application.id}/mark-false')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.get(test_application.id)
            assert application.is_false_call is True
    
    def test_set_application_priority(self, client, admin_user, test_application):
        """Тест установки приоритета заявки"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(
            f'/api/admin/applications/{test_application.id}/set-priority',
            json={'priority': 5}
        )
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.get(test_application.id)
            assert application.priority == 5
    
    def test_get_admin_users(self, client, admin_user):
        """Тест получения списка пользователей"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.get('/api/admin/users')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    def test_block_user(self, client, admin_user, test_user):
        """Тест блокировки пользователя"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(
            f'/api/admin/users/{test_user.id}/block',
            data={'days': 7, 'reason': 'Test block'}
        )
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            user = User.query.get(test_user.id)
            assert user.is_blocked is True
            assert user.blocked_reason == 'Test block'
    
    def test_unblock_user(self, client, admin_user, test_user):
        """Тест разблокировки пользователя"""
        # Сначала блокируем
        with client.application.app_context():
            from datetime import datetime, timezone, timedelta
            test_user.is_blocked = True
            test_user.blocked_until = datetime.now(timezone.utc) + timedelta(days=7)
            db.session.commit()
        
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(f'/api/admin/users/{test_user.id}/unblock')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            user = User.query.get(test_user.id)
            assert user.is_blocked is False
    
    def test_make_admin(self, client, admin_user, test_user):
        """Тест назначения администратором (только супер-админ)"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        response = client.post(f'/api/admin/users/{test_user.id}/make-admin')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            user = User.query.get(test_user.id)
            assert user.isAdmin is True
    
    def test_delete_user(self, client, admin_user, test_user):
        """Тест удаления пользователя"""
        client.post('/api/auth/login', json={
            'email': admin_user.email,
            'password': 'Admin1234!@#$'
        })
        
        user_id = test_user.id
        response = client.post(f'/api/admin/users/{user_id}/delete')
        assert response.status_code in [200, 201, 302]
        
        # Проверяем в БД
        with client.application.app_context():
            user = User.query.get(user_id)
            assert user is None

