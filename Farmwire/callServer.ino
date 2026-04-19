#include <ArduinoJson.h>    // Added for parsing JSON from server
#include <HTTPClient.h>     // Added for server communication
#include <SocketIOclient.h> // Socket.IO client for realtime events
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include "DFRobotDFPlayerMini.h"


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
String mainHost = "800lcall.espserver.site";
String backupHost = "sim800l.maxapi.esp32.site";
String currentHost = mainHost;
bool isSocketConnected = false;
unsigned long lastSocketDisconnectTime = 0;
const unsigned long socketFailoverTimeout = 20000; // 20 seconds
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

    // Fetch network status on load and every 5 seconds
    window.onload = () => {
        fetchNetworkStatus();
        setInterval(fetchNetworkStatus, 5000);
    };
</script>

</body>
</html>
)rawliteral";

// --- HELPER FUNCTION: Wait for USSD Response ---
String waitUSSDResponse(uint32_t timeout) {
  uint32_t startTime = millis();
  String responseBuffer = "";

  while (millis() - startTime < timeout) {
    while (sim800l.available()) {
      char c = sim800l.read();
      responseBuffer += c;
      Serial.write(c); // Mirror to Serial Monitor
    }

    // Check if the response buffer contains the USSD reply tag (+CUSD:)
    if (responseBuffer.indexOf("+CUSD:") != -1 &&
        responseBuffer.indexOf("\"", responseBuffer.indexOf("+CUSD:") + 7) !=
            -1) {
      // Allow a tiny delay to catch the end of the message carriage returns
      delay(100);
      while (sim800l.available()) {
        responseBuffer += (char)sim800l.read();
      }
      return responseBuffer;
    }
  }

  if (responseBuffer.length() > 0) {
    return "Partial response/Timeout: \n" + responseBuffer;
  }
  return "Error: Carrier did not respond in time.";
}

// --- HELPER FUNCTION: Send Basic AT Command ---
String sendATCommand(String cmd, uint32_t timeout) {
  String response = "";
  while (sim800l.available())
    sim800l.read(); // Clear buffer
  sim800l.println(cmd);
  uint32_t t = millis();
  while (millis() - t < timeout) {
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

  String output;
  serializeJson(doc, output);
  socketIO.sendEVENT(output);
}

// --- HELPER FUNCTION: Handle Socket.IO Events ---
void socketIOEvent(socketIOmessageType_t type, uint8_t *payload,
                   size_t length) {
  switch (type) {
  case sIOtype_DISCONNECT:
    Serial.printf("[IOc] Disconnected!\n");
    isSocketConnected = false;
    lastSocketDisconnectTime = millis(); // Mark failover countdown
    break;

  case sIOtype_CONNECT:
    Serial.printf("[IOc] Connected to url: %s\n", payload);
    isSocketConnected = true;
    // join default namespace (no auto join in Socket.IO v3)
    socketIO.send(sIOtype_CONNECT, "/");

    // Register MAC with server
    {
      DynamicJsonDocument doc(256);
      JsonArray array = doc.to<JsonArray>();
      array.add("esp32_register");
      JsonObject param1 = array.createNestedObject();
      param1["mac"] = macAddress;

      String output;
      serializeJson(doc, output);
      socketIO.sendEVENT(output);
      Serial.println("[IOc] Sent esp32_register event");
    }
    break;

  case sIOtype_EVENT: {
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
        Serial.println("[MANUAL] USSD: " + code);
        isSimBusy = true;
        while (sim800l.available())
          sim800l.read();

        sim800l.print("AT+CUSD=1,\"");
        sim800l.print(code);
        sim800l.println("\",15");

        String ussdResponse = "Timeout or Error";
        unsigned long start = millis();
        String tb = "";
        while (millis() - start < 15000) {
          while (sim800l.available()) {
            char c = sim800l.read();
            tb += c;
          }
          if (tb.indexOf("+CUSD:") != -1 &&
              tb.indexOf("\"", tb.indexOf("+CUSD:") + 7) != -1) {
            delay(100);
            while (sim800l.available())
              tb += (char)sim800l.read();
            ussdResponse = tb;
            break;
          }
        }
        isSimBusy = false;

        DynamicJsonDocument resDoc(512);
        JsonArray array = resDoc.to<JsonArray>();
        array.add("esp32_cmd_result");
        JsonObject resObj = array.createNestedObject();
        resObj["type"] = "ussd";
        resObj["data"] = ussdResponse;
        String out;
        serializeJson(resDoc, out);
        socketIO.sendEVENT(out);
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
  case sIOtype_ERROR:
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

  // Start the server
  server.begin();

  // 4. Initialize Socket.IO connection
  socketIO.beginSSL(currentHost, 443, "/socket.io/?EIO=4");
  socketIO.onEvent(socketIOEvent);

  // 4. Initialize SIM800L basic settings
  delay(3000);           // Give SIM module time to register to network
  sim800l.println("AT"); // Wake up/Handshake
  delay(100);
  sim800l.println("AT+CMGF=1"); // Set to text mode
  delay(100);
  sim800l.println(
      "AT+CNMI=2,2,0,0,0"); // Deliver SMS immediately directly on serial

  // 5. Fetch SIM Phone Number safely by polling the Local Operator MSISDN query
  Serial.println("Identifying SIM Phone Number...");
  sim800l.println("AT+CUSD=1,\"*2#\",15");
  unsigned long msStart = millis();
  String ussdRes = "";
  while (millis() - msStart < 15000) {
    while (sim800l.available()) {
      char c = sim800l.read();
      ussdRes += c;
    }
    if (ussdRes.indexOf("+CUSD:") != -1 && ussdRes.indexOf("MSISDN:") != -1) {
      delay(300); // Wait for the whole string to finish
      while (sim800l.available()) {
        ussdRes += (char)sim800l.read();
      }

      int msisdnIndex = ussdRes.indexOf("MSISDN:");
      if (msisdnIndex != -1) {
        int newlineIdx = ussdRes.indexOf("\n", msisdnIndex);
        if (newlineIdx != -1) {
          int quoteIdx = ussdRes.indexOf("\"", newlineIdx);
          if (quoteIdx != -1) {
            simPhoneNumber = ussdRes.substring(newlineIdx + 1, quoteIdx);
            simPhoneNumber.replace("\r", "");
            simPhoneNumber.trim();
            Serial.println("Phone Number Identified: " + simPhoneNumber);
          }
        }
      }
      break;
    }
  }
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
    } else if (simBuffer.length() > 1500) {
      simBuffer = ""; // Prevent memory leak from noise over time, increased to
                      // 1500 to allow very long chunks before pruning
    }
  }

  // Handle ongoing Socket.IO connection
  socketIO.loop();

  // Failover Check Mechanism
  if (!isSocketConnected && millis() - lastSocketDisconnectTime > socketFailoverTimeout) {
    Serial.println("[IOc] Host unresponsive for 20s. Failover triggered! Switching server...");
    socketIO.disconnect();
    currentHost = (currentHost == mainHost) ? backupHost : mainHost;
    socketIO.beginSSL(currentHost, 443, "/socket.io/?EIO=4");
    lastSocketDisconnectTime = millis(); // Reset countdown timer for the new host
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