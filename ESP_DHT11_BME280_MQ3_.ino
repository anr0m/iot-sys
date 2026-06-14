#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_BME280.h>

// --- НАЛАШТУВАННЯ МЕРЕЖІ ТА СЕРВЕРА ---
const char* ssid = "";           
const char* password = "";   
const char* serverUrl = ""; 

// --- НАЛАШТУВАННЯ ПРИСТРОЮ ---
const String DEVICE_ID = "ESP32_PHYSICAL_NODE";
const unsigned long interval = 5000; 
unsigned long previousMillis = 0;

// --- КОНФІГУРАЦІЯ ДАТЧИКІВ ---
#define DHTPIN 4          
#define DHTTYPE DHT11     
DHT dht(DHTPIN, DHTTYPE);

Adafruit_BME280 bme;      
bool bmePresent = false;  

#define MQ3_PIN 34        

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\nЗапуск фізичного IoT-вузла: " + DEVICE_ID);
  
  // Ініціалізація датчиків
  dht.begin();
  Serial.println("Датчик DHT11 ініціалізовано.");

  // Перевірка підключення BME280 по I2C
  if (bme.begin(0x76)) {
    bmePresent = true;
    Serial.println("Датчик BME280 знайдено за адресою 0x76.");
  } else if (bme.begin(0x77)) {
    bmePresent = true;
    Serial.println("Датчик BME280 знайдено за адресою 0x77.");
  } else {
    Serial.println("Датчик BME280 не знайдено!");
  }

  // Налаштування аналогового піна для MQ3
  pinMode(MQ3_PIN, INPUT);
  analogSetPinAttenuation(MQ3_PIN, ADC_11db); 
  Serial.println("Датчик MQ3 готовий до зчитування.");
  
  // Підключення до Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Підключення до Wi-Fi ");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nПідключено! IP адреса: " + WiFi.localIP().toString());
}

// ==========================================
// УНІВЕРСАЛЬНА ФУНКЦІЯ ДЛЯ МАСШТАБОВАНОСТІ
// ==========================================
// Додає один показник у масив JSON, якщо значення є коректним числом
void addMetric(JsonArray& jsonArray, const char* metricType, float value, const char* unit) {
  // Перевірка на помилку зчитування (якщо датчик повернув NaN)
  if (isnan(value)) {
    Serial.printf("Помилка: Не вдалося зчитати метрику '%s' (значення NaN)\n", metricType);
    return; // Пропускаємо додавання несправної метрики
  }

  JsonObject metricObj = jsonArray.add<JsonObject>();
  metricObj["type"] = metricType;
  metricObj["value"] = round(value * 10.0) / 10.0; // Округлення до 1 знаку після коми
  metricObj["unit"] = unit;
}

// Функція для збору даних з усіх датчиків
String buildJsonPayload() {
  JsonDocument doc; 
  doc["device_id"] = DEVICE_ID;
  JsonArray payloadArray = doc["payload"].to<JsonArray>();

  // --- 1. Зчитування з DHT11 ---
  float dhtTemp = dht.readTemperature();
  float dhtHum = dht.readHumidity();
  addMetric(payloadArray, "dht11_temperature", dhtTemp, "C");
  addMetric(payloadArray, "dht11_humidity", dhtHum, "%");

  // --- 2. Зчитування з BME280 ---
  if (bmePresent) {
    float bmeTemp = bme.readTemperature();
    float bmeHum = bme.readHumidity();
    float bmePress = bme.readPressure() / 100.0F; // Переводимо Паскалі в гектопаскалі (hPa)
    
    addMetric(payloadArray, "bme280_temperature", bmeTemp, "C");
    addMetric(payloadArray, "bme280_humidity", bmeHum, "%");
    addMetric(payloadArray, "bme280_pressure", bmePress, "hPa");
  }

  // --- 3. Зчитування з MQ3 (Аналоговий датчик газу/алкоголю) ---
  int mq3Raw = analogRead(MQ3_PIN);
  // За бажанням, тут можна зробити мапування у вольти або ppm, але для телеметрії підходить і raw-значення
  addMetric(payloadArray, "mq3_gas_raw", (float)mq3Raw, "units");

  // Серіалізуємо об'єкт у компактний JSON-рядок
  String jsonString;
  serializeJson(doc, jsonString);
  return jsonString;
}

// Функція для відправки POST запиту на сервер Node.js
void sendData(String payload) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(payload);
    
    if (httpResponseCode > 0) {
      String responseBody = http.getString();
      Serial.printf("[HTTP] Код: %d | Сервер прийняв: %s\n", httpResponseCode, responseBody.c_str());
    } else {
      Serial.printf("[HTTP] Помилка відправки: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end(); 
  } else {
    Serial.println("Втрачено підключення до Wi-Fi. Перепідключення...");
    WiFi.reconnect();
  }
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    
    String jsonPayload = buildJsonPayload();
    
    Serial.println("\nСформований JSON: " + jsonPayload); 
    
    sendData(jsonPayload);
  }
}