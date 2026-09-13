# Arduino Sensor Setup & Calibration Guide

## 📦 Arduino IDE Setup

### 1. Install Arduino IDE

**Download**: https://www.arduino.cc/en/software

Minimum Version: 2.0.0

### 2. Install ESP32 Board Support

**Method 1: Using Board Manager (Recommended)**
```
1. Open Arduino IDE
2. Go to: File → Preferences
3. In "Additional Boards Manager URLs" field, add:
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
4. Click OK
5. Go to: Tools → Board → Boards Manager
6. Search for "esp32"
7. Install "esp32 by Espressif Systems" (v2.0.0+)
8. Wait for installation to complete
```

**Method 2: Using Git Clone**
```bash
cd ~/Arduino/hardware
git clone https://github.com/espressif/arduino-esp32.git esp32
cd esp32/tools
python get.py
```

### 3. Install Required Libraries

Go to: **Sketch → Include Library → Manage Libraries**

Search and install these libraries:

#### Essential Libraries
| Library | Author | Version | Purpose |
|---------|--------|---------|---------|
| DHT sensor library | Adafruit | 1.4.4+ | Temperature & Humidity |
| ArduinoJson | Benoit Blanchon | 6.21.0+ | JSON data handling |
| WiFi | Espressif | Built-in | WiFi connectivity |
| HTTPClient | Espressif | Built-in | HTTP requests |

#### Optional Libraries
| Library | Author | Purpose |
|---------|--------|---------|
| ESP8266 and ESP32 OLED driver | Thiago Alves | OLED Display (for future) |
| PubSubClient | Nick O'Leary | MQTT Support |

### 4. ESP32 Board Selection

In Arduino IDE:
```
Tools → Board → ESP32 Arduino → Select your board model
```

Common board selections:
- **ESP32 Dev Module** (Most common)
- **ESP32-WROOM-32**
- **ESP32-DevKitC**

### 5. Serial Port Selection

```
Tools → Port → Select COMx (Windows) or /dev/ttyUSBx (Linux) or /dev/cu.usbserial-xxx (Mac)
```

If port doesn't appear:
- Install CH340 drivers (for some boards)
- Try USB 2.0 ports instead of USB 3.0
- Use different USB cable

### 6. Upload Settings

**Recommended Settings:**
```
Board:           ESP32 Dev Module
Upload Speed:    115200 (or 921600 if stable)
CPU Frequency:   80 MHz
Flash Frequency: 80 MHz
Flash Mode:      DIO
Flash Size:      4MB (or 16MB if available)
Partition Scheme: Default 4MB with spiffs
Core Debug Level: None
PSRAM:           Disabled
```

## 🔧 DHT11 Library Usage

### Install DHT Library
```
Search "DHT sensor library" by Adafruit
Click Install (includes dependency: Adafruit Unified Sensor)
```

### Basic DHT11 Code
```cpp
#include <DHT.h>

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  delay(2000);  // DHT11 needs 2 second delay between readings
  
  float h = dht.readHumidity();
  float t = dht.readTemperature();  // Celsius
  float f = dht.readTemperature(true);  // Fahrenheit
  
  if (isnan(h) || isnan(t) || isnan(f)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  
  Serial.print("Humidity: ");
  Serial.print(h);
  Serial.print(" %\t");
  Serial.print("Temperature: ");
  Serial.print(t);
  Serial.println(" C");
}
```

### Important DHT11 Notes
- ✓ Reading interval must be **at least 2 seconds**
- ✓ Requires **4.7K pull-up resistor** on data line
- ✓ Power supply must be **stable 3.3V or 5V**
- ✓ Sensor has **±5% RH accuracy** and **±2°C accuracy**
- ✓ Range: 0-50°C, 20-95% RH

## 📊 Analog Sensor Reading

### ADC (Analog-to-Digital Converter)

```cpp
// Read analog value
int rawValue = analogRead(GPIO34);  // 0-4095

// Convert to voltage (0-3.3V range)
float voltage = (rawValue / 4095.0) * 3.3;

// Map to sensor-specific range
int percentage = map(rawValue, minValue, maxValue, 0, 100);
```

### Soil Moisture Sensor Calibration

**Capacitive Soil Moisture Sensor** (Recommended)
```cpp
// Step 1: Find min and max ADC values
// - Dry soil:  ~3500 (low capacitance)
// - Wet soil:  ~1500 (high capacitance)

const int MOISTURE_DRY = 3500;
const int MOISTURE_WET = 1500;

void readMoisture() {
  int rawValue = analogRead(GPIO34);
  float percentage = map(rawValue, MOISTURE_WET, MOISTURE_DRY, 100, 0);
  percentage = constrain(percentage, 0, 100);
  
  Serial.print("Moisture: ");
  Serial.print(percentage);
  Serial.println("%");
}
```

**Calibration Procedure:**
```
1. Remove sensor from any soil
2. Read ADC value in air (should be ~3500)
3. Insert sensor in completely DRY soil
4. Record value (this is MOISTURE_DRY)
5. Pour water on soil until saturated
6. Record value (this is MOISTURE_WET)
7. Update constants and re-upload
```

### Raindrop Sensor Calibration

```cpp
const int RAIN_THRESHOLD = 500;  // Adjust based on your sensor

void readRain() {
  int rawValue = analogRead(GPIO35);
  
  if (rawValue > RAIN_THRESHOLD) {
    Serial.println("Rain detected!");
  } else {
    Serial.println("No rain");
  }
  
  // Print actual value for debugging
  Serial.print("Rain ADC: ");
  Serial.println(rawValue);
}

// Calibration:
// 1. In dry conditions, note ADC value (e.g., 300)
// 2. When rain/water detected, note ADC value (e.g., 800)
// 3. Set RAIN_THRESHOLD to middle point: (300+800)/2 = 550
```

### LDR (Light Sensor) Calibration

```cpp
void readLight() {
  int rawValue = analogRead(GPIO32);
  
  // Method 1: Direct percentage mapping
  int percentage = map(rawValue, 0, 4095, 0, 100);
  
  // Method 2: Logarithmic (more accurate for human perception)
  float lux = 500 * log10(rawValue) - 2000;  // Rough approximation
  
  Serial.print("Light: ");
  Serial.print(percentage);
  Serial.println("%");
}

// Calibration:
// Test in different lighting conditions:
// - Dark room:      ~100-300
// - Office light:   ~1000-2000
// - Window (cloudy): ~2000-3000
// - Sunlight:       ~3500-4095
```

### pH Sensor Calibration

```cpp
void readPH() {
  int rawValue = analogRead(GPIO33);
  float voltage = (rawValue / 4095.0) * 3.3;
  
  // Linear calibration formula
  // Adjust these constants based on your sensor calibration
  float pH = voltage * 4.24;  // Default formula
  
  Serial.print("pH: ");
  Serial.println(pH, 2);
}

// Calibration with buffer solutions:
// 1. Get pH buffer solutions: 4.0, 7.0, 10.0
// 2. Measure voltage at each pH level
// 3. Plot points and calculate linear formula
// Example results:
//   pH 4.0  → 0.75V
//   pH 7.0  → 1.50V
//   pH 10.0 → 2.25V
// Formula: pH = 1.33 * voltage + 0.02
```

## 🧪 Serial Monitor Testing

### Open Serial Monitor
```
Arduino IDE → Tools → Serial Monitor
Or: Ctrl+Shift+M
Set Baud Rate: 115200
```

### Test Individual Sensors

**Test DHT11:**
```cpp
void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  delay(2000);
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  Serial.print("Temp: ");
  Serial.print(temp);
  Serial.print(" C, Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");
}
```

**Test Analog Sensors:**
```cpp
void loop() {
  Serial.print("Moisture: ");
  Serial.print(analogRead(GPIO34));
  Serial.print(" | Rain: ");
  Serial.print(analogRead(GPIO35));
  Serial.print(" | Light: ");
  Serial.print(analogRead(GPIO32));
  Serial.print(" | pH: ");
  Serial.println(analogRead(GPIO33));
  delay(1000);
}
```

## 🌐 WiFi Testing

```cpp
void setup() {
  Serial.begin(115200);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin("YOUR_SSID", "YOUR_PASSWORD");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.println(WiFi.RSSI());
  }
}
```

## 📈 Data Logging

### Save Data to SPIFFS (File System)

```cpp
#include <SPIFFS.h>

void setup() {
  if(!SPIFFS.begin(true)){
    Serial.println("SPIFFS Mount Failed");
    return;
  }
}

void logData() {
  File file = SPIFFS.open("/sensor_log.txt", "a");
  if (!file) {
    Serial.println("Failed to open file");
    return;
  }
  
  file.print(millis());
  file.print(",");
  file.print(temperature);
  file.print(",");
  file.println(humidity);
  
  file.close();
}
```

## 🚀 Complete Test Program

```cpp
#include <WiFi.h>
#include <DHT.h>
#include <ArduinoJson.h>

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

const char* SSID = "YOUR_SSID";
const char* PASSWORD = "YOUR_PASSWORD";

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\nStarting Smart Farming Sensor Test");
  Serial.println("===================================\n");
  
  // Initialize DHT
  dht.begin();
  Serial.println("[DHT] DHT11 initialized");
  
  // Connect WiFi
  Serial.print("[WiFi] Connecting to: " + String(SSID));
  WiFi.begin(SSID, PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" Connected!");
    Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
  } else {
    Serial.println(" Failed!");
  }
}

void loop() {
  Serial.println("\n--- Sensor Reading ---");
  
  // DHT11
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (!isnan(temp) && !isnan(humidity)) {
    Serial.print("Temperature: ");
    Serial.print(temp);
    Serial.println("°C");
    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println("%");
  }
  
  // Analog Sensors
  Serial.print("Moisture: ");
  Serial.println(analogRead(34));
  
  Serial.print("Rain: ");
  Serial.println(analogRead(35));
  
  Serial.print("Light: ");
  Serial.println(analogRead(32));
  
  Serial.print("pH: ");
  Serial.println(analogRead(33));
  
  delay(5000);
}
```

## ⚠️ Common Issues & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| "Board esp32 not found" | Library not installed | Install ESP32 board via Board Manager |
| Compilation errors | Missing libraries | Install required libraries from Manage Libraries |
| Upload fails | Wrong port selected | Select correct COM port in Tools → Port |
| DHT returns NaN | Sensor disconnected | Check GPIO4 connection |
| ADC reads 0 always | Wrong pin selected | Verify ADC pin (GPIO 34, 35, 32, 33) |
| WiFi can't connect | Wrong credentials | Check SSID and password spelling |
| Slow WiFi upload | Slow upload speed | Increase upload speed in Tools |

## 📚 Additional Resources

- **Official Arduino-ESP32**: https://github.com/espressif/arduino-esp32
- **ESP32 Pin Reference**: https://randomnerdtutorials.com/esp32-pinout-reference/
- **Arduino Documentation**: https://www.arduino.cc/reference/
- **DHT Sensor Tutorial**: https://lastminuteengineers.com/dht11-temperature-humidity-sensor-arduino-tutorial/

---

**Last Updated**: 2024
**Version**: 1.0.0
