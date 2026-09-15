#include <esp_now.h>
#include <WiFi.h>
#include <esp_arduino_version.h>
#include "DHT.h"
#include "mbedtls/md.h"

// Cryptographic Device Secret Key for Section 65B Indian Evidence Act Compliance
const char* DEVICE_SECRET_KEY = "SAHAKAR_EVIDENCE_KEY_2026";

// ==============================================================================
// 1. GATEWAY RECEIVER MAC ADDRESS & NODE CONFIGURATION
// ==============================================================================
// Receiver ESP32 MAC Address:
uint8_t gatewayAddress[] = {0xD4, 0xE9, 0xF4, 0x78, 0xE2, 0x40};

// Set to "NODE_01" for Node 1 or "NODE_02" for Node 2
#define CURRENT_NODE_ID "NODE_02"

// ==============================================================================
// 2. PIN DEFINITIONS
// ==============================================================================
#define DHTPIN        4
#define DHTTYPE       DHT11

// Digital LDR module (3-pin: VCC, GND, DO)
#define LDR_DO_PIN    18   
#define SOIL_AO_PIN   34   // ADC1_CH6 (Input Only)
#define SOIL_DO_PIN   19
#define RAIN_AO_PIN   35   // ADC1_CH7 (Input Only)
#define RAIN_DO_PIN    5
#define STATUS_LED     2

// Calibration thresholds (12-bit ADC: 0 - 4095)
const int SOIL_AIR_DRY_VAL   = 3850;
const int SOIL_SUBMERGED_VAL = 1300;
const int RAIN_DRY_VAL       = 3850;
const int RAIN_WET_VAL       = 1100;

DHT dht(DHTPIN, DHTTYPE);

// ==============================================================================
// 3. CRYPTOGRAPHIC EVIDENCE STRUCT (Section 65B Compliant)
// ==============================================================================
typedef struct __attribute__((packed)) struct_telemetry {
  char     node_id[16];
  float    temperature_c;
  float    humidity_pct;
  float    soil_moisture_pct;
  float    rain_intensity_pct;
  bool     rain_detected;
  bool     light_bright;  // true = BRIGHT, false = DARK
  uint32_t packet_seq;
  char     hmac_digest[17]; // 16-char SHA-256 HMAC + null terminator
} struct_telemetry;

struct_telemetry payload;
esp_now_peer_info_t peerInfo;
uint32_t globalPacketSeq = 0;

// Hardware SHA-256 HMAC Calculation for Evidence Custody Chain
void computePayloadHMAC(const struct_telemetry &data, char *outputHex) {
  char rawBuf[96];
  snprintf(rawBuf, sizeof(rawBuf), "%s:%.1f:%.1f:%.1f:%.1f:%u", 
           data.node_id, data.temperature_c, data.humidity_pct, 
           data.soil_moisture_pct, data.rain_intensity_pct, data.packet_seq);

  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)DEVICE_SECRET_KEY, strlen(DEVICE_SECRET_KEY));
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)rawBuf, strlen(rawBuf));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  for (int i = 0; i < 8; i++) {
    sprintf(&outputHex[i * 2], "%02x", (unsigned int)hmacResult[i]);
  }
  outputHex[16] = '\0';
}

// Multisampling filter to stabilize ADC readings
int readSmoothADC(int pin, int samples = 15) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(100);
  }
  return (int)(sum / samples);
}

// Universal Callback for both ESP32 Core v2.x and v3.x
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status)
#else
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status)
#endif
{
  if (status == ESP_NOW_SEND_SUCCESS) {
    digitalWrite(STATUS_LED, HIGH);
    delay(40);
    digitalWrite(STATUS_LED, LOW);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  dht.begin();
  pinMode(LDR_DO_PIN, INPUT_PULLUP);
  pinMode(SOIL_DO_PIN, INPUT_PULLUP);
  pinMode(RAIN_DO_PIN, INPUT_PULLUP);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println(F("[ERROR] ESP-NOW Init Failed"));
    return;
  }

  esp_now_register_send_cb(OnDataSent);

  memset(&peerInfo, 0, sizeof(peerInfo));
  memcpy(peerInfo.peer_addr, gatewayAddress, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println(F("[ERROR] Failed to pair with Gateway"));
    return;
  }

  Serial.printf("[ONLINE] %s Transmitting via ESP-NOW (Digital LDR on GPIO 18)\n", CURRENT_NODE_ID);
}

void loop() {
  Serial.printf("\n================ [ SENSOR MONITOR (%s) ] ================\n", CURRENT_NODE_ID);

  // 1. READ DHT11 (Temperature & Humidity)
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) { 
    t = 0.0; 
    h = 0.0; 
  }
  Serial.printf("DHT11 Sensor  : Temp: %.1f°C | Humidity: %.1f%%\n", t, h);

  // 2. READ DIGITAL LDR SENSOR (DO pin on GPIO 18: LOW = Bright, HIGH = Dark)
  bool isBright = (digitalRead(LDR_DO_PIN) == LOW);
  Serial.printf("LDR Light     : Indicator -> %s\n", isBright ? "BRIGHT" : "DARK");

  // 3. READ SOIL MOISTURE SENSOR
  int soilRaw = readSmoothADC(SOIL_AO_PIN);
  float soilPct = (float)(SOIL_AIR_DRY_VAL - soilRaw) / (float)(SOIL_AIR_DRY_VAL - SOIL_SUBMERGED_VAL) * 100.0;
  soilPct = constrain(soilPct, 0.0, 100.0);
  Serial.printf("Soil Moisture : Indicator -> %s (%.1f%% | Raw ADC: %d)\n", 
                (soilPct > 20.0) ? "WET" : "DRY", soilPct, soilRaw);

  // 4. READ RAINDROP SENSOR
  int rainRaw = readSmoothADC(RAIN_AO_PIN);
  float rainPct = (float)(RAIN_DRY_VAL - rainRaw) / (float)(RAIN_DRY_VAL - RAIN_WET_VAL) * 100.0;
  if (rainRaw >= RAIN_DRY_VAL) rainPct = 0.0;
  rainPct = constrain(rainPct, 0.0, 100.0);
  bool rainDetected = (rainPct > 15.0);
  Serial.printf("Rain Sensor   : Indicator -> %s (%.1f%% | Raw ADC: %d)\n", 
                rainDetected ? "WET / RAINING" : "DRY", rainPct, rainRaw);

  // 5. POPULATE TELEMETRY PACKET WITH HARDWARE SHA-256 HMAC
  strncpy(payload.node_id, CURRENT_NODE_ID, sizeof(payload.node_id) - 1);
  payload.node_id[sizeof(payload.node_id) - 1] = '\0';
  payload.temperature_c = t;
  payload.humidity_pct = h;
  payload.soil_moisture_pct = soilPct;
  payload.rain_intensity_pct = rainPct;
  payload.rain_detected = rainDetected;
  payload.light_bright = isBright;
  payload.packet_seq = ++globalPacketSeq;

  // Cryptographically seal telemetry packet
  computePayloadHMAC(payload, payload.hmac_digest);

  // 6. TRANSMIT TO GATEWAY (Section 65B Certified Packet)
  esp_now_send(gatewayAddress, (uint8_t *)&payload, sizeof(payload));

  Serial.println(F("--------------------------------------------------"));
  Serial.printf("[SEC 65B EVIDENCE TX] %s | Seq: %u | SHA-256 HMAC: %s\n", 
                payload.node_id, payload.packet_seq, payload.hmac_digest);

  // Offset delay slightly from Node 1 (3500ms vs 3000ms) with random jitter to prevent collisions
  delay(3500 + random(0, 800));
}
