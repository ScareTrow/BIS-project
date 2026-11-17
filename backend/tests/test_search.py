"""
Тесты для поиска и фильтрации
"""
import pytest


@pytest.mark.api
class TestSearch:
    """Тесты для поиска"""
    
    def test_search_applications(self, client, test_application):
        """Тест поиска заявок"""
        response = client.get('/api/search?q=food&type=applications')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, dict) or isinstance(data, list)
    
    def test_search_users(self, client, test_user):
        """Тест поиска пользователей"""
        response = client.get('/api/search?q=Test&type=users')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, dict) or isinstance(data, list)
    
    def test_search_cities(self, client):
        """Тест поиска городов"""
        response = client.get('/api/search?q=Almaty&type=cities')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, dict) or isinstance(data, list)
    
    def test_search_all(self, client, test_application, test_user):
        """Тест комплексного поиска"""
        response = client.get('/api/search?q=test&type=all')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, dict)
    
    def test_search_cities_endpoint(self, client):
        """Тест endpoint поиска городов"""
        response = client.get('/api/cities/search?q=Alm')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    def test_search_empty_query(self, client):
        """Тест поиска с пустым запросом"""
        response = client.get('/api/search?q=&type=all')
        # Может вернуть пустой результат или все результаты
        assert response.status_code in [200, 400]

