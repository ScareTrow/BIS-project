// Проверка, что код выполняется в правильном контексте
if (typeof window === 'undefined') {
    console.error('map.js should only run in browser context');
}

let map;
let markers = [];
let isAuthenticated = false;
let currentMarker = null;
const categoryIcons = {
    food: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    medicine: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    shelter: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    emergency: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [30, 50],
        iconAnchor: [15, 50],
        popupAnchor: [1, -40],
        shadowSize: [50, 50]
    }),
    sos: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [40, 60],
        iconAnchor: [20, 60],
        popupAnchor: [1, -50],
        shadowSize: [60, 60]
    })
};

const categoryNames = {
    food: 'Продукты питания',
    medicine: 'Медицинская помощь',
    shelter: 'Убежище/Кров',
    emergency: 'Экстренная помощь'
};

function initMap() {
    if (typeof L === 'undefined') {
        console.error('Leaflet (L) is not defined. Make sure Leaflet script is loaded before map.js');
        return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container #map not found in DOM');
        return;
    }

    try {
        map = L.map('map').setView([43.2220, 76.8512], 10);

        let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: 'abcd',
            maxZoom: 20
        });

        let fallbackUsed = false;
        tileLayer.on('tileerror', function (error, tile) {
            if (!fallbackUsed) {
                fallbackUsed = true;
                map.removeLayer(tileLayer);
                const fallbackLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                });
                fallbackLayer.addTo(map);
            }
        });

        tileLayer.addTo(map);
        loadMapPoints();

        if (isAuthenticated) {
            map.on('click', onMapClick);
        }
    } catch (error) {
        console.error('Error in initMap:', error);
    }
}

function loadMapPoints() {
    fetch('/api/map/points')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(points => {
            points.forEach(point => {
                addMarkerToMap(point);
            });
        })
        .catch(error => {
            console.error('Error loading map points:', error);
        });
}

function addMarkerToMap(point) {
    const icon = point.is_sos ? categoryIcons.sos : categoryIcons[point.category] || categoryIcons.emergency;

    const marker = L.marker([point.latitude, point.longitude], { icon: icon })
        .addTo(map)
        .bindPopup(createPopupContent(point));

    markers.push(marker);
}

function createPopupContent(point) {
    const categoryName = categoryNames[point.category] || point.category;

    let content = `
        <div class="map-popup">
            <h5><strong>${categoryName}</strong></h5>
            <p>${point.description}</p>
    `;

    if (point.is_sos) {
        content += `<p><strong style="color: red;">SOS!</strong> Количество в радиусе: ${point.sos_count}</p>`;
    }

    if (point.expires_at) {
        const expires = new Date(point.expires_at);
        content += `<p><small>Действует до: ${expires.toLocaleDateString('ru-RU')}</small></p>`;
    }

    if (isAuthenticated) {
        content += `<a href="/applications/${point.id}" class="btn btn-sm btn-primary mt-2">Подробнее</a>`;
    }

    content += `</div>`;
    return content;
}

function onMapClick(e) {
    if (!isAuthenticated) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;


    if (currentMarker) {
        map.removeLayer(currentMarker);
    }


    currentMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        }),
        draggable: true
    }).addTo(map);

    currentMarker.on('dragend', function () {
        const position = currentMarker.getLatLng();
        showCreatePointModal(position.lat, position.lng);
    });


    showCreatePointModal(lat, lng);
}

function showCreatePointModal(lat, lng) {

    const modalHtml = `
        <div class="modal fade" id="createPointModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Создать точку на карте</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="createPointForm">
                            <div class="form-group">
                                <label>Категория</label>
                                <select class="form-control" name="category" id="categorySelect" required>
                                    <option value="food">Продукты питания</option>
                                    <option value="medicine">Медицинская помощь</option>
                                    <option value="shelter">Убежище/Кров</option>
                                    <option value="emergency">Экстренная помощь</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Описание</label>
                                <textarea class="form-control" name="description" rows="3" required placeholder="Опишите ситуацию..."></textarea>
                            </div>
                            <div class="form-group">
                                <label>Срок действия (дней)</label>
                                <select class="form-control" name="expires_days">
                                    <option value="3">3 дня</option>
                                    <option value="7">Неделя</option>
                                    <option value="14">2 недели</option>
                                    <option value="30">Месяц</option>
                                </select>
                            </div>
                            <input type="hidden" name="latitude" value="${lat}">
                            <input type="hidden" name="longitude" value="${lng}">
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Отмена</button>
                        <button type="button" class="btn btn-primary" onclick="submitPoint()">Создать</button>
                    </div>
                </div>
            </div>
        </div>
    `;


    const existingModal = document.getElementById('createPointModal');
    if (existingModal) {
        existingModal.remove();
    }


    document.body.insertAdjacentHTML('beforeend', modalHtml);


    $('#createPointModal').modal('show');


    document.getElementById('categorySelect').addEventListener('change', function () {
        if (currentMarker) {
            const category = this.value;
            const newIcon = categoryIcons[category] || categoryIcons.emergency;
            currentMarker.setIcon(newIcon);
        }
    });
}

function submitPoint() {
    const form = document.getElementById('createPointForm');
    const formData = new FormData(form);

    const data = {
        latitude: parseFloat(formData.get('latitude')),
        longitude: parseFloat(formData.get('longitude')),
        category: formData.get('category'),
        description: formData.get('description'),
        expires_days: parseInt(formData.get('expires_days'))
    };

    fetch('/api/map/points', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(result => {
            $('#createPointModal').modal('hide');
            if (currentMarker) {
                map.removeLayer(currentMarker);
                currentMarker = null;
            }
            alert('Точка создана! Ожидает модерации.');

            clearMarkers();
            loadMapPoints();
        })
        .catch(error => {
            console.error('Error creating point:', error);
            alert('Ошибка при создании точки');
        });
}

function quickSOS() {
    if (typeof isAuthenticated !== 'undefined' && !isAuthenticated) {
        alert('Необходимо войти в систему для отправки SOS');
        return;
    }

    if (!navigator.geolocation) {
        alert('Геолокация не поддерживается вашим браузером');
        return;
    }

    const confirmSOS = confirm('Отправить SOS? Ваше местоположение будет определено автоматически.');
    if (!confirmSOS) return;

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            fetch('/api/sos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: lat,
                    longitude: lng
                })
            })
                .then(response => response.json())
                .then(result => {
                    alert('SOS отправлен! Ожидает модерации.');
                    clearMarkers();
                    loadMapPoints();
                })
                .catch(error => {
                    console.error('Error sending SOS:', error);
                    alert('Ошибка при отправке SOS');
                });
        },
        function (error) {
            alert('Не удалось определить местоположение. Разрешите доступ к геолокации.');
        }
    );
}

function clearMarkers() {
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    markers = [];
}

function loadApplicationsList() {
    const container = document.getElementById('applications-list-content');
    const loading = document.getElementById('applications-list-loading');
    
    if (!container) return;
    
    fetch('/api/applications/list')
        .then(response => response.json())
        .then(data => {
            loading.style.display = 'none';
            container.style.display = 'block';
            
            if (data.length === 0) {
                container.innerHTML = '<div class="alert alert-info">Нет доступных заявок</div>';
                return;
            }
            
            let html = '<div class="row">';
            data.forEach(app => {
                const categoryBadges = {
                    'food': '<span class="badge badge-success">Продукты</span>',
                    'medicine': '<span class="badge badge-danger">Медицина</span>',
                    'shelter': '<span class="badge badge-primary">Убежище</span>',
                    'emergency': '<span class="badge badge-warning">Экстренная помощь</span>'
                };
                
                html += `
                    <div class="col-md-4 mb-3">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <span class="badge badge-secondary">#${app.number || app.id}</span>
                                    ${categoryBadges[app.category] || ''}
                                    ${app.is_sos ? '<span class="badge badge-warning">SOS</span>' : ''}
                                    ${app.priority > 0 ? `<span class="badge badge-info">Приоритет: ${app.priority}</span>` : ''}
                                </h5>
                                <p class="card-text">${app.description}</p>
                                <p class="card-text">
                                    <small class="text-muted">
                                        <strong>Местоположение:</strong> ${app.location || 'Не указано'}<br>
                                        <strong>Приоритет:</strong> ${app.priority || 0}
                                    </small>
                                </p>
                                <a href="/applications/${app.id}" class="btn btn-primary btn-sm">Подробнее</a>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading applications list:', error);
            loading.style.display = 'none';
            container.style.display = 'block';
            container.innerHTML = '<div class="alert alert-danger">Ошибка при загрузке заявок</div>';
        });
}

window.initMap = initMap;
window.submitPoint = submitPoint;
window.quickSOS = quickSOS;
window.loadApplicationsList = loadApplicationsList;
