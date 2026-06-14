const { Point } = require('@influxdata/influxdb-client');
const { writeApi, queryApi, org, bucket, url, token } = require('../influx/client');

class InfluxService {
    /**
     * Записує дані з ESP32 в InfluxDB
     * @param {string} deviceId - ID пристрою
     * @param {Array} payload - Масив об'єктів { type, value, unit }
     */
    async writeSensorData(deviceId, payload) {
        try {
            // Проходимось по кожному сенсору в payload
            payload.forEach(sensor => {
                // measurement: sensor_data (згідно з твоїм ТЗ)
                const point = new Point('sensor_data')
                    .tag('device_id', deviceId)          // tags: індексуються для швидкого пошуку
                    .tag('sensor_type', sensor.type)
                    .tag('unit', sensor.unit)            // unit теж логічно зробити тегом
                    .floatField('value', sensor.value)   // fields: самі дані (не індексуються)
                    .timestamp(new Date());              // server timestamp

                writeApi.writePoint(point);
            });

            // Відправляємо батч даних в БД
            await writeApi.flush();
            return true;
        } catch (error) {
            console.error('❌ Error writing to InfluxDB:', error);
            throw new Error('Failed to write data to InfluxDB');
        }
    }

    /**
     * Чорновик методу для читання даних (реалізуємо детальніше в STEP 6)
     */
    async checkConnection() {
        try {
            const fluxQuery = `from(bucket: "${bucket}") |> range(start: -1m) |> limit(n:1)`;
            await queryApi.collectRows(fluxQuery);
            console.log('✅ InfluxDB connection successful');
            return true;
        } catch (error) {
            console.error('❌ InfluxDB connection failed:', error.message);
            return false;
        }
    }

        // ... попередні методи writeSensorData та checkConnection залишаються ...

    /**
     * Отримує останні значення всіх сенсорів для пристрою (Live режим)
     */
    async getLatestData(deviceId) {
        const query = `
            from(bucket: "${bucket}")
            |> range(start: 0)
            |> filter(fn: (r) => r["_measurement"] == "sensor_data")
            |> filter(fn: (r) => r["device_id"] == "${deviceId}")
            |> filter(fn: (r) => r["_field"] == "value")
            |> last()
        `;

        try {
            // Використовуємо стабільний collectRows
            const rows = await queryApi.collectRows(query);
            
            return rows.map(row => ({
                type: row.sensor_type,
                value: row._value,
                unit: row.unit,
                time: row._time
            }));
        } catch (error) {
            console.error('❌ Помилка читання Live даних з InfluxDB:', error.message);
            return []; // Повертаємо пустий масив, щоб не "покласти" фронтенд
        }
    }

    /**
     * Отримує історичні дані для графіків Recharts (History режим)
     */
    async getHistoricalData(deviceId, from, to) {
        const start = from ? `time(v: "${from}")` : '-1h';
        const stop = to ? `time(v: "${to}")` : 'now()';

        const query = `
            from(bucket: "${bucket}")
            |> range(start: ${start}, stop: ${stop})
            |> filter(fn: (r) => r["_measurement"] == "sensor_data")
            |> filter(fn: (r) => r["device_id"] == "${deviceId}")
            |> filter(fn: (r) => r["_field"] == "value")
            |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
            |> keep(columns: ["_time", "sensor_type", "_value"])
            |> group()
            |> pivot(rowKey:["_time"], columnKey: ["sensor_type"], valueColumn: "_value")
        `;

        try {
            const rows = await queryApi.collectRows(query);
            
            return rows.map(row => {
                const point = { time: row._time };
                
                // Динамічно додаємо всі сенсори, відкидаючи службові поля
                for (const key in row) {
                    if (!['_time', '_start', '_stop', '_measurement', 'device_id', 'table', 'result'].includes(key)) {
                        point[key] = row[key];
                    }
                }
                return point;
            });
        } catch (error) {
            console.error('❌ Помилка читання History даних з InfluxDB:', error.message);
            return [];
        }
    }

    /**
     * Видаляє всю історію сенсорних даних пристрою з InfluxDB
     */
    async deleteDeviceData(deviceId) {
        if (!url || !token || !org || !bucket) {
            throw new Error('InfluxDB is not configured.');
        }

        const safeDeviceId = String(deviceId).replace(/"/g, '\\"');
        const start = '1970-01-01T00:00:00Z';
        const stop = new Date().toISOString();
        const baseUrl = url.replace(/\/$/, '');
        const endpoint = `${baseUrl}/api/v2/delete?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start,
                    stop,
                    predicate: `_measurement="sensor_data" and device_id="${safeDeviceId}"`
                })
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(body || `HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Помилка видалення даних з InfluxDB:', error.message);
            throw new Error('Failed to clear device history in InfluxDB');
        }
    }
}

module.exports = new InfluxService();