document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwt_token');
    const userRole = localStorage.getItem('user_role');

    // Якщо немає токена, повертаємо на логін
    if (!token) {
        window.location.href = '../index.html';
        return;
    }

    // Показуємо адмінку, якщо юзер - адмін
    if (userRole === 'admin') {
        document.getElementById('adminLink').classList.remove('hidden');
    }

    const devicesGrid = document.getElementById('devicesGrid');
    const linkForm = document.getElementById('linkForm');
    const linkAlert = document.getElementById('linkAlert');
    const refreshBtn = document.getElementById('refreshBtn');

    // --- Допоміжна функція для запитів з токеном ---
    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        const response = await fetch(`${CONFIG.API_BASE_URL}${url}`, { ...options, headers });
        const data = await response.json();
        
        // Якщо токен протермінувався
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('jwt_token');
            window.location.href = '../index.html';
            throw new Error('Сесія закінчилась');
        }
        
        return { response, data };
    }

    // --- Завантаження та фонове оновлення пристроїв ---
    async function refreshDevices(isInitial = false) {
        try {
            if (isInitial) {
                devicesGrid.innerHTML = '<p class="loading-text">Завантаження...</p>';
            }
            
            // 1. Отримуємо список прив'язаних девайсів
            const { data: devicesData } = await fetchWithAuth('/devices');
            if (!devicesData.success) throw new Error(devicesData.message);
            
            const devices = devicesData.devices;

            if (devices.length === 0) {
                devicesGrid.innerHTML = '<p class="loading-text">У вас ще немає прив\'язаних пристроїв. Додайте перший!</p>';
                return;
            }

            // Якщо раніше була заглушка завантаження або "немає пристроїв", очищуємо сітку
            const firstChild = devicesGrid.firstElementChild;
            if (firstChild && (firstChild.classList.contains('loading-text') || isInitial)) {
                devicesGrid.innerHTML = '';
            }

            // Отримуємо список поточних ID для видалення тих, яких більше немає
            const activeIds = new Set(devices.map(d => d.device_id));
            const existingCards = devicesGrid.querySelectorAll('.device-card');
            existingCards.forEach(card => {
                const id = card.id.replace('card-', '');
                if (!activeIds.has(id)) {
                    card.remove();
                }
            });

            // 2. Оновлюємо або створюємо картки
            for (const device of devices) {
                let card = document.getElementById(`card-${device.device_id}`);
                if (!card) {
                    renderSkeletonCard(device.device_id);
                }
                
                try {
                    const { data: latestData } = await fetchWithAuth(`/devices/${device.device_id}/latest`);
                    updateCard(device, latestData.data || []);
                } catch (e) {
                    updateCard(device, [], true);
                }
            }

        } catch (error) {
            console.error(error);
            if (isInitial || devicesGrid.querySelectorAll('.device-card').length === 0) {
                devicesGrid.innerHTML = `<p class="loading-text" style="color: var(--error);">Помилка завантаження: ${error.message}</p>`;
            }
        }
    }

    // --- Рендеринг карток ---
    function renderSkeletonCard(deviceId) {
        const div = document.createElement('div');
        div.className = 'device-card';
        div.id = `card-${deviceId}`;
        div.innerHTML = `
            <div class="device-header">
                <span class="device-title">${deviceId}</span>
                <span class="status"><div class="status-dot"></div> Завантаження...</span>
            </div>
            <div class="sensor-data"></div>
        `;
        devicesGrid.appendChild(div);
    }

    function updateCard(device, sensorData, hasError = false) {
        const card = document.getElementById(`card-${device.device_id}`);
        if (!card) return;

        const statusClass = device.is_online ? 'online' : 'offline';
        const statusText = device.is_online ? 'Online' : 'Offline';
        
        let sensorsHtml = '';
        let lastTimeText = device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Ніколи';

        if (hasError) {
            sensorsHtml = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Дані тимчасово недоступні</p>';
        } else if (sensorData.length === 0) {
            sensorsHtml = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Немає даних від сенсорів</p>';
        } else {
            // Формуємо бейджі для кожного сенсора
            sensorData.forEach(sensor => {
                sensorsHtml += `
                    <div class="sensor-badge" title="${sensor.type}">
                        <span class="sensor-type" title="${sensor.type}">${sensor.type}</span>
                        <span class="sensor-value">${sensor.value} <span style="font-size:0.8rem; color:var(--text-secondary)">${sensor.unit || ''}</span></span>
                    </div>
                `;
            });
            // Беремо час останньої точки InfluxDB
            lastTimeText = new Date(sensorData[0].time).toLocaleString();
        }

        card.innerHTML = `
            <div class="device-header">
                <span class="device-title">🖧 ${device.device_id}</span>
                <span class="status ${statusClass}"><div class="status-dot"></div> ${statusText}</span>
            </div>
            <div class="sensor-data">
                ${sensorsHtml}
            </div>
            <div class="device-time">Останні дані: ${lastTimeText}</div>
        `;

        // Клік по картці переводить на сторінку девайсу (STEP 9)
        card.onclick = () => {
            window.location.href = `device.html?id=${device.device_id}`;
        };
    }

    // --- Прив'язка нового девайсу ---
    linkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('newDeviceId');
        const deviceId = input.value.trim();
        const btn = linkForm.querySelector('button');

        btn.disabled = true;
        linkAlert.style.display = 'none';

        try {
            const { data } = await fetchWithAuth('/devices/link', {
                method: 'POST',
                body: JSON.stringify({ device_id: deviceId })
            });

            if (data.success) {
                input.value = '';
                showLinkAlert('Пристрій успішно прив\'язано!', 'success');
                refreshDevices(false); // М'яко оновлюємо список
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showLinkAlert(error.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });

    function showLinkAlert(message, type) {
        linkAlert.textContent = message;
        linkAlert.className = `alert ${type}`;
        if (type === 'success') {
            linkAlert.style.backgroundColor = 'rgba(46, 160, 67, 0.1)';
            linkAlert.style.color = 'var(--success)';
            linkAlert.style.border = '1px solid rgba(46, 160, 67, 0.2)';
        } else {
            linkAlert.style.cssText = ''; 
        }
        linkAlert.style.display = 'block';
    }

    // --- Інші події ---
    refreshBtn.addEventListener('click', () => refreshDevices(true));
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        clearInterval(autoRefreshInterval);
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        window.location.href = '../index.html';
    });

    // Автоматичне фонове оновлення кожні 5 секунд
    const autoRefreshInterval = setInterval(() => {
        refreshDevices(false);
    }, 5000);

    // Ініціалізація
    refreshDevices(true);
});