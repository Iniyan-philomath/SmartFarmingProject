/**
 * Smart Farming IoT - Google Apps Script Webhook
 * Direct Ingestion for Multi-Node ESP32 Telemetry
 * Columns: Timestamp | Node ID | Temperature (°C) | Humidity (%) | Soil Moisture (%) | Rain Intensity (%) | Sunlight (LDR) | Flood Risk | Drought Risk
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Node ID",
        "Temperature (°C)",
        "Humidity (%)",
        "Soil Moisture (%)",
        "Rain Intensity (%)",
        "Sunlight (LDR)",
        "Flood Risk",
        "Drought Risk"
      ]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#2e7d32").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    var data = JSON.parse(e.postData.contents);

    function getLightDisplay(item) {
      if (item.light_bright !== undefined) {
        return (item.light_bright === true || item.light_bright === "true" || item.light_bright === 1 || item.light_bright === "1") ? "BRIGHT" : "DARK";
      }
      if (item.light_status !== undefined) {
        return String(item.light_status).toUpperCase();
      }
      if (item.light !== undefined) {
        if (typeof item.light === "boolean") return item.light ? "BRIGHT" : "DARK";
        if (String(item.light).toUpperCase() === "BRIGHT") return "BRIGHT";
        if (String(item.light).toUpperCase() === "DARK") return "DARK";
        return Number(item.light) > 40 ? "BRIGHT" : "DARK";
      }
      return "DARK";
    }

    var rowsToAdd = [];
    if (Array.isArray(data)) {
      data.forEach(function(item) {
        rowsToAdd.push([
          item.timestamp || new Date().toLocaleString(),
          item.node_id || "NODE_01",
          item.temperature !== undefined ? item.temperature : "",
          item.humidity !== undefined ? item.humidity : "",
          item.soil_moisture !== undefined ? item.soil_moisture : "",
          item.rain_intensity !== undefined ? item.rain_intensity : "",
          getLightDisplay(item),
          item.flood_risk || "NO",
          item.drought_risk || "NO"
        ]);
      });
    } else {
      rowsToAdd.push([
        data.timestamp || new Date().toLocaleString(),
        data.node_id || "NODE_01",
        data.temperature !== undefined ? data.temperature : "",
        data.humidity !== undefined ? data.humidity : "",
        data.soil_moisture !== undefined ? data.soil_moisture : "",
        data.rain_intensity !== undefined ? data.rain_intensity : "",
        getLightDisplay(data),
        data.flood_risk || "NO",
        data.drought_risk || "NO"
      ]);
    }

    rowsToAdd.forEach(function(row) {
      sheet.appendRow(row);
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      rows_added: rowsToAdd.length
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "status";
    
    if (action === "get_rows" || action === "latest") {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", count: 0, rows: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var limit = (e && e.parameter && e.parameter.limit) ? parseInt(e.parameter.limit, 10) : 50;
      var startRow = Math.max(2, lastRow - limit + 1);
      var numRows = lastRow - startRow + 1;
      
      var data = sheet.getRange(startRow, 1, numRows, 9).getValues();
      var result = [];

      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        result.push({
          timestamp: r[0],
          node_id: r[1],
          temperature: r[2],
          humidity: r[3],
          soil_moisture: r[4],
          rain_intensity: r[5],
          light: r[6],
          flood_risk: r[7],
          drought_risk: r[8]
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        count: result.length,
        rows: result
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "online",
      message: "Smart Farming Google Apps Script is running.",
      supported_actions: ["get_rows", "latest"]
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

