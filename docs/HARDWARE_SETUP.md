# Hardware Setup Guide for Smart Farming Project

## 🔌 Complete Hardware Wiring Diagram

### ESP32 Pin Configuration

```
┌─────────────────────────────────────────────────────┐
│           ESP32 DevKit C - Pin Layout               │
├─────────────────────────────────────────────────────┤
│ 3.3V ──────┬─→ DHT11 Pin 1 (VCC)                  │
│            ├─→ Sensor VCC                          │
│            └─→ Pull-up Resistors (10K)             │
│                                                     │
│ GPIO4 ─────→ DHT11 Pin 2 (DATA)                    │
│            (Data Line with 4.7K pull-up)           │
│                                                     │
│ GPIO34 ────→ Moisture Sensor (A0)                  │
│            (ADC Pin - Analog)                      │
│                                                     │
│ GPIO35 ────→ Raindrop Sensor (A0)                  │
│            (ADC Pin - Analog)                      │
│                                                     │
│ GPIO32 ────→ Light Sensor/LDR (A0)                 │
│            (ADC Pin - 10K pull-down)               │
│                                                     │
│ GPIO33 ────→ pH Sensor Module (A0)                 │
│            (ADC Pin - Analog)                      │
│                                                     │
│ GPIO36 ────→ Battery Monitor (A0)                  │
│            (ADC Pin - Voltage divider)             │
│                                                     │
│ GND ───────┬─→ DHT11 Pin 4 (GND)                   │
│            ├─→ Sensor GND                          │
│            └─→ All sensors common ground            │
└─────────────────────────────────────────────────────┘
```

## 📦 Complete Component List

### 1. Microcontroller
| Part | Quantity | Notes |
|------|----------|-------|
| ESP32 DevKit C | 2 (Sender + Receiver) | Buy from AliExpress, Amazon |
| USB Cable (USB-C or Micro USB) | 2 | For programming |
| Power Supply 5V 2A | 2 | For both ESP32 boards |

### 2. Temperature & Humidity
| Part | Quantity | Cost | Source |
|------|----------|------|--------|
| DHT11 Sensor Module | 1 | ₹50-80 | AliExpress, Amazon |
| 4.7K Resistor | 1 | ₹2 | Local electronics store |

### 3. Soil Moisture
| Part | Quantity | Cost | Notes |
|------|----------|------|-------|
| Capacitive Soil Moisture Sensor | 1 | ₹150-250 | Better than resistive |
| (or Resistive Moisture Sensor) | 1 | ₹50-100 | Alternative option |

### 4. Raindrop Detection
| Part | Quantity | Cost | Source |
|------|----------|------|--------|
| Raindrop Detection Sensor | 1 | ₹100-150 | YL-83 or similar |

### 5. Light Intensity
| Part | Quantity | Cost | Notes |
|------|----------|------|-------|
| LDR (Light Dependent Resistor) | 1 | ₹10 | GL55xx series |
| 10K Resistor (for voltage divider) | 1 | ₹2 | Pull-down resistor |

### 6. Soil pH
| Part | Quantity | Cost | Notes |
|------|----------|------|-------|
| pH Sensor Module | 1 | ₹800-1200 | Analog output type |
| or LM393 Comparator | 1 | ₹30 | Basic alternative |

### 7. Power Management
| Part | Quantity | Cost | Notes |
|------|----------|------|-------|
| Battery (5V Power Bank) | 1 | ₹500-1000 | Optional for remote operation |
| Voltage Regulator (AMS1117) | 2 | ₹20 | 3.3V output |
| Electrolytic Capacitor 100µF | 2 | ₹5 | For power stabilization |

### 8. Miscellaneous
| Part | Quantity | Cost | Notes |
|------|----------|------|-------|
| Breadboard (830 holes) | 1 | ₹80-150 | For prototyping |
| Jumper Wires (Pack of 40) | 1 | ₹50 | Male-Male + Male-Female |
| Resistor Pack (assorted) | 1 | ₹50 | Various values for calibration |

**Total Estimated Cost**: ₹3000-5000 (approx $40-65 USD)

## 🔧 Step-by-Step Assembly

### Step 1: DHT11 Sensor Connection

```
DHT11 Pinout (3 or 4 pin module):
┌─────────────────┐
│ 1(VCC) 2(DATA) │  (common 3-pin layout)
│ 3(GND)          │
└─────────────────┘

Connections:
• DHT11 Pin 1 (VCC)  → ESP32 3.3V
• DHT11 Pin 2 (DATA) → ESP32 GPIO4 (with 4.7K pull-up to 3.3V)
• DHT11 Pin 3 (GND)  → ESP32 GND

4.7K Pull-up Resistor:
  3.3V
   |
   [4.7K Ω]
   |
   +────→ GPIO4 ────→ DHT11 DATA
   |
  DHT11 GND
```

### Step 2: Moisture Sensor Connection

```
Capacitive Soil Moisture Sensor Pinout:
┌─────────────────┐
│ GND | VCC | OUT │
└─────────────────┘

Connections:
• GND   → ESP32 GND
• VCC   → ESP32 3.3V
• OUT   → ESP32 GPIO34 (ADC)

Note: Use 3.3V input only! Do NOT connect to 5V
```

### Step 3: Raindrop Sensor Connection

```
Raindrop Sensor Pinout:
┌─────────────────┐
│ GND | VCC | OUT │
└─────────────────┘

Connections:
• GND   → ESP32 GND
• VCC   → ESP32 3.3V
• OUT   → ESP32 GPIO35 (ADC)
```

### Step 4: LDR (Light Sensor) Connection

```
LDR Circuit (Voltage Divider):

    3.3V
     |
    LDR (GL55xx)
     |
     +──────────→ GPIO32 (ADC)
     |
    [10K Ω] (Pull-down Resistor)
     |
    GND

Alternative with Resistor:
    VCC
     |
   [10K Ω] (Current limiting)
     |
    LDR
     |
     +──────────→ GPIO32
     |
    GND
```

### Step 5: pH Sensor Connection

```
pH Sensor Module Pinout:
┌─────────────────┐
│GND | VCC | OUT  │
└─────────────────┘

Connections:
• GND   → ESP32 GND
• VCC   → ESP32 5V (if module supports it) or 3.3V
• OUT   → ESP32 GPIO33 (ADC)

Note: Some pH sensors need 5V supply but output 0-3.3V
```

### Step 6: Battery Monitoring

```
Battery Voltage Measurement (Voltage Divider):

Battery+ (5V)
   |
  [10K Ω]  R1
   |
   +────→ GPIO36 (ADC) with 100µF capacitor to GND
   |
  [10K Ω]  R2
   |
Battery-/GND

This divides 5V to 2.5V at ADC pin (within safe 3.3V range)
Capacitor filters noise
```

## 🔌 Complete Breadboard Layout

```
SENDER ESP32 Setup (Front View):

     ┌─────────────────────────────────────────────┐
     │  USB-C                  GND  3.3V  GND  5V │
     │   ↓                       ↓    ↓    ↓    ↓  │
  ┌─────────────────────────────────────────────────┐
  │[ESP32]                                    [GND]──→ To sensors & breadboard
  │ GPIO4        GPIO33    GPIO36   GPIO35   GPIO34  │
  │  ↓            ↓         ↓        ↓        ↓      │
  │  │            │         │        │        │      │
  │  └──DHT11─────pH───Battery──Rain───Moisture    │
  │            Sensor      Monitor   Sensor   Sensor│
  └─────────────────────────────────────────────────┘
     3.3V → All Sensor VCC
     GND  → All Sensor GND
```

## 🔍 Sensor Specifications

### DHT11
- Temperature Range: 0-50°C
- Humidity Range: 20-95% RH
- Accuracy: ±2°C, ±5% RH
- Update Rate: 1 Hz (every 1 second)
- Pins: 3 or 4-pin module

### Moisture Sensor (Capacitive)
- Output: 0-3.3V (Analog)
- ADC Range: 0-4095
- Response Time: < 500ms
- Size: 1cm x 1.5cm

### Raindrop Sensor
- Sensitivity: Adjustable
- Output: Analog
- Trigger Threshold: ~500 ADC value
- Detection Time: ~100ms

### LDR (GL55xx)
- Light Sensitivity: 400-600nm
- Resistance Range: 10Ω-1MΩ
- Max Power: 100mW

### pH Sensor
- Measurement Range: pH 0-14
- Accuracy: ±0.5 pH
- Response Time: < 2 minutes
- Operating Temp: 0-60°C

## ⚡ Power Distribution

### Power Requirements
```
Component               | Voltage | Current | Notes
------------------------|---------|---------|------------------
ESP32 Board            | 5V      | 80mA    | Can also use 3.3V
DHT11                  | 3.3V    | 5mA     | Max 2.5mA
Moisture Sensor        | 3.3V    | 15mA    | Depends on type
Raindrop Sensor        | 3.3V    | 10mA    |
LDR + Resistor         | 3.3V    | 2mA     | Passive (no power)
pH Sensor              | 5V/3.3V | 20mA    | Check specifications
Total                  |         | ~130mA  | Add 20% margin
```

### Power Supply Recommendation
- **Minimum**: 5V, 500mA USB power supply
- **Recommended**: 5V, 2A power supply
- **Battery Option**: 5000mAh power bank (for field testing)

## 🧪 Testing & Verification

### Initial Power-On Test
```
1. Connect all sensors before powering ESP32
2. Apply 5V power slowly
3. Check LED indicators (if any)
4. Open Serial Monitor (115200 baud)
5. Verify initialization messages

Expected Serial Output:
[INIT] Initializing sensors...
[INIT] DHT11 sensor initialized on GPIO 4
[INIT] Moisture sensor initialized on GPIO 34
...
[SETUP] Initialization complete!
```

### Individual Sensor Test
```
1. Read Serial Monitor output
2. Verify each sensor reading
3. Physically change sensor condition (blow on DHT11, wet soil, etc.)
4. Check if values change appropriately
5. Note raw ADC values for calibration
```

### WiFi Connection Test
```
1. Update SSID and Password in Arduino code
2. Upload code to ESP32
3. Check Serial Monitor for WiFi connection
4. Verify IP address assignment
5. Test ping from computer: ping <esp32_ip>
```

## 🔧 Calibration Procedures

### Moisture Sensor Calibration
```
Arduino Code Section:
const int MOISTURE_DRY = 800;   // Change this
const int MOISTURE_WET = 400;   // Change this

Procedure:
1. Remove sensor from soil
2. Read dry value from Serial Monitor (note it)
3. Place sensor in water
4. Read wet value from Serial Monitor (note it)
5. Update constants in code
6. Re-upload to ESP32
```

### pH Sensor Calibration
```
Typical Calibration Points:
• pH 4.0 Buffer Solution → Note voltage output
• pH 7.0 Buffer Solution → Note voltage output
• pH 10.0 Buffer Solution → Note voltage output

Formula: pH = (voltage - 2.5V) / 0.59 mV
Adjust formula based on your measurements
```

### Light Sensor Calibration
```
Procedure:
1. In darkness → Note ADC value (should be ~0-200)
2. Indirect sunlight → Note ADC value (~2000-3000)
3. Direct sunlight → Note ADC value (~4000-4095)
4. Map() function adjusts these ranges to 0-100%
```

## 📊 Expected Sensor Readings

| Condition | Temperature | Humidity | Moisture | Rainfall | Light |
|-----------|-------------|----------|----------|----------|-------|
| Morning   | 15-20°C     | 60-75%   | 45-60%   | 10-30%   | 20%   |
| Midday    | 30-35°C     | 40-55%   | 35-50%   | 0-5%     | 90%   |
| After Rain| 20-25°C     | 85-95%   | 75-90%   | 90-100%  | 50%   |
| Evening   | 18-22°C     | 70-80%   | 55-70%   | 20-40%   | 10%   |

## ⚠️ Troubleshooting Hardware

### No Power
```
Check:
• USB cable is properly connected
• Power supply is working (test with multimeter)
• ESP32 board is not damaged
• No short circuits on breadboard
```

### DHT11 Reading NaN
```
Check:
• GPIO4 connection is secure
• 4.7K pull-up resistor is installed
• DHT11 has 2-second delay between reads
• Power supply voltage is 3.3V
```

### Analog Values Always 0 or 4095
```
Check:
• Sensor is properly connected to 3.3V and GND
• Sensor output is connected to correct ADC pin
• ADC pin is not damaged
• Voltage is between 0-3.3V (use multimeter)
```

### WiFi Connection Fails
```
Check:
• SSID and Password are correct (no typos)
• WiFi router supports 2.4GHz (ESP32 limitation)
• Router is within range
• No WiFi filters blocking ESP32 MAC address
```

## 📚 Additional Resources

- [ESP32 Pinout](https://randomnerdtutorials.com/esp32-pinout-reference-which-gpio-pins-and-spi-i2c-uart-are-available-on-the-esp32/)
- [DHT11 Sensor Guide](https://lastminuteengineers.com/dht11-temperature-humidity-sensor-arduino-tutorial/)
- [ADC Calibration](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/adc.html)
- [Soil Sensors Overview](https://www.seeedstudio.com/blog/2019/11/19/guide-to-soil-sensors/)

---

**Last Updated**: 2024
**Version**: 1.0.0
