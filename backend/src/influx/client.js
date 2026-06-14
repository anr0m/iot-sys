const { InfluxDB } = require('@influxdata/influxdb-client');

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

if (!url || !token) {
    console.warn('⚠️ InfluxDB configuration is missing in .env!');
}

// Створюємо інстанс клієнта
const influxDB = new InfluxDB({ url, token });

// API для запису (write) та читання (query)
const writeApi = influxDB.getWriteApi(org, bucket, 'ns'); // 'ns' = наносекунди (дефолт)
const queryApi = influxDB.getQueryApi(org);

module.exports = {
    influxDB,
    writeApi,
    queryApi,
    org,
    bucket,
    url,
    token
};