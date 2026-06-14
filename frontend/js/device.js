document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) { window.location.href = '../index.html'; return; }

    // Отримуємо ID пристрою з URL (?id=ESP32_01)
    const urlParams = new URLSearchParams(window.location.search);
    const deviceId = urlParams.get('id');
    
    if (!deviceId) {
        alert('Не вказано ID пристрою');
        window.location.href = 'dashboard.html';
        return;
    }

    document.getElementById('deviceName').textContent = `🖧 ${deviceId}`;

    // Стан
    let currentMode = 'live'; // 'live' або 'history'
    let liveInterval = null;
    let chartInstances = {}; // Зберігаємо інстанси Chart.js: { temperature: chartObj, humidity: chartObj }

    // UI Елементи
    const tabLive = document.getElementById('tabLive');
    const tabHistory = document.getElementById('tabHistory');
    const historyControls = document.getElementById('historyControls');
    const chartsGrid = document.getElementById('chartsGrid');
    const chartStatus = document.getElementById('chartStatus');

    // --- Допоміжна функція Fetch ---
    async function fetchWithAuth(url) {
        const response = await fetch(`${CONFIG.API_BASE_URL}${url}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('jwt_token');
            window.location.href = '../index.html';
        }
        return await response.json();
    }

    // --- Chart.js Ініціалізація графіку ---
    function createChart(sensorType, unit) {
        // Створюємо HTML структуру для нового графіка
        const card = document.createElement('div');
        card.className = 'chart-card';
        card.innerHTML = `
            <div class="chart-header">
                ${sensorType}
                <span class="chart-latest-val" id="val-${sensorType}">-- ${unit || ''}</span>
            </div>
            <div class="canvas-container">
                <canvas id="canvas-${sensorType}"></canvas>
            </div>
        `;
        chartsGrid.appendChild(card);

        const ctx = document.getElementById(`canvas-${sensorType}`).getContext('2d');
        
        // Налаштування теми Chart.js під наш CSS
        Chart.defaults.color = '#8b949e';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: sensorType,
                    data: [], // Дані у форматі {x: timestamp, y: value}
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3, // Показуємо точки на лінії
                    pointHoverRadius: 5, // Збільшуємо точку при наведенні
                    fill: true,
                    tension: 0.3 // Плавні лінії
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: currentMode === 'live' ? { duration: 400 } : false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            tooltipFormat: 'dd.MM.yyyy HH:mm:ss',
                            displayFormats: {
                                millisecond: 'HH:mm:ss',
                                second: 'HH:mm:ss',
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'dd.MM.yyyy',
                                week: 'dd.MM.yyyy',
                                month: 'MM.yyyy',
                                quarter: 'MM.yyyy',
                                year: 'yyyy'
                            }
                        },
                        ticks: {
                            maxTicksLimit: 6, // Обмежуємо кількість підписів часу
                            maxRotation: 0,   // Запобігає нахилу тексту
                            minRotation: 0
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: false
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        chartInstances[sensorType] = chart;
        return chart;
    }

    // --- Обробка LIVE MODE ---
    async function fetchLiveData() {
        try {
            const { success, data } = await fetchWithAuth(`/devices/${deviceId}/latest`);
            if (!success) throw new Error('Помилка даних');
            
            if (data.length > 0 && chartStatus) chartStatus.remove();

            data.forEach(sensor => {
                const { type, value, unit, time } = sensor;
                
                // Якщо графіка для такого сенсора ще немає - створюємо!
                if (!chartInstances[type]) {
                    createChart(type, unit);
                }

                // Оновлюємо текст поточного значення
                document.getElementById(`val-${type}`).textContent = `${value} ${unit || ''}`;

                // Додаємо точку на графік
                const chart = chartInstances[type];
                const chartData = chart.data.datasets[0].data;
                
                // Запобігаємо дублюванню точок у Live режимі
                const lastPoint = chartData[chartData.length - 1];
                if (!lastPoint || lastPoint.x !== time) {
                    chartData.push({ x: time, y: value });
                    
                    // Зберігаємо тільки останні 20 точок для красивого зсуву
                    if (chartData.length > 20) {
                        chartData.shift();
                    }
                    chart.update('none'); // Оновлюємо без повної перемальовки
                }
            });
        } catch (error) {
            console.error('Live fetch error:', error);
        }
    }

    function startLiveMode() {
        currentMode = 'live';
        tabLive.classList.add('active');
        tabHistory.classList.remove('active');
        historyControls.classList.add('hidden');
        
        // Очищаємо графіки
        chartsGrid.innerHTML = '';
        chartInstances = {};
        
        // Перший запит і запуск інтервалу
        fetchLiveData();
        liveInterval = setInterval(fetchLiveData, 5000); // Оновлення кожні 5 секунд
    }

    // --- Обробка HISTORY MODE ---
    async function loadHistory() {
        const fromDate = document.getElementById('historyFrom').value;
        const toDate = document.getElementById('historyTo').value;
        
        // Форматуємо дати в ISO для InfluxDB (або залишаємо порожніми для дефолту -1h)
        const fromQuery = fromDate ? `&from=${new Date(fromDate).toISOString()}` : '';
        const toQuery = toDate ? `&to=${new Date(toDate).toISOString()}` : '';

        try {
            chartsGrid.innerHTML = '<p class="loading-text">Завантаження історії...</p>';
            chartInstances = {};

            const { success, data } = await fetchWithAuth(`/devices/${deviceId}/history?${fromQuery}${toQuery}`);
            if (!success) throw new Error('Помилка завантаження історії');

            chartsGrid.innerHTML = ''; // Очищаємо "Завантаження..."
            
            if (data.length === 0) {
                chartsGrid.innerHTML = '<p class="loading-text">Немає даних за цей період</p>';
                return;
            }

            // data - це масив об'єктів з InfluxDB pivot: [{time: '..', temperature: 22, humidity: 45}]
            // Потрібно знайти всі унікальні типи сенсорів
            const sensorTypes = [...new Set(data.flatMap(point => Object.keys(point)))].filter(key => key !== 'time');

            // Створюємо графіки
            sensorTypes.forEach(type => {
                createChart(type, ''); // Unit не передається в pivot, можна залишити порожнім
                const chart = chartInstances[type];
                
                // Заповнюємо даними
                chart.data.datasets[0].data = data
                    .filter(point => point[type] !== undefined) // Відкидаємо null
                    .map(point => ({
                        x: point.time,
                        y: point[type]
                    }));
                
                chart.update();
            });

        } catch (error) {
            chartsGrid.innerHTML = `<p class="loading-text" style="color:var(--error)">${error.message}</p>`;
        }
    }

    function startHistoryMode() {
        currentMode = 'history';
        tabHistory.classList.add('active');
        tabLive.classList.remove('active');
        historyControls.classList.remove('hidden');
        
        if (liveInterval) clearInterval(liveInterval);
        
        // Встановлюємо дефолтні значення часу (від -1 години до зараз)
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        // Допоміжна функція для формату datetime-local (YYYY-MM-DDThh:mm)
        const toLocalISO = (date) => new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        
        document.getElementById('historyTo').value = toLocalISO(now);
        document.getElementById('historyFrom').value = toLocalISO(oneHourAgo);

        loadHistory();
    }

    // --- Event Listeners ---
    tabLive.addEventListener('click', startLiveMode);
    tabHistory.addEventListener('click', startHistoryMode);
    document.getElementById('loadHistoryBtn').addEventListener('click', loadHistory);

    // Запускаємо Live Mode при старті
    startLiveMode();
});