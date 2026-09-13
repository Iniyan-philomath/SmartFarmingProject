# API Documentation

## 🌐 Smart Farming API Reference

**Base URL**: `http://localhost:3000/api`  
**API Version**: v1.0  
**Content-Type**: `application/json`

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Sensor Data Endpoints](#sensor-data-endpoints)
3. [Farmer Management](#farmer-management)
4. [AI Analysis](#ai-analysis)
5. [Notifications](#notifications)
6. [Error Handling](#error-handling)

---

## 🔐 Authentication

Currently, API is open for local development. Production deployments should implement:

```javascript
// Future: Bearer Token Authentication
Authorization: Bearer <your_token_here>
```

---

## 📡 Sensor Data Endpoints

### POST /sensor-data
**Description**: Submit sensor readings from ESP32  
**Content-Type**: `application/json`

**Request Body:**
```json
{
  "device_id": "ESP32_SENDER_AA:BB:CC:DD:EE:FF",
  "timestamp": 123456789,
  "temperature": 28.5,
  "humidity": 65.2,
  "soil_moisture": 55.0,
  "rainfall": 0.0,
  "light_intensity": 75,
  "soil_ph": 7.2,
  "battery_voltage": 4.8,
  "wifi_signal": -55
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Data received",
  "timestamp": 123456789,
  "data_id": "SEN_12345"
}
```

**Status Codes:**
- `200`: Data received successfully
- `400`: Invalid payload
- `500`: Server error

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP32_SENDER_001",
    "temperature": 28.5,
    "humidity": 65.2
  }'
```

---

### GET /sensor-data/:farmerId
**Description**: Get sensor data history for a farm  
**Parameters**:
- `farmerId` (path): Farmer ID
- `limit` (query): Number of records (default: 100)
- `offset` (query): Pagination offset (default: 0)
- `since` (query): Timestamp in milliseconds

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "SEN_12345",
      "device_id": "ESP32_SENDER_001",
      "timestamp": 123456789,
      "temperature": 28.5,
      "humidity": 65.2,
      "soil_moisture": 55.0,
      "rainfall": 0.0,
      "light_intensity": 75,
      "soil_ph": 7.2,
      "battery_voltage": 4.8
    }
  ],
  "total": 500,
  "limit": 100,
  "offset": 0
}
```

**Example:**
```bash
curl "http://localhost:3000/api/sensor-data/F001?limit=50&offset=100"
```

---

### GET /sensor-data/:farmerId/latest
**Description**: Get latest sensor reading  
**Parameters**:
- `farmerId` (path): Farmer ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "SEN_12345",
    "device_id": "ESP32_SENDER_001",
    "timestamp": 123456789,
    "temperature": 28.5,
    "humidity": 65.2,
    "soil_moisture": 55.0,
    "rainfall": 0.0,
    "light_intensity": 75,
    "soil_ph": 7.2,
    "battery_voltage": 4.8,
    "age_seconds": 120
  }
}
```

---

### GET /sensor-data/stats/:farmerId
**Description**: Get sensor statistics  
**Parameters**:
- `farmerId` (path): Farmer ID
- `days` (query): Number of days to analyze (default: 7)

**Response:**
```json
{
  "status": "success",
  "period_days": 7,
  "temperature": {
    "min": 18.2,
    "max": 32.1,
    "avg": 25.3,
    "current": 28.5
  },
  "humidity": {
    "min": 35.0,
    "max": 85.5,
    "avg": 62.3,
    "current": 65.2
  },
  "soil_moisture": {
    "min": 20.0,
    "max": 80.0,
    "avg": 55.0,
    "current": 55.0
  }
}
```

---

## 👨‍🌾 Farmer Management

### POST /farmer/register
**Description**: Register a new farmer  
**Content-Type**: `application/json`

**Request Body:**
```json
{
  "farmer_name": "Ravi Kumar",
  "phone": "9876543210",
  "village": "Nandurbar",
  "state": "Maharashtra",
  "area_acres": 2.5,
  "crops": ["Tomato", "Chilli"],
  "language": "en"
}
```

**Response:**
```json
{
  "status": "success",
  "farmer_id": "F001",
  "message": "Farmer registered successfully",
  "data": {
    "farmer_id": "F001",
    "farmer_name": "Ravi Kumar",
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

---

### GET /farmer/:farmerId
**Description**: Get farmer details  
**Parameters**:
- `farmerId` (path): Farmer ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "farmer_id": "F001",
    "farmer_name": "Ravi Kumar",
    "village": "Nandurbar",
    "state": "Maharashtra",
    "area_acres": 2.5,
    "crops": ["Tomato", "Chilli"],
    "language": "en",
    "created_at": "2024-01-01T10:00:00Z",
    "last_active": "2024-01-15T14:30:00Z"
  }
}
```

---

### PUT /farmer/:farmerId
**Description**: Update farmer information  
**Parameters**:
- `farmerId` (path): Farmer ID

**Request Body:**
```json
{
  "phone": "9876543211",
  "crops": ["Tomato", "Chilli", "Onion"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Farmer updated successfully",
  "data": { /* updated farmer object */ }
}
```

---

## 🤖 AI Analysis

### POST /diagnose
**Description**: Get AI diagnosis for crop issues  
**Content-Type**: `application/json`

**Request Body:**
```json
{
  "farmer_id": "F001",
  "crop": "Tomato",
  "issue_description": "Yellow leaves with brown spots",
  "sensor_data": {
    "temperature": 32,
    "humidity": 75,
    "soil_moisture": 45,
    "soil_ph": 6.5
  }
}
```

**Response:**
```json
{
  "status": "success",
  "diagnosis": {
    "probable_disease": "Early Blight",
    "confidence": 0.85,
    "description": "Fungal disease common in tomatoes during humid conditions",
    "severity": "medium",
    "treatment": {
      "immediate": [
        "Remove infected leaves",
        "Improve air circulation",
        "Reduce watering frequency"
      ],
      "chemical": [
        "Apply Mancozeb 75% WP",
        "Spray Chlorothalonil"
      ],
      "organic": [
        "Spray Bordeaux Mixture (1%)",
        "Apply Neem oil"
      ]
    },
    "preventive_measures": [
      "Crop rotation",
      "Resistant variety selection",
      "Proper spacing"
    ]
  }
}
```

---

### POST /chat
**Description**: Chat with AI farming assistant  
**Content-Type**: `application/json`

**Request Body:**
```json
{
  "farmer_id": "F001",
  "message": "How to increase tomato yield?",
  "language": "en"
}
```

**Response:**
```json
{
  "status": "success",
  "response": "To increase tomato yield, consider these practices: 1. Use quality seeds from certified source. 2. Maintain optimal temperature (25-28°C). 3. Keep soil moisture at 60-70%. 4. Apply balanced fertilizer NPK 10:26:26. 5. Provide proper support and pruning...",
  "sources": ["crop_database", "research_papers"],
  "audio_url": "https://api.example.com/audio/response_12345.mp3"
}
```

---

### GET /recommendations/:farmerId
**Description**: Get personalized recommendations  
**Parameters**:
- `farmerId` (path): Farmer ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "immediate_actions": [
      {
        "action": "Increase irrigation",
        "reason": "Soil moisture below 40%",
        "urgency": "high"
      }
    ],
    "upcoming_alerts": [
      {
        "type": "weather",
        "message": "Heavy rain expected. Ensure drainage is clear.",
        "date": "2024-01-20"
      }
    ],
    "seasonal_suggestions": [
      "Prepare field for monsoon crops",
      "Check pH levels for optimal growth"
    ]
  }
}
```

---

## 🔔 Notifications

### POST /notifications
**Description**: Create a notification  
**Content-Type**: `application/json`

**Request Body:**
```json
{
  "farmer_id": "F001",
  "type": "alert",
  "title": "Soil Moisture Low",
  "message": "Soil moisture has dropped to 35%. Irrigation recommended.",
  "severity": "high",
  "data": {
    "sensor_value": 35,
    "threshold": 40
  }
}
```

**Response:**
```json
{
  "status": "success",
  "notification_id": "NOT_12345",
  "timestamp": "2024-01-15T14:30:00Z"
}
```

---

### GET /notifications/:farmerId
**Description**: Get notifications for a farmer  
**Parameters**:
- `farmerId` (path): Farmer ID
- `read` (query): Filter by read status (true/false/all)
- `type` (query): Filter by type (alert/info/warning)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "notification_id": "NOT_12345",
      "type": "alert",
      "title": "Soil Moisture Low",
      "message": "...",
      "severity": "high",
      "read": false,
      "created_at": "2024-01-15T14:30:00Z"
    }
  ],
  "total": 15,
  "unread": 3
}
```

---

### PUT /notifications/:notificationId
**Description**: Mark notification as read  
**Parameters**:
- `notificationId` (path): Notification ID

**Request Body:**
```json
{
  "read": true
}
```

---

## ❌ Error Handling

### Error Response Format

```json
{
  "status": "error",
  "code": "INVALID_INPUT",
  "message": "User-friendly error message",
  "details": {
    "field": "temperature",
    "issue": "Value must be between -50 and 80"
  },
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| INVALID_INPUT | 400 | Validation error |
| NOT_FOUND | 404 | Resource not found |
| DUPLICATE | 409 | Duplicate entry |
| SERVER_ERROR | 500 | Internal server error |
| RATE_LIMITED | 429 | Too many requests |

---

## 📊 Rate Limiting

- Sensor data: 1 request per 30 seconds per device
- AI endpoints: 100 requests per hour per farmer
- Farmer endpoints: 1000 requests per hour

Headers returned with limit info:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705338600
```

---

## 🔄 Pagination

All list endpoints support pagination:

```
?limit=50&offset=100
```

- **limit**: Items per page (default: 50, max: 500)
- **offset**: Number of items to skip (default: 0)

---

## 📝 Example Request Flow

### 1. Register Farmer
```bash
POST /farmer/register
{
  "farmer_name": "Ravi Kumar",
  "phone": "9876543210",
  "village": "Nandurbar",
  "state": "Maharashtra",
  "area_acres": 2.5,
  "crops": ["Tomato"]
}
```

### 2. Send Sensor Data
```bash
POST /sensor-data
{
  "device_id": "ESP32_001",
  "farmer_id": "F001",
  "temperature": 28.5,
  "humidity": 65.2,
  "soil_moisture": 55.0
}
```

### 3. Get Recommendations
```bash
GET /recommendations/F001
```

### 4. Chat with AI
```bash
POST /chat
{
  "farmer_id": "F001",
  "message": "Is my soil pH good for tomatoes?"
}
```

---

## 🧪 Testing with Postman

**Postman Collection**: [Download Here](#)

Import the collection to test all endpoints with pre-configured requests.

---

## 📚 SDK Usage

### JavaScript
```javascript
const API_URL = 'http://localhost:3000/api';

async function getSensorData(farmerId) {
  const response = await fetch(`${API_URL}/sensor-data/${farmerId}/latest`);
  return response.json();
}
```

### Python
```python
import requests

API_URL = 'http://localhost:3000/api'

def get_sensor_data(farmer_id):
    response = requests.get(f'{API_URL}/sensor-data/{farmer_id}/latest')
    return response.json()
```

---

**Last Updated**: 2024  
**Version**: 1.0.0  
**Status**: Stable
