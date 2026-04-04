#include <WiFi.h>
#include <WebServer.h>
#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include <HTTPClient.h>  // Added for server communication
#include <ArduinoJson.h> // Added for parsing JSON from server

// --- PIN DEFINITIONS ---
#define SIM800L_RX 16 // ESP32 RX2 (Connects to SIM800L TX)
#define SIM800L_TX 17 // ESP32 TX2 (Connects to SIM800L RX)

// Initialize HardwareSerial 2 for SIM800L
HardwareSerial sim800l(2);

// Initialize WebServer on port 80
WebServer server(80);

bool isSimBusy = false; // Prevents command collisions

// --- BACKEND SERVER SETTINGS ---
// IMPORTANT: Change this to your computer's local IP address where Node.js is running
String backendServer = "http://192.168.1.100:3000"; 
String macAddress = "";
unsigned long lastPollTime = 0;
const unsigned long pollInterval = 5000; // Check for new calls every 5 seconds

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
    if (responseBuffer.indexOf("+CUSD:") != -1 && responseBuffer.indexOf("\"", responseBuffer.indexOf("+CUSD:") + 7) != -1) {
       // Allow a tiny delay to catch the end of the message carriage returns
       delay(100); 
       while (sim800l.available()) { responseBuffer += (char)sim800l.read(); }
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
  while(sim800l.available()) sim800l.read(); // Clear buffer
  sim800l.println(cmd);
  uint32_t t = millis();
  while(millis() - t < timeout) {
    while(sim800l.available()) {
      response += (char)sim800l.read();
    }
    if(response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1) break;
  }
  return response;
}

// --- HELPER FUNCTION: Poll Server for Calls ---
void checkServerForJobs() {
  if (WiFi.status() != WL_CONNECTED || isSimBusy) return;

  HTTPClient http;
  String url = backendServer + "/api/esp32/pending-calls/" + macAddress;
  
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    
    // Parse JSON
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error && doc["has_job"] == true) {
      String jobId = doc["job_id"].as<String>();
      String phone = doc["phone_to_call"].as<String>();

      Serial.println("\n[SERVER JOB] New call requested: " + phone);
      isSimBusy = true;
      
      // Clear SIM buffer
      while(sim800l.available()) sim800l.read();
      
      // Make the call
      sim800l.print("ATD");
      sim800l.print(phone);
      sim800l.println(";");
      
      bool callFailed = false;
      unsigned long callStart = millis();
      String simResponse = "";
      
      // Wait 15 seconds for the call to ring/complete
      // We also monitor if the carrier instantly drops it (BUSY, NO CARRIER)
      Serial.println("Dialing... waiting 15 seconds...");
      while(millis() - callStart < 15000) {
        while(sim800l.available()) {
          char c = sim800l.read();
          simResponse += c;
          Serial.write(c);
        }
        if(simResponse.indexOf("BUSY") != -1 || simResponse.indexOf("NO CARRIER") != -1 || simResponse.indexOf("ERROR") != -1) {
          callFailed = true;
          break;
        }
      }
      
      // Hang up
      sim800l.println("ATH");
      delay(1000);
      while(sim800l.available()) Serial.write(sim800l.read()); // flush remaining data
      
      isSimBusy = false;
      String resultStatus = callFailed ? "fail" : "success";
      Serial.println("\n[SERVER JOB] Call finished. Status: " + resultStatus);

      // Report result back to server
      http.begin(backendServer + "/api/esp32/call-result");
      http.addHeader("Content-Type", "application/json");
      String postData = "{\"job_id\":\"" + jobId + "\",\"status\":\"" + resultStatus + "\"}";
      int postCode = http.POST(postData);
      
      if(postCode > 0) {
        Serial.println("[SERVER JOB] Result reported to server successfully.");
      } else {
        Serial.println("[SERVER JOB] Error reporting to server: " + http.errorToString(postCode));
      }
    }
  }
  http.end();
}


void setup() {
  // 1. Initialize Serial Monitors
  Serial.begin(115200);
  sim800l.begin(9600, SERIAL_8N1, SIM800L_RX, SIM800L_TX);
  
  Serial.println("\n--- Starting ESP32 SIM800L Dashboard ---");

  // 2. WiFiManager Initialization
  WiFiManager wm;
  
  // Uncomment the line below to erase saved WiFi credentials (for testing)
  // wm.resetSettings();

  Serial.println("Connecting to WiFi via WiFiManager...");
  // This will try to connect. If it fails, it creates an AP named "ESP32_SIM800_AP"
  bool res = wm.autoConnect("ESP32_SIM800_AP");

  if(!res) {
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
  server.on("/", HTTP_GET, []() {
    server.send(200, "text/html", index_html);
  });

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
      while(sim800l.available()) { sim800l.read(); }

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

  // Route: Read All SMS Inbox
  server.on("/sms", HTTP_GET, []() {
    if(isSimBusy) {
       server.send(200, "text/plain", "Busy");
       return;
    }
    
    Serial.println("Web Request: Loading SMS Inbox...");
    isSimBusy = true;
    
    // AT+CMGL="ALL" reads all saved messages (Read & Unread) from the SIM storage
    // 8000ms timeout is given so it can read up to 20-30 messages slowly
    String smsData = sendATCommand("AT+CMGL=\"ALL\"", 8000); 
    
    isSimBusy = false;
    
    server.send(200, "text/plain", smsData);
  });

  // Route: Get Network Status (Operator & Signal)
  server.on("/status", HTTP_GET, []() {
    // If we are currently dialing or sending USSD, skip checking network to avoid corrupting serial data
    if(isSimBusy) {
       server.send(200, "application/json", "{\"operator\":\"Busy...\", \"signal\":\"--\"}");
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
      if(commaIdx != -1) {
        int csqVal = csqRes.substring(csqIdx + 6, commaIdx).toInt();
        if (csqVal == 99) sigStr = "No Signal";
        else sigStr = String((csqVal * 100) / 31) + "%"; // Convert SIM800L 0-31 range to percentage
      }
    }
    
    isSimBusy = false;

    String jsonResponse = "{\"operator\":\"" + opName + "\", \"signal\":\"" + sigStr + "\"}";
    server.send(200, "application/json", jsonResponse);
  });

  // Start the server
  server.begin();
  
  // 4. Initialize SIM800L basic settings
  delay(3000); // Give SIM module time to register to network
  sim800l.println("AT"); // Wake up/Handshake
  delay(100);
  sim800l.println("AT+CMGF=1"); // Set to text mode
}

void loop() {
  // Handle incoming web client requests
  server.handleClient();
  
  // Mirror any unsolicited data from SIM800L (like incoming calls) to Serial Monitor
  while (sim800l.available()) {
    Serial.write(sim800l.read());
  }

  // Poll the Node.js server every 5 seconds
  if (millis() - lastPollTime >= pollInterval) {
    lastPollTime = millis();
    checkServerForJobs();
  }
}