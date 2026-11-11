#include <ArduinoJson.h>    // Added for parsing JSON from server
#include <HTTPClient.h>     // Added for server communication
#include <SocketIOclient.h> // Socket.IO client for realtime events
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include "DFRobotDFPlayerMini.h"
#include <Preferences.h>    // NVS storage for persistent host configuration


// --- PIN DEFINITIONS ---
#define SIM800L_RX 16 // ESP32 RX2 (Connects to SIM800L TX)
#define SIM800L_TX 17 // ESP32 TX2 (Connects to SIM800L RX)
#define LED_PIN 2     // D2 LED Pin

#define DFPLAYER_RX 14 // ESP32 RX (from DFPlayer TX)
#define DFPLAYER_TX 27 // ESP32 TX (to DFPlayer RX via 1k resistor)

// Initialize HardwareSerial 2 for SIM800L
HardwareSerial sim800l(2);

// Initialize HardwareSerial 1 for DFPlayer
HardwareSerial dfSerial(1);
DFRobotDFPlayerMini myDFPlayer;

// Initialize WebServer on port 80
WebServer server(80);

bool isSimBusy = false; // Prevents command collisions

// --- BACKEND SERVER SETTINGS ---
// Default cloud cluster host: 800lcall.espserver.site (always default)
const char* DEFAULT_HOST = "800lcall.espserver.site";
String mainHost = DEFAULT_HOST;
String currentHost = mainHost;
bool isSocketConnected = false;
bool needInitialTelemetry = false;
bool needRegister = false;
unsigned long registerWaitTime = 0;
unsigned long lastSocketDisconnectTime = 0;
int connectionFailures = 0;
String macAddress = "";

unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 10000; // 10 seconds

String simBuffer =
    ""; // Global buffer for tracking spontaneous serial events like SMS
String simPhoneNumber = "Unknown"; // Global variable fetched on boot

SocketIOclient socketIO;

// Variables for LED blinking
unsigned long lastBlinkTime = 0;
bool ledState = false;
const unsigned long blinkInterval = 500; // 500ms blink interval
// --- HTML DASHBOARD (Stored in flash memory) ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESP32 SIM800L Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .container { background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
        h2 { text-align: center; color: #2c3e50; margin-top: 0; }
        .section { margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        label { font-weight: bold; display: block; margin-bottom: 8px; font-size: 0.9em; }
        input[type="text"] { width: calc(100% - 20px); padding: 10px; border: 1px solid #ccc; border-radius: 6px; margin-bottom: 15px; font-size: 16px; }
        .btn-group { display: flex; gap: 10px; }
        button { flex: 1; padding: 12px; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
        .btn-call { background-color: #27ae60; color: white; }
        .btn-call:hover { background-color: #219653; }
        .btn-hangup { background-color: #e74c3c; color: white; }
        .btn-hangup:hover { background-color: #c0392b; }
        .btn-ussd { background-color: #2980b9; color: white; width: 100%; }
        .btn-ussd:hover { background-color: #2471a3; }
        .status-box { margin-top: 15px; padding: 15px; background: #e8f8f5; border-left: 4px solid #1abc9c; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-wrap: break-word; display: none; }
        .network-status { background: #eaf2f8; border: 1px solid #d4e6f1; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; font-size: 14px; color: #34495e; }
        
        /* SMS Inbox Styles */
        .sms-box { margin-top: 20px; }
        .sms-container { max-height: 350px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 6px; background: #fafafa; margin-top: 10px; }
        .sms-item { background: #fff; padding: 12px; margin-bottom: 10px; border-left: 4px solid #9b59b6; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 14px; }
        .sms-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px; color: #2c3e50; font-size: 13px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .sms-body { color: #444; white-space: pre-wrap; word-wrap: break-word; margin-top: 5px; }
        .btn-sms { background-color: #8e44ad; color: white; width: 100%; }
        .btn-sms:hover { background-color: #732d91; }
    </style>
</head>
<body>

<div class="container">
    <h2>SIM800L Control</h2>

    <!-- Network Status Section -->
    <div class="network-status" id="network_status">
        📡 Operator: <span id="operator_name" style="color:#2980b9">Loading...</span> | 
        📶 Signal: <span id="signal_strength" style="color:#27ae60">--%</span>
    </div>

    <!-- Cloud Backend Host Configuration Section -->
    <div class="section" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
        <label style="color: #1e293b; font-size: 13px; font-weight: bold; margin-bottom: 4px;">🌐 Backend Cloud Host URL (Socket.IO)</label>
        <div style="font-size: 12px; color: #475569; margin-bottom: 8px; line-height: 1.4;">
            Active Host: <b id="current_host_display" style="color: #0284c7; word-break: break-all;">https://800lcall.espserver.site</b><br>
            Socket Status: <span id="socket_conn_badge" style="display:inline-block; margin-top:3px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold; background:#fef3c7; color:#92400e;">Checking...</span>
        </div>
        <input type="text" id="custom_host_input" placeholder="e.g. https://800lcall.espserver.site" value="https://800lcall.espserver.site" style="margin-bottom: 8px;">
        <div class="btn-group">
            <button class="btn-call" onclick="saveHostConfig()" style="background-color: #0284c7; font-size: 14px; padding: 10px;">💾 Save & Connect</button>
            <button class="btn-hangup" onclick="resetDefaultHost()" style="background-color: #64748b; font-size: 14px; padding: 10px;">↺ Default</button>
        </div>
        <div id="host_status_box" class="status-box"></div>
    </div>

    <!-- Voice Call Section -->
    <div class="section">
        <label>Make a Phone Call</label>
        <input type="text" id="phone_number" placeholder="Enter phone number (e.g., +123456789)">
        <div class="btn-group">
            <button class="btn-call" onclick="makeCall()">Dial</button>
            <button class="btn-hangup" onclick="hangUp()">Hang Up</button>
        </div>
    </div>

    <!-- USSD Section -->
    <div class="section">
        <label>Send USSD Code</label>
        <input type="text" id="ussd_code" placeholder="Enter USSD (e.g., *123#)">
        <button class="btn-ussd" onclick="sendUSSD()" id="btn_ussd">Send Code</button>
        <div id="status_box" class="status-box"></div>
    </div>

    <!-- Audio Test Section -->
    <div class="section">
        <label>🔊 Test DFPlayer Audio (Local IP)</label>
        <input type="text" id="audio_track" placeholder="Enter track number (e.g., 1)">
        <button class="btn-ussd" onclick="playAudio()" style="width: 100%; background-color: #f39c12;">▶ Play Audio</button>
    </div>

    <!-- SMS Section -->
    <div class="section sms-box">
        <label>📩 Inbox (Sokol SMS)</label>
        <button class="btn-sms" onclick="loadSMS()" id="btn_sms">Message Refresh Korun</button>
        <div class="sms-container" id="sms_list">
            <div style="text-align: center; color: #888; padding: 20px;">Kono SMS load kora hoyni. Uporer batone click korun.</div>
        </div>
    </div>
</div>

<script>
    function showStatus(message) {
        const box = document.getElementById('status_box');
        box.style.display = 'block';
        box.innerText = message;
    }

    function makeCall() {
        const num = document.getElementById('phone_number').value;
        if(!num) { alert("Please enter a number!"); return; }
        showStatus("Dialing " + num + "...");
        fetch('/call?number=' + encodeURIComponent(num))
            .then(response => response.text())
            .then(data => showStatus(data));
    }

    function playAudio() {
        const track = document.getElementById('audio_track').value;
        if(!track) { alert("Please enter a track number!"); return; }
        showStatus("Playing test audio: " + track + "...");
        fetch('/playAudio?track=' + encodeURIComponent(track))
            .then(response => response.text())
            .then(data => showStatus(data));
    }

    function hangUp() {
        showStatus("Hanging up...");
        fetch('/hangup')
            .then(response => response.text())
            .then(data => showStatus(data));
    }

    function sendUSSD() {
        const code = document.getElementById('ussd_code').value;
        if(!code) { alert("Please enter a USSD code!"); return; }
        const btn = document.getElementById('btn_ussd');
        btn.innerText = "Waiting for carrier...";
        btn.disabled = true;
        showStatus("Sending command to carrier. This may take up to 15 seconds...");
        
        fetch('/ussd?code=' + encodeURIComponent(code))
            .then(response => response.text())
            .then(data => {
                showStatus(data);
                btn.innerText = "Send Code";
                btn.disabled = false;
            })
            .catch(err => {
                showStatus("Error communicating with ESP32");
                btn.innerText = "Send Code";
                btn.disabled = false;
            });
    }

    function loadSMS() {
        const btn = document.getElementById('btn_sms');
        const container = document.getElementById('sms_list');
        
        btn.innerText = "SMS Khujche...";
        btn.disabled = true;
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">SIM theke SMS pora hocche. Ektu opekkha korun...</div>';
        
        fetch('/sms')
            .then(response => response.text())
            .then(data => {
                btn.innerText = "Message Refresh Korun";
                btn.disabled = false;
                
                if(data.trim() === "Busy") {
                    container.innerHTML = '<div style="text-align: center; color: #e74c3c; padding: 20px;">SIM ekhon busy ache! Ektu pore abar try korun.</div>';
                    return;
                }
                
                displaySMS(data);
            })
            .catch(err => {
                btn.innerText = "Message Refresh Korun";
                btn.disabled = false;
                container.innerHTML = '<div style="text-align: center; color: #e74c3c; padding: 20px;">Error: ESP32 theke SMS aseni.</div>';
            });
    }
    
    function displaySMS(rawData) {
        const container = document.getElementById('sms_list');
        container.innerHTML = ''; 
        
        // Split text by standard AT+CMGL response tag
        let messages = rawData.split('+CMGL: ');
        messages.shift(); // Remove the first empty part before the first message
        
        if(messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Inbox khali. Kono notun SMS nei.</div>';
            return;
        }
        
        // Reverse array to show the newest messages first
        messages.reverse().forEach(msg => {
            let lines = msg.split('\n');
            let meta = lines[0]; // Example: 1,"REC READ","+88017...","","24/04/02,12:30:00+24"
            lines.shift(); // Remove metadata line
            
            // Join remaining lines as message body and remove trailing OK
            let body = lines.join('\n').replace(/OK\s*$/, '').trim(); 
            
            // Extract Number and Time using string split
            let metaParts = meta.split('","');
            let number = metaParts.length >= 2 ? metaParts[1] : "Unknown";
            let time = metaParts.length >= 4 ? metaParts[metaParts.length - 1].replace('"', '').trim() : "Unknown Time";
            
            let div = document.createElement('div');
            div.className = 'sms-item';
            div.innerHTML = `
                <div class="sms-header">
                    <span>📱 ${number}</span>
                    <span>🕒 ${time}</span>
                </div>
                <div class="sms-body">${body}</div>
            `;
            container.appendChild(div);
        });
    }

    function fetchNetworkStatus() {
        fetch('/status')
            .then(response => response.json())
            .then(data => {
                document.getElementById('operator_name').innerText = data.operator;
                document.getElementById('signal_strength').innerText = data.signal;
            })
            .catch(err => console.log("Status fetch error"));
    }

    function fetchHostConfig() {
        fetch('/getHost')
            .then(response => response.json())
            .then(data => {
                const full = data.fullUrl || ('https://' + data.host);
                document.getElementById('current_host_display').innerText = full;
                const input = document.getElementById('custom_host_input');
                if (!input.dataset.userEdited) {
                    input.value = full;
                }
                const badge = document.getElementById('socket_conn_badge');
                if (data.connected) {
                    badge.innerText = 'Connected (Online)';
                    badge.style.backgroundColor = '#dcfce7';
                    badge.style.color = '#15803d';
                } else {
                    badge.innerText = 'Connecting / Disconnected';
                    badge.style.backgroundColor = '#fee2e2';
                    badge.style.color = '#b91c1c';
                }
            })
            .catch(err => console.log("Host fetch error"));
    }

    function saveHostConfig() {
        const input = document.getElementById('custom_host_input').value.trim();
        if(!input) { alert("Please enter a valid host URL!"); return; }
        const box = document.getElementById('host_status_box');
        box.style.display = 'block';
        box.innerText = "Saving host URL to ESP32 flash memory...";

        fetch('/setHost?host=' + encodeURIComponent(input))
            .then(response => response.text())
            .then(msg => {
                box.innerText = msg;
                const inputElem = document.getElementById('custom_host_input');
                delete inputElem.dataset.userEdited;
                setTimeout(fetchHostConfig, 1200);
            })
            .catch(err => {
                box.innerText = "Error: Could not reach ESP32 to update host.";
            });
    }

    function resetDefaultHost() {
        const def = "https://800lcall.espserver.site";
        const inputElem = document.getElementById('custom_host_input');
        inputElem.value = def;
        delete inputElem.dataset.userEdited;
        saveHostConfig();
    }

    // Fetch network & host status on load and periodically
    window.onload = () => {
        document.getElementById('custom_host_input').addEventListener('input', function() {
            this.dataset.userEdited = "true";
        });
        fetchNetworkStatus();
        fetchHostConfig();
        setInterval(fetchNetworkStatus, 5000);
        setInterval(fetchHostConfig, 4000);
    };
</script>

</body>
</html>
)rawliteral";

// Helper function: clean input URLs (strip http://, https://, paths, ports)
String cleanHost(String raw) {
  raw.trim();
  if (raw.startsWith("https://")) raw = raw.substring(8);
  else if (raw.startsWith("http://")) raw = raw.substring(7);
  int slashIdx = raw.indexOf('/');
  if (slashIdx != -1) raw = raw.substring(0, slashIdx);
  int colonIdx = raw.indexOf(':');
  if (colonIdx != -1) raw = raw.substring(0, colonIdx);
  raw.trim();
  return raw;
}

// --- HELPER FUNCTION: Execute USSD with Session Reply Support & Complete Response Extraction ---
String executeUSSD(String code) {
  isSimBusy = true;

  // 1. Flush any residual serial data
  while (sim800l.available()) sim800l.read();

  // If user requested to terminate / cancel current interactive USSD session
  if (code.equalsIgnoreCase("CANCEL") || code.equalsIgnoreCase("END") || code == "#0") {
    sim800l.println("AT+CUSD=2");
    delay(100);
    while (sim800l.available()) sim800l.read();
    isSimBusy = false;
    return "+CUSD: 2, \"USSD Session Terminated / Cancelled\"";
  }

  // 2. Only terminate previous session if initiating a NEW root USSD query (starts with '*')
  // If code is numeric (e.g. "1", "2", "3") it is an in-session reply, so we keep the session alive!
  if (code.startsWith("*")) {
    sim800l.println("AT+CUSD=2");
    delay(100);
    while (sim800l.available()) sim800l.read();
    sim800l.println("AT+CSCS=\"GSM\"");
    delay(50);
    while (sim800l.available()) sim800l.read();
  }

  // 3. Send USSD command or in-session menu reply
  Serial.print("[USSD] Transmitting: "); Serial.println(code);
  if (!code.startsWith("*")) {
    // Active session menu reply (Grameenphone expects DCS=15 for reply dialogue)
    sim800l.print("AT+CUSD=1,\"");
    sim800l.print(code);
    sim800l.println("\",15");
  } else {
    // Standard root USSD query (e.g. *121#, *566#)
    sim800l.print("AT+CUSD=1,\"");
    sim800l.print(code);
    sim800l.println("\"");
  }

  // 5. Wait for unsolicited +CUSD network reply (up to 20 seconds) without dropping any initial bytes
  String buffer = "";
  unsigned long startWait = millis();
  bool retriedDcs = false;

  while (millis() - startWait < 20000) {
    socketIO.loop(); // Keeps Socket.IO WebSocket alive during USSD wait
    while (sim800l.available()) {
      char c = sim800l.read();
      buffer += c;
      Serial.write(c); // Echo to serial monitor
    }

    // If rejected with immediate ERROR and no +CUSD, retry with alternate DCS parameter
    if (!retriedDcs && buffer.indexOf("ERROR") != -1 && buffer.indexOf("+CUSD:") == -1) {
      Serial.println("\n[USSD] Format rejected, retrying with alternate parameter...");
      retriedDcs = true;
      buffer = "";
      if (code.startsWith("*")) {
        sim800l.println("AT+CUSD=2");
        delay(80);
        while (sim800l.available()) sim800l.read();
        sim800l.print("AT+CUSD=1,\"");
        sim800l.print(code);
        sim800l.println("\",15");
      } else {
        sim800l.print("AT+CUSD=1,\"");
        sim800l.print(code);
        sim800l.println("\"");
      }
      startWait = millis(); // Reset timer for retry
      continue;
    }

    int cusdIdx = buffer.indexOf("+CUSD:");
    if (cusdIdx != -1) {
      // Check for quoted response: +CUSD: <m>,"<text>"...
      int firstQuote = buffer.indexOf("\"", cusdIdx);
      if (firstQuote != -1) {
        int secondQuote = buffer.indexOf("\"", firstQuote + 1);
        if (secondQuote != -1) {
          // Complete quoted response arrived! Give brief buffer drain delay
          delay(150);
          while (sim800l.available()) buffer += (char)sim800l.read();
          break;
        }
      } else {
        // Unquoted response (e.g. +CUSD: 2 or +CUSD: 0)
        int nl = buffer.indexOf("\n", cusdIdx);
        if (nl != -1) {
          delay(50);
          while (sim800l.available()) buffer += (char)sim800l.read();
          break;
        }
      }
    }

    if (buffer.indexOf("+CME ERROR") != -1) {
      delay(50);
      while (sim800l.available()) buffer += (char)sim800l.read();
      break;
    }
    delay(20);
  }

  isSimBusy = false;

  // 6. Clean and extract full +CUSD line
  int cusdIdx = buffer.indexOf("+CUSD:");
  if (cusdIdx != -1) {
    String cusdLine = buffer.substring(cusdIdx);
    int endIdx = cusdLine.indexOf("\r\n\r\n");
    if (endIdx != -1) cusdLine = cusdLine.substring(0, endIdx);
    cusdLine.trim();
    return cusdLine;
  }

  if (buffer.indexOf("+CME ERROR: 512") != -1 || buffer.indexOf("+CME ERROR: 500") != -1) {
    return "[USSD Notice] Session expired or closed by network. Dial *121# to start a new session.";
  }

  if (buffer.indexOf("+CME ERROR") != -1) {
    int errIdx = buffer.indexOf("+CME ERROR");
    String errLine = buffer.substring(errIdx);
    errLine.trim();
    return "Network Error: " + errLine;
  }

  if (buffer.indexOf("ERROR") != -1) {
    return "Error: Command rejected by GSM network or SIM card.";
  }

  if (buffer.length() > 0) {
    buffer.trim();
    return "Partial response: " + buffer;
  }

  return "Error: Carrier did not respond within 20 seconds.";
}

// --- HELPER FUNCTION: Wait for USSD Response ---
String waitUSSDResponse(uint32_t timeout) {
  return executeUSSD("*121#");
}

// --- HELPER FUNCTION: Send Basic AT Command ---
String sendATCommand(String cmd, uint32_t timeout) {
  String response = "";
  while (sim800l.available())
    sim800l.read(); // Clear buffer
  sim800l.println(cmd);
  uint32_t t = millis();
  while (millis() - t < timeout) {
    socketIO.loop(); // Keeps Socket.IO WebSocket alive during AT command wait
    while (sim800l.available()) {
      response += (char)sim800l.read();
    }
    if (response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1)
      break;
  }
  return response;
}

// --- HELPER FUNCTION: Send Tracking Telemetry ---
void sendTelemetry() {
  if (isSimBusy || WiFi.status() != WL_CONNECTED)
    return;

  isSimBusy = true; // Briefly lock to prevent call collision

  // 1. Get Operator Name (AT+COPS?)
  String opName = "Searching...";
  String copsRes = sendATCommand("AT+COPS?", 1500);
  int startQuote = copsRes.indexOf('"');
  int endQuote = copsRes.indexOf('"', startQuote + 1);
  if (startQuote != -1 && endQuote != -1) {
    opName = copsRes.substring(startQuote + 1, endQuote);
  }

  // 2. Get Signal Strength (AT+CSQ)
  String sigStr = "0%";
  String csqRes = sendATCommand("AT+CSQ", 1500);
  int csqIdx = csqRes.indexOf("+CSQ: ");
  if (csqIdx != -1) {
    int commaIdx = csqRes.indexOf(',', csqIdx);
    if (commaIdx != -1) {
      int csqVal = csqRes.substring(csqIdx + 6, commaIdx).toInt();
      if (csqVal == 99)
        sigStr = "No Signal";
      else
        sigStr = String((csqVal * 100) / 31) + "%";
    }
  }

  isSimBusy = false;

  // Emit to socket
  DynamicJsonDocument doc(256);
  JsonArray array = doc.to<JsonArray>();
  array.add("esp32_telemetry");

  JsonObject payload = array.createNestedObject();
  payload["mac"] = macAddress;
  payload["ip"] = WiFi.localIP().toString();
  payload["wifi_rssi"] = WiFi.RSSI();
  payload["sim_operator"] = opName;
  payload["sim_signal"] = sigStr;
  payload["sim_number"] = simPhoneNumber;
  payload["status"] = "online";

  String output;
  serializeJson(doc, output);
  socketIO.sendEVENT(output);
}

// --- HELPER FUNCTION: Handle Socket.IO Events ---
void socketIOEvent(socketIOmessageType_t type, uint8_t *payload,
                   size_t length) {
  switch (type) {
  case sIOtype_DISCONNECT:
    Serial.printf("[IOc] Disconnected from: %s\n", currentHost.c_str());
    isSocketConnected = false;
    needRegister = false;
    connectionFailures++;
    if (lastSocketDisconnectTime == 0) lastSocketDisconnectTime = millis();
    break;

  case sIOtype_ERROR:
    Serial.printf("[IOc] Socket/SSL Error on %s: %s\n", currentHost.c_str(), payload);
    isSocketConnected = false;
    needRegister = false;
    connectionFailures++;
    if (lastSocketDisconnectTime == 0) lastSocketDisconnectTime = millis();
    break;

  case sIOtype_CONNECT:
    Serial.printf("[IOc] Connected to url: %s\n", payload);
    isSocketConnected = true;
    lastSocketDisconnectTime = 0;
    connectionFailures = 0;

    // In Socket.IO v4, send CONNECT packet to join default namespace "/"
    socketIO.send(sIOtype_CONNECT, "/");
    needRegister = true;
    registerWaitTime = millis();
    break;

  case sIOtype_EVENT: {
    // Quickly ignore broad dashboard broadcasts to keep ESP32 responsive and prevent buffer overflows
    if (strstr((char*)payload, "active_devices_update") != NULL ||
        strstr((char*)payload, "telemetry_update") != NULL ||
        strstr((char*)payload, "dashboard_cmd_result") != NULL ||
        strstr((char*)payload, "dashboard_update") != NULL ||
        strstr((char*)payload, "sms_update") != NULL) {
      break;
    }

    Serial.printf("[IOc] get event: %s\n", payload);

    // Parse incoming JSON
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      const char *eventName = doc[0];

      if (strcmp(eventName, "esptarget_cmd_dial") == 0 && !isSimBusy) {
        String phone = doc[1]["phone"].as<String>();
        Serial.println("[MANUAL] Dialing: " + phone);
        isSimBusy = true;
        sim800l.print("ATD");
        sim800l.print(phone);
        sim800l.println(";");
        isSimBusy = false;
      } else if (strcmp(eventName, "esptarget_cmd_hangup") == 0) {
        Serial.println("[MANUAL] Hang Up");
        isSimBusy = true;
        sim800l.println("ATH");
        isSimBusy = false;
      } else if (strcmp(eventName, "esptarget_cmd_ussd") == 0 && !isSimBusy) {
        String code = doc[1]["code"].as<String>();
        Serial.println("[MANUAL] Socket USSD Request: " + code);
        String ussdResponse = executeUSSD(code);

        DynamicJsonDocument resDoc(1024);
        JsonArray array = resDoc.to<JsonArray>();
        array.add("esp32_cmd_result");
        JsonObject resObj = array.createNestedObject();
        resObj["mac"] = macAddress;
        resObj["type"] = "ussd";
        resObj["code"] = code;
        resObj["data"] = ussdResponse;
        String out;
        serializeJson(resDoc, out);
        socketIO.sendEVENT(out);
        Serial.println("[IOc] Relayed USSD response to server: " + ussdResponse);
      } else if (strcmp(eventName, "esptarget_cmd_sendsms") == 0 &&
                 !isSimBusy) {
        String phone = doc[1]["phone"].as<String>();
        String text = doc[1]["message"].as<String>();
        Serial.println("[MANUAL] Splitting SMS to: " + phone);
        isSimBusy = true;
        sim800l.println("AT+CMGF=1");
        delay(100);
        sim800l.print("AT+CMGS=\"");
        sim800l.print(phone);
        sim800l.println("\"");
        delay(100);
        sim800l.print(text);
        delay(100);
        sim800l.write(26); // ^Z
        isSimBusy = false;
      } else if (strcmp(eventName, "esptarget_cmd_flightmode") == 0 &&
                 !isSimBusy) {
        bool turnOn = doc[1]["state"].as<bool>();
        isSimBusy = true;
        if (turnOn) {
          Serial.println("[MANUAL] Flight Mode ON");
          sim800l.println("AT+CFUN=4");
        } else {
          Serial.println("[MANUAL] Flight Mode OFF");
          sim800l.println("AT+CFUN=1");
        }
        isSimBusy = false;
      } else if (strcmp(eventName, "esptarget_cmd_reboot") == 0) {
        Serial.println("[MANUAL] REBOOTING ESP32 System...");
        delay(500);
        ESP.restart();
      } else if (strcmp(eventName, "execute_call") == 0 && !isSimBusy) {
        String jobId = doc[1]["job_id"].as<String>();
        String phone = doc[1]["phone_to_call"].as<String>();
        String audioTrack = "";
        if (doc[1].containsKey("audio") && !doc[1]["audio"].isNull()) {
          audioTrack = doc[1]["audio"].as<String>();
        }

        Serial.println("\n[SERVER JOB] New call requested: " + phone);
        if (audioTrack.length() > 0) {
           Serial.println("Will play audio track: " + audioTrack);
        }
        isSimBusy = true;

        // Clear SIM buffer
        while (sim800l.available())
          sim800l.read();

        // Make the call
        sim800l.print("ATD");
        sim800l.print(phone);
        sim800l.println(";");

        String resultStatus = "success";
        unsigned long callStart = millis();
        unsigned long receivedTime = 0;
        String simResponse = "";
        bool callOngoing = true;
        bool wasReceived = false;
        bool audioPlayed = false;

        Serial.println("Dialing... waiting up to 60s...");
        unsigned long lastClccPoll = millis();

        while (millis() - callStart < 60000 && callOngoing) {
          while (sim800l.available()) {
            char c = sim800l.read();
            simResponse += c;
            Serial.write(c);
          }

          if (simResponse.indexOf("BUSY") != -1) {
            resultStatus = "busy"; // Remote user rejected
            callOngoing = false;
          } else if (simResponse.indexOf("ERROR") != -1) {
            resultStatus = "hardware_error"; // Modem error
            callOngoing = false;
          } else if (simResponse.indexOf("NO CARRIER") != -1) {
            // If NO CARRIER very fast (less than 5 sec), network disconnected
            // instantly (unreachable)
            if (millis() - callStart < 5000)
              resultStatus = "unreachable";
            else
              resultStatus =
                  "success"; // It rang successfully but was disconnected later
            callOngoing = false;
          } else if (simResponse.indexOf("NO ANSWER") != -1) {
            resultStatus = "success"; // Rang successfully but didn't pick up
            callOngoing = false;
          }

          // Poll AT+CLCC every 2.5 seconds to see if it was picked up
          if (millis() - lastClccPoll > 2500 && callOngoing) {
            sim800l.println("AT+CLCC");
            lastClccPoll = millis();
          }

          // Use simple robust matching since Serial bytes can stream slowly and split CSV parsing
          if (simResponse.indexOf(",0,0,0,0") != -1 || simResponse.indexOf(",1,0,0,0") != -1 || simResponse.indexOf("+CLCC: 1,0,0,0") != -1) {
             if (!wasReceived) {
                Serial.println("\n>>> [CALL SYSTEM] Remote user picked up! (Status = 0) <<<");
                wasReceived = true;
                receivedTime = millis();
                resultStatus = "received";
                
                if (audioTrack.length() > 0 && !audioPlayed) {
                  int trackNum = audioTrack.toInt();
                  Serial.println("\n>>> [DFPLAYER] Waiting 1 second to clear voice path... <<<");
                  delay(1000); // Wait 1 second (1000ms) for real-time voice channel to fully open
                  Serial.println("\n>>> [DFPLAYER] Triggering Track Number: " + String(trackNum) + " <<<");
                  myDFPlayer.volume(30); // Max volume
                  myDFPlayer.play(trackNum);
                  audioPlayed = true;
                }
             }
          }

          if (wasReceived && millis() - receivedTime > 20000) {
            Serial.println("20 seconds elapsed since call was received. Finishing.");
            callOngoing = false;
            break;
          }
          
          // Clear buffer safely once it gets too big (e.g. after multiple AT+CLCC calls)
          if(simResponse.length() > 300) {
             simResponse = simResponse.substring(simResponse.length() - 150);
          }
        }

        // Hang up explicitly
        sim800l.println("ATH");
        delay(1000);
        while (sim800l.available())
          Serial.write(sim800l.read()); // flush remaining data

        isSimBusy = false;
        // Clean up exact statuses overrides if needed
        if (resultStatus == "success" && wasReceived)
          resultStatus = "received";

        Serial.println("\n[SERVER JOB] Call finished. Status: " + resultStatus);

        // Report result back to server via Socket.io
        DynamicJsonDocument resDoc(256);
        JsonArray resArray = resDoc.to<JsonArray>();
        resArray.add("call_result");
        JsonObject resObj = resArray.createNestedObject();
        resObj["job_id"] = jobId;
        resObj["status"] = resultStatus;

        String resOutput;
        serializeJson(resDoc, resOutput);
        socketIO.sendEVENT(resOutput);
        Serial.println("[SERVER JOB] Result reported via WebSocket.");
      }
    }
  } break;
  case sIOtype_ACK:
  case sIOtype_BINARY_EVENT:
  case sIOtype_BINARY_ACK:
    break;
  }
}

void setup() {
  // 1. Initialize Serial Monitors
  Serial.begin(115200);
  sim800l.begin(9600, SERIAL_8N1, SIM800L_RX, SIM800L_TX);

  // DFPlayer Mini Initialization
  dfSerial.begin(9600, SERIAL_8N1, DFPLAYER_RX, DFPLAYER_TX);
  Serial.println("Initializing DFPlayer...");
  if (!myDFPlayer.begin(dfSerial)) {
    Serial.println("Unable to begin: DFPlayer");
  } else {
    myDFPlayer.volume(30); // Set volume value (0~30).
    Serial.println("DFPlayer Mini online.");
  }

  pinMode(LED_PIN, OUTPUT);

  Serial.println("\n--- Starting ESP32 SIM800L Dashboard ---");

  // 2. WiFiManager Initialization
  WiFiManager wm;

  // Uncomment the line below to erase saved WiFi credentials (for testing)
  // wm.resetSettings();

  Serial.println("Connecting to WiFi via WiFiManager...");
  // This will try to connect. If it fails, it creates an AP named
  // "ESP32_SIM800_AP"
  bool res = wm.autoConnect("ESP32_SIM800_AP");

  if (!res) {
    Serial.println("Failed to connect to WiFi and hit timeout");
    ESP.restart(); // Restart and try again
  }

  // Store the ESP32's MAC Address to identify it to the server
  macAddress = WiFi.macAddress();

  Serial.println("\nWiFi connected successfully!");
  Serial.print("ESP32 MAC Address: ");
  Serial.println(macAddress);
  Serial.print("Access your dashboard at IP: http://");
  Serial.println(WiFi.localIP());

  // 3. Setup Web Server Routing

  // Route: Serve the main HTML page
  server.on("/", HTTP_GET, []() { server.send(200, "text/html", index_html); });

  // Route: Make a Call
  server.on("/call", HTTP_GET, []() {
    if (server.hasArg("number")) {
      String num = server.arg("number");
      Serial.println("Web Request: Call " + num);

      isSimBusy = true;
      sim800l.print("ATD");
      sim800l.print(num);
      sim800l.println(";"); // Semicolon is required for voice calls
      isSimBusy = false;

      server.send(200, "text/plain", "Dialing: " + num);
    } else {
      server.send(400, "text/plain", "Error: No number provided");
    }
  });

  // Route: Hang up
  server.on("/hangup", HTTP_GET, []() {
    Serial.println("Web Request: Hang Up");
    isSimBusy = true;
    sim800l.println("ATH");
    isSimBusy = false;
    server.send(200, "text/plain", "Call disconnected.");
  });

  // Route: Send USSD Code (e.g., *123#)
  server.on("/ussd", HTTP_GET, []() {
    if (server.hasArg("code")) {
      String code = server.arg("code");
      Serial.println("Web Request: USSD " + code);

      isSimBusy = true;

      // Clear out any old data from the serial buffer first
      while (sim800l.available()) {
        sim800l.read();
      }

      // Command to send USSD. '15' is the GSM standard alphabet for USSD.
      sim800l.print("AT+CUSD=1,\"");
      sim800l.print(code);
      sim800l.println("\",15");

      // Wait up to 15 seconds for the network to reply
      String ussdReply = waitUSSDResponse(15000);

      isSimBusy = false;

      server.send(200, "text/plain", ussdReply);
    } else {
      server.send(400, "text/plain", "Error: No USSD code provided");
    }
  });

  // Route: Play Audio Test (From IP Dashboard)
  server.on("/playAudio", HTTP_GET, []() {
    if (server.hasArg("track")) {
      String track = server.arg("track");
      Serial.println("Web Request: Play Audio Track " + track);
      myDFPlayer.play(track.toInt());
      server.send(200, "text/plain", "Playing audio track " + track);
    } else {
      server.send(400, "text/plain", "Error: No track provided");
    }
  });

  // Route: Read All SMS Inbox
  server.on("/sms", HTTP_GET, []() {
    if (isSimBusy) {
      server.send(200, "text/plain", "Busy");
      return;
    }

    Serial.println("Web Request: Loading SMS Inbox...");
    isSimBusy = true;

    // AT+CMGL="ALL" reads all saved messages (Read & Unread) from the SIM
    // storage 8000ms timeout is given so it can read up to 20-30 messages
    // slowly
    String smsData = sendATCommand("AT+CMGL=\"ALL\"", 8000);

    isSimBusy = false;

    server.send(200, "text/plain", smsData);
  });

  // Route: Get Network Status (Operator & Signal)
  server.on("/status", HTTP_GET, []() {
    // If we are currently dialing or sending USSD, skip checking network to
    // avoid corrupting serial data
    if (isSimBusy) {
      server.send(200, "application/json",
                  "{\"operator\":\"Busy...\", \"signal\":\"--\"}");
      return;
    }

    isSimBusy = true;

    // 1. Get Operator Name (AT+COPS?)
    String opName = "Searching...";
    String copsRes = sendATCommand("AT+COPS?", 2000);
    int startQuote = copsRes.indexOf('"');
    int endQuote = copsRes.indexOf('"', startQuote + 1);
    if (startQuote != -1 && endQuote != -1) {
      opName = copsRes.substring(startQuote + 1, endQuote);
    }

    // 2. Get Signal Strength (AT+CSQ)
    String sigStr = "0%";
    String csqRes = sendATCommand("AT+CSQ", 2000);
    int csqIdx = csqRes.indexOf("+CSQ: ");
    if (csqIdx != -1) {
      int commaIdx = csqRes.indexOf(',', csqIdx);
      if (commaIdx != -1) {
        int csqVal = csqRes.substring(csqIdx + 6, commaIdx).toInt();
        if (csqVal == 99)
          sigStr = "No Signal";
        else
          sigStr = String((csqVal * 100) / 31) +
                   "%"; // Convert SIM800L 0-31 range to percentage
      }
    }

    isSimBusy = false;

    String jsonResponse =
        "{\"operator\":\"" + opName + "\", \"signal\":\"" + sigStr + "\"}";
    server.send(200, "application/json", jsonResponse);
  });

  // Route: Get current backend host and socket status
  server.on("/getHost", HTTP_GET, []() {
    String json = "{\"host\":\"" + currentHost + "\",\"fullUrl\":\"https://" + currentHost + "\",\"connected\":" + (isSocketConnected ? "true" : "false") + "}";
    server.send(200, "application/json", json);
  });

  // Route: Set new backend host URL (persists in NVS Preferences)
  auto handleSetHost = []() {
    String newHostRaw = "";
    if (server.hasArg("host")) {
      newHostRaw = server.arg("host");
    } else if (server.hasArg("plain")) {
      newHostRaw = server.arg("plain");
    }

    String cleaned = cleanHost(newHostRaw);
    if (cleaned.length() < 3) {
      server.send(400, "text/plain", "Invalid host! Example: https://800lcall.espserver.site");
      return;
    }

    mainHost = cleaned;
    currentHost = cleaned;

    // Save permanently to flash NVS
    Preferences prefs;
    prefs.begin("server_cfg", false);
    prefs.putString("host", mainHost);
    prefs.end();

    Serial.println("\n[CONFIG] Host URL updated via ESP32 Dashboard to: " + currentHost);

    // Reconnect Socket.IO to the new host
    isSocketConnected = false;
    needRegister = false;
    socketIO.disconnect();
    socketIO.beginSSL(currentHost.c_str(), 443, "/socket.io/?EIO=4");
    lastSocketDisconnectTime = millis();
    connectionFailures = 0;

    server.send(200, "text/plain", "Success: Saved to ESP32 Flash memory! Reconnecting to https://" + currentHost);
  };

  server.on("/setHost", HTTP_GET, handleSetHost);
  server.on("/setHost", HTTP_POST, handleSetHost);

  // Start the server
  server.begin();

  // 4. Initialize SIM800L basic settings
  delay(1000);           // Give SIM module brief time to register
  sim800l.println("AT"); // Wake up/Handshake
  delay(100);
  sim800l.println("AT+CMGF=1"); // Set to text mode
  delay(100);
  sim800l.println("AT+CNMI=2,2,0,0,0"); // Deliver SMS immediately directly on serial
  delay(100);

  // 5. Load saved host configuration from ESP32 Flash memory (Preferences/NVS)
  Preferences prefs;
  prefs.begin("server_cfg", true);
  String savedHost = prefs.getString("host", DEFAULT_HOST);
  prefs.end();

  if (savedHost.length() > 0) {
    mainHost = cleanHost(savedHost);
  } else {
    mainHost = DEFAULT_HOST;
  }
  currentHost = mainHost;

  // Initialize Socket.IO connection (Single host: 800lcall.espserver.site, no backup)
  Serial.println("[IOc] Initializing Cloud Socket.IO connection...");
  Serial.print("[IOc] Active Cloud Server: https://"); Serial.println(currentHost);
  lastSocketDisconnectTime = millis();
  socketIO.beginSSL(currentHost.c_str(), 443, "/socket.io/?EIO=4");
  socketIO.onEvent(socketIOEvent);
}

void loop() {
  // Handle incoming web client requests
  server.handleClient();

  // Mirror any unsolicited data from SIM800L to Serial Monitor & Buffer Live
  // SMS
  while (sim800l.available()) {
    char c = sim800l.read();
    Serial.write(c);
    simBuffer += c;
  }

  // Parse +CMT (live SMS) asynchronously
  if (simBuffer.length() > 0) {
    int cmtIndex = simBuffer.indexOf("+CMT:");
    if (cmtIndex != -1) {
      // Wait for transmission to finish (Serial quiet for 100ms)
      unsigned long lastCharTime = millis();
      while (millis() - lastCharTime < 100) {
        while (sim800l.available()) {
          char c = sim800l.read();
          Serial.write(c);
          simBuffer += c;
          lastCharTime = millis();
        }
      }

      int firstQuote = simBuffer.indexOf("\"", cmtIndex);
      int secondQuote = simBuffer.indexOf("\"", firstQuote + 1);

      if (firstQuote != -1 && secondQuote != -1) {
        String senderNum = simBuffer.substring(firstQuote + 1, secondQuote);

        int newlineIdx = simBuffer.indexOf("\n", secondQuote);
        if (newlineIdx != -1) {
          // Read up to the end of the acquired string
          String body = simBuffer.substring(newlineIdx + 1);
          body.replace("\r", "");
          body.trim();

          if (body.length() > 0) {
            DynamicJsonDocument d(
                1024); // Support very large Hex bodies securely
            JsonArray arr = d.to<JsonArray>();
            arr.add("hardware_incoming_sms");
            JsonObject p = arr.createNestedObject();
            p["sender"] = senderNum;
            p["message"] = body;
            p["timestamp"] = "-";

            String output;
            serializeJson(d, output);
            socketIO.sendEVENT(output);
            Serial.println("[SMS REC] Sent live over Socket.io!");
          }
        }
      }
      simBuffer = ""; // Reset buffer after dealing with CMT
    } else if (simBuffer.indexOf("+CUSD:") != -1) {
      // Async +CUSD reply caught in buffer
      unsigned long lastCharTime = millis();
      while (millis() - lastCharTime < 150) {
        while (sim800l.available()) {
          char c = sim800l.read();
          Serial.write(c);
          simBuffer += c;
          lastCharTime = millis();
        }
      }
      int cusdIndex = simBuffer.indexOf("+CUSD:");
      String cusdPayload = simBuffer.substring(cusdIndex);
      int nlIdx = cusdPayload.indexOf("\r\n\r\n");
      if (nlIdx != -1) cusdPayload = cusdPayload.substring(0, nlIdx);
      cusdPayload.trim();

      DynamicJsonDocument d(1024);
      JsonArray arr = d.to<JsonArray>();
      arr.add("esp32_cmd_result");
      JsonObject p = arr.createNestedObject();
      p["mac"] = macAddress;
      p["type"] = "ussd";
      p["data"] = cusdPayload;
      String output;
      serializeJson(d, output);
      socketIO.sendEVENT(output);
      Serial.println("[USSD ASYNC] Relayed unsolicited +CUSD to server!");
      simBuffer = "";
    } else if (simBuffer.length() > 1500) {
      simBuffer = ""; // Prevent memory leak from noise over time, increased to
                      // 1500 to allow very long chunks before pruning
    }
  }

  // Handle ongoing Socket.IO connection
  socketIO.loop();

  // Send registration 300ms after namespace connection to ensure server is ready
  if (needRegister && isSocketConnected && (millis() - registerWaitTime >= 300)) {
    needRegister = false;
    DynamicJsonDocument doc(256);
    JsonArray array = doc.to<JsonArray>();
    array.add("esp32_register");
    JsonObject param1 = array.createNestedObject();
    param1["mac"] = macAddress;
    param1["ip"] = WiFi.localIP().toString();

    String output;
    serializeJson(doc, output);
    socketIO.sendEVENT(output);
    Serial.println("[IOc] Sent esp32_register event: " + macAddress);
    needInitialTelemetry = true;
  }

  // Send initial telemetry safely from main loop once connected
  if (needInitialTelemetry && isSocketConnected) {
    needInitialTelemetry = false;
    sendTelemetry();
  }

  // Auto-reconnect to currentHost if disconnected for > 15s (Single host, no backup failover)
  if (!isSocketConnected && (millis() - lastSocketDisconnectTime > 15000)) {
    Serial.printf("[IOc] Reconnecting to: %s (SSL Port 443)...\n", currentHost.c_str());
    socketIO.disconnect();
    socketIO.beginSSL(currentHost.c_str(), 443, "/socket.io/?EIO=4");
    lastSocketDisconnectTime = millis();
  }

  // Handle LED based on WiFi status
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH); // LED jolbe
  } else {
    // WiFi not connected, LED blinking
    if (millis() - lastBlinkTime >= blinkInterval) {
      lastBlinkTime = millis();
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
    }
  }

  if (millis() - lastTelemetryTime >= telemetryInterval) {
    lastTelemetryTime = millis();
    sendTelemetry();
  }
}