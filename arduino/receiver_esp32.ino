/*
 * ==================== RECEIVER ESP32 CODE ====================
 * This ESP32 receives data from the SENDER ESP32 and relays it
 * to the backend server via WiFi or local network.
 * ============================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <time.h>

// ==================== CONFIGURATION ====================

// WiFi Configuration
const char* SSID = "YOUR_SSID";
const char* PASSWORD = "YOUR_PASSWORD";

// Server Configuration
const int WEBSERVER_PORT = 8080;
const char* BACKEND_SERVER_URL = "http://192.168.x.x:3000/api/sensor-data";

// ==================== VARIABLES ====================

WebServer server(WEBSERVER_PORT);

struct SensorData {
  String device_id;
  unsigned long timestamp;
  float temperature;
  float humidity;
  float soil_moisture;
  float rainfall;
  int light_intensity;
  float soil_ph;
  float battery_voltage;
  int wifi_signal;
};

SensorData lastReceivedData;
unsigned long lastDataTime = 0;
int dataCount = 0;

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n");
  Serial.println("===========================================");
  Serial.println("  SMART FARMING - RECEIVER ESP32 V1.0");
  Serial.println("===========================================");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup web server endpoints
  setupWebServer();
  
  Serial.println("\n[SETUP] Receiver ready to accept data!");
  Serial.println("===========================================\n");
}

// ==================== MAIN LOOP ====================

void loop() {
  server.handleClient();
  
  // Print status every 30 seconds
  if (millis() - lastDataTime > 30000) {
    printStatus();
    lastDataTime = millis();
  }
  
  delay(100);
}

// ==================== WIFI FUNCTIONS ====================

void connectToWiFi() {
  Serial.print("[WiFi] Connecting to: " + String(SSID));
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ✓ Connected!");
    Serial.println("[WiFi] IP Address: " + WiFi.localIP().toString());
    Serial.println("[WiFi] Signal Strength: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println(" ✗ Failed to connect");
  }
}

// ==================== WEB SERVER SETUP ====================

void setupWebServer() {
  Serial.println("[SERVER] Setting up web server endpoints...");
  
  // Endpoint to receive sensor data
  server.on("/api/sensor-data", HTTP_POST, handleSensorData);
  
  // Endpoint to get current data
  server.on("/api/current", HTTP_GET, handleGetCurrent);
  
  // Endpoint to get data history
  server.on("/api/history", HTTP_GET, handleGetHistory);
  
  // Endpoint for health check
  server.on("/api/health", HTTP_GET, handleHealth);
  
  // Endpoint for device info
  server.on("/api/info", HTTP_GET, handleInfo);
  
  // Start server
  server.begin();
  Serial.println("[SERVER] Web server started on port " + String(WEBSERVER_PORT));
  Serial.println("[SERVER] URL: http://" + WiFi.localIP().toString() + ":" + String(WEBSERVER_PORT));
}

// ==================== REQUEST HANDLERS ====================

void handleSensorData() {
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"Method not allowed\"}");
    return;
  }
  
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No payload received\"}");
    return;
  }
  
  String payload = server.arg("plain");
  Serial.println("\n[RECEIVER] Data received! Size: " + String(payload.length()) + " bytes");
  Serial.println("[RECEIVER] Payload: " + payload);
  
  // Parse JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload);
  
  if (error) {
    Serial.println("[RECEIVER] ✗ JSON parsing error: " + String(error.c_str()));
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  
  // Store data
  lastReceivedData.device_id = doc["device_id"].as<String>();
  lastReceivedData.timestamp = doc["timestamp"];
  lastReceivedData.temperature = doc["temperature"];
  lastReceivedData.humidity = doc["humidity"];
  lastReceivedData.soil_moisture = doc["soil_moisture"];
  lastReceivedData.rainfall = doc["rainfall"];
  lastReceivedData.light_intensity = doc["light_intensity"];
  lastReceivedData.soil_ph = doc["soil_ph"];
  lastReceivedData.battery_voltage = doc["battery_voltage"];
  lastReceivedData.wifi_signal = doc["wifi_signal"];
  
  dataCount++;
  lastDataTime = millis();
  
  // Print received data
  printReceivedData();
  
  // Forward to backend server (optional)
  forwardToBackend(payload);
  
  // Send response
  StaticJsonDocument<128> response;
  response["status"] = "success";
  response["message"] = "Data received and stored";
  response["timestamp"] = millis();
  response["data_count"] = dataCount;
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.send(200, "application/json", responseStr);
}

void handleGetCurrent() {
  Serial.println("\n[GET] Current data requested");
  
  StaticJsonDocument<512> doc;
  doc["device_id"] = lastReceivedData.device_id;
  doc["timestamp"] = lastReceivedData.timestamp;
  doc["temperature"] = lastReceivedData.temperature;
  doc["humidity"] = lastReceivedData.humidity;
  doc["soil_moisture"] = lastReceivedData.soil_moisture;
  doc["rainfall"] = lastReceivedData.rainfall;
  doc["light_intensity"] = lastReceivedData.light_intensity;
  doc["soil_ph"] = lastReceivedData.soil_ph;
  doc["battery_voltage"] = lastReceivedData.battery_voltage;
  doc["wifi_signal"] = lastReceivedData.wifi_signal;
  doc["receiver_ip"] = WiFi.localIP().toString();
  doc["receiver_signal"] = WiFi.RSSI();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleGetHistory() {
  Serial.println("\n[GET] History requested");
  
  // In a real application, this would return historical data from storage
  // For now, just return current data
  
  StaticJsonDocument<512> doc;
  doc["count"] = dataCount;
  doc["latest"] = lastReceivedData.device_id;
  doc["uptime_ms"] = millis();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleHealth() {
  Serial.println("[GET] Health check");
  
  StaticJsonDocument<128> doc;
  doc["status"] = "ok";
  doc["uptime_ms"] = millis();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
  doc["ip"] = WiFi.localIP().toString();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleInfo() {
  Serial.println("[GET] Info requested");
  
  StaticJsonDocument<256> doc;
  doc["device_id"] = WiFi.macAddress();
  doc["device_type"] = "Receiver ESP32";
  doc["firmware_version"] = "1.0.0";
  doc["ssid"] = String(SSID);
  doc["ip"] = WiFi.localIP().toString();
  doc["mac"] = WiFi.macAddress();
  doc["signal_strength"] = WiFi.RSSI();
  doc["uptime_minutes"] = millis() / 60000;
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

// ==================== DATA FORWARDING ====================

void forwardToBackend(String payload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[FORWARD] ✗ WiFi not connected");
    return;
  }
  
  Serial.println("[FORWARD] Forwarding data to backend...");
  // Implementation would go here to send data to Node.js backend
}

// ==================== UTILITY FUNCTIONS ====================

void printReceivedData() {
  Serial.println("\n--- RECEIVED DATA ---");
  Serial.println("Device ID    : " + lastReceivedData.device_id);
  Serial.println("Temperature  : " + String(lastReceivedData.temperature) + "°C");
  Serial.println("Humidity     : " + String(lastReceivedData.humidity) + "%");
  Serial.println("Soil Moisture: " + String(lastReceivedData.soil_moisture) + "%");
  Serial.println("Rainfall     : " + String(lastReceivedData.rainfall) + "%");
  Serial.println("Light        : " + String(lastReceivedData.light_intensity) + "%");
  Serial.println("Soil pH      : " + String(lastReceivedData.soil_ph, 2));
  Serial.println("Battery      : " + String(lastReceivedData.battery_voltage, 2) + "V");
  Serial.println("WiFi Signal  : " + String(lastReceivedData.wifi_signal) + " dBm");
  Serial.println("---------------------");
}

void printStatus() {
  Serial.println("\n[STATUS] Receiver Status Update");
  Serial.println("├─ Uptime: " + String(millis() / 1000) + " seconds");
  Serial.println("├─ Data Received: " + String(dataCount) + " times");
  Serial.println("├─ WiFi: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("├─ Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("└─ Last Data: " + String((millis() - lastDataTime) / 1000) + "s ago");
}

// ==================== END OF CODE ====================
