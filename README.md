# SIM800L ESP32 Calling Server & Fleet Management Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black.svg)](https://nextjs.org/)
[![ESP32](https://img.shields.io/badge/ESP32-Arduino-red.svg)](https://www.espressif.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.0-white.svg)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-blue.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

An enterprise-grade, distributed telecommunications and fleet gateway management platform powered by **ESP32**, **SIM800L GSM modems**, **DFPlayer Mini audio processors**, a high-concurrency **Node.js/Socket.IO backend**, and a modern **Next.js 16 fullstack web dashboard**.

---

## 📑 Table of Contents
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Hardware Wiring & Pinout Guide](#-hardware-wiring--pinout-guide)
- [Cloud Infrastructure & Networking](#-cloud-infrastructure--networking)
- [Directory Structure](#-directory-structure)
- [Installation & Quickstart](#-installation--quickstart)
  - [1. Backend Server Setup](#1-backend-server-setup)
  - [2. Next.js Web Dashboard Setup](#2-nextjs-web-dashboard-setup)
  - [3. ESP32 Firmware Flashing](#3-esp32-firmware-flashing)
- [Dynamic Cloud Host Configuration](#-dynamic-cloud-host-configuration)
- [Socket.IO Events & API Reference](#-socketio-events--api-reference)
- [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🏛 System Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                      CLIENT APPLICATIONS                                          |
|   +------------------------------------+             +----------------------------------------+   |
|   |    Next.js 16 Web Dashboard (SPA)   |             |       Legacy HTML5 / Mobile Portal     |   |
|   |  - Real-time Fleet Telemetry (Vitals)|            |  - Responsive Bootstrap Dashboard     |   |
|   |  - Targeted & Anonymous Broadcasts |             |  - Quick USSD & Manual Dial Trigger    |   |
|   |  - Virtual Device Gateway Manager  |             |  - Basic SMS & Call Log View           |   |
|   |  - Zero-Drop Priority FIFO Queue   |             +----------------------------------------+   |
|   |  - Voice & SMS Campaign Engine     |                                                          |
|   |  - Date-to-Date CSV & PDF Exporter |                                                          |
|   |  - High-Contrast Dark/Light Engine |                                                          |
|   +-----------------+------------------+                                                          |
+---------------------|-----------------------------------------------------------------------------+
                      | HTTP REST & WebSocket (Socket.IO v4, JWT Auth)
                      v
+---------------------------------------------------------------------------------------------------+
|                             CENTRAL SERVER (Node.js / Express 4 / Socket.IO)                      |
|  - Auth & RBAC Middleware (JWT Bearer, bcryptjs, Admin / Moderator / Manager / User)             |
|  - Load Balancer & Dispatch Engine (Auto-distribute, Specific MAC route, Virtual Gateway route)   |
|  - Zero-Drop FIFO Priority Queue Worker (Buffer on high load, 3x backoff auto-retry)              |
|  - Telco Carrier Signaling Parser (UDUB Rejected, Call Waiting, Forwarded, Busy, Connected)       |
|  - Dual Gateway SMS Dispatcher (SIM800L Hardware Modems + BulkSMSBD Cloud API)                    |
|  - Virtual Device Talk Time Tracker (Cumulative seconds, calls handled, SMS dispatched)           |
|  - Device Activity Audit Logger (Real-time tracking of who changed what on every device)         |
+---------------------------------------------------------------------------------------------------+
                      |                                                     |
                      | Mongoose ODM                                        | Direct WebSocket (WSS 443)
                      v                                                     v
+---------------------------------------------------+      +----------------------------------------+
|             DATABASE (MongoDB Atlas)              |      |       ESP32 HARDWARE NODES (SIM800L)   |
|  - Users (Credentials, Roles, Assigned Devices)   |      |  - SIM800L 2G/GPRS Cellular Modem      |
|  - DeviceProfiles (MAC, Name, Groups, Allowed)    |      |  - DFPlayer Mini (Audio Prompt Tracks) |
|  - VirtualDevices (Virtual MACs, Talk Time Stats) |      |  - Direct Cloud Socket.IO v4 (WSS 443) |
|  - EspJobs (Queue, Carrier Feedback, Attempts)    |      |  - WiFiManager Captive Portal Fallback |
|  - Campaigns (Voice, SMS, Hybrid, Scheduled)      |      |  - Onboard Web Server (Port 80)        |
|  - SMS Messages (Inbound, Outbound, UCS2 Bengali) |      |  - Dynamic NVS Host Persistence        |
+---------------------------------------------------+      +----------------------------------------+
```

---

## ⚡ Key Features

- **Automated Voice Broadcast Engine**: Dial single or batch phone numbers with automated playback of pre-recorded SD card audio prompts (`0001.mp3`, `0002.mp3`) via DFPlayer Mini.
- **Accurate Telco Carrier Signaling Feedback**: Distinguishes between `ANSWERED`, `REJECTED` (User Determined User Busy / Release Cause 17), `CALL_WAITING` (CW), `FORWARDED` (Voicemail divert), `BUSY`, and `UNREACHABLE`.
- **Zero-Drop Priority FIFO Queue**: When modems are occupied under heavy load, calls buffer in persistent FIFO order with automated 3x exponential backoff retries.
- **Dual Gateway SMS Engine**:
  - **Hardware Gateway**: Native SIM800L modems with 16-bit Bengali UCS2 and standard 7-bit GSM SMS handling.
  - **Cloud Gateway**: Integrated **BulkSMSBD.COM Cloud API** with live credit balance tracking, multi-recipient parsing, and automatic fallback.
- **Interactive Live USSD Console**: Issue codes like `*121#`, `*2#`, or `*566#` from the web UI; handles multi-line responses and decodes UCS2 hex encoding returned by Bangladeshi operators (Grameenphone, Banglalink, Robi, Teletalk).
- **Virtual GSM Modems**: Aggregate multiple physical hardware modems under high-availability virtual identifiers (e.g. `V-MAC:FF:EE:DD:01`) with cumulative talk duration tracking and auto-balancing.
- **Date-to-Date Export Engine**: Filter Voice Calls, Inbound Calls, and SMS records by precise date/time ranges with 1-click **CSV** and vector-sharp **PDF** export.
- **Granular Device Audit Trail**: Complete chronological logging of every configuration edit, manual dial, or SMS event per hardware device.
- **High-Contrast Dark & Light Theme**: WCAG AAA compliant slate palette (`#cbd5e1`, `#94a3b8`) on deep backgrounds (`#0b0f19`) with zero hydration flash.

---

## 🔌 Hardware Wiring & Pinout Guide

```
                               +-------------------+
                               | 5V 2A-3A DC Power |
                               |   Supply Unit     |
                               +---+-----------+---+
                                   |           |
                              +----+           +----+
                              | VCC (+)        | GND (-)
                              v                v
                       +--------------+  +--------------+
                       | LM2596 / DC  |  | Common GND   |
                       | Buck (4.0V)  |  | Rail Bus     |
                       +-------+------+  +-------+------+
                               |                 |
       +-----------------------+                 |
       | 4.0V (Peak 2A)                          |
       v                                         v
+---------------+                        +---------------+
|    SIM800L    |                        |  ESP32 Board  |
|               |                        |  (30/38 Pin)  |
| VCC           |<-- (4.0V from Buck)    |               |
| GND           |<---------------------->| GND           |
| TXD           |----------------------->| GPIO 16 (RX2) |
| RXD           |<--[ 1kΩ / 2kΩ Div ]<---| GPIO 17 (TX2) |
| MICP / MICN   |<--[ 100nF Audio Cap ]<-| GPIO 25 (DAC) |
| SPKP / SPKN   |---[ Voltage Div 3.3V]->| GPIO 34 (ADC) |
| NET / ANT     |---[ Helical Antenna ]  | GPIO 2 (LED)  |
+---------------+                        +-------+-------+
                                                 |
                                 +---------------+---------------+
                                 | GPIO 14 (RX1) | GPIO 27 (TX1) |
                                 +-------+---------------+-------+
                                         |               |
                                         v               v (via 1k resistor)
                                 +---------------+---------------+
                                 |      TX       |      RX       |
                                 |                               |
                                 |         DFPLAYER MINI         |
                                 |                               |
                                 | VCC (5V/3.3V) | GND (Common)  |
                                 | SPK_1 / SPK_2 | MicroSD Card  |
                                 +---------------+---------------+
                                         |
                                         v
                                 +---------------+
                                 | 8Ω 0.5W / 3W  |
                                 | Mini Speaker  |
                                 +---------------+
```

### Complete Pin Connections Table

| Module | Pin Name | Connects To | Functional Notes |
| :--- | :--- | :--- | :--- |
| **SIM800L** | `VCC` | DC Buck Output (**4.0V - 4.2V**) | **MANDATORY**: Requires up to 2A burst current during GSM transmission. |
| **SIM800L** | `GND` | Common Ground Bus | Must share common ground with ESP32 and power supply. |
| **SIM800L** | `TXD` | ESP32 **GPIO 16** (`RX2`) | Hardware UART2 receive line on ESP32. |
| **SIM800L** | `RXD` | ESP32 **GPIO 17** (`TX2`) | Use a 1kΩ:2kΩ resistor divider (SIM800L RX is 2.8V-3.3V tolerant). |
| **SIM800L** | `MICP` | ESP32 **GPIO 25** (`DAC1`) | Decouple with a 100nF (0.1µF) non-polar capacitor. |
| **SIM800L** | `MICN` | Audio Ground | Audio reference ground. |
| **SIM800L** | `SPKP` | ESP32 **GPIO 34** (`ADC1`) | Voltage divider + 100nF capacitor to step down audio level to 3.3V max. |
| **SIM800L** | `SPKN` | Common Ground Bus | Speaker negative terminal. |
| **DFPlayer** | `VCC` | 5V or 3.3V Rail | Power input for audio decoder. |
| **DFPlayer** | `GND` | Common Ground Bus | System ground. |
| **DFPlayer** | `TX` | ESP32 **GPIO 14** (`RX1`) | Hardware UART1 status response line. |
| **DFPlayer** | `RX` | ESP32 **GPIO 27** (`TX1`) | Hardware UART1 command line (insert 1kΩ series resistor to avoid noise). |
| **DFPlayer** | `SPK_1 / SPK_2` | Speaker / SIM800L MIC | Pre-recorded prompt audio playback. |
| **ESP32** | `GPIO 2` | Onboard Blue LED | Status indicator (blinks when idle, solid when cloud-connected). |

---

## 🌐 Cloud Infrastructure & Networking

- **Single Production Cloud Host**: `https://800lcall.espserver.site` (Secure SSL WebSocket on port 443 with Cloudflare edge acceleration).
- **Socket.IO v4 Pure WebSocket Transport**: Uses direct `&transport=websocket&EIO=4` connection, bypassing legacy HTTP polling to ensure sub-50ms latency.
- **Auto-Reconnect Watchdog**: Built-in non-blocking reconnection interval (5000 ms) automatically handles network drops without stalling GSM modem tasks.
- **Cloudflare WAF Compliance**: Compliant `User-Agent: Mozilla/5.0 (ESP32)` header eliminates 403 blocks while adhering to RFC 6455 frame boundaries.

---

## 📁 Directory Structure

```
call_server_sim800l/
├── Farmwire/                      # ESP32 Arduino Firmware
│   ├── callServer.ino             # Main firmware sketch (WiFiManager, Socket.IO, SIM800L, DFPlayer)
│   ├── dayagram.txt               # ASCII hardware circuit diagram & wiring reference
│   └── connection.txt             # Pin connection and logic level reference
├── Server/                        # Node.js Central Backend Server
│   ├── server.js                  # Express, Socket.IO engine, FIFO Queue, BulkSMSBD integration
│   ├── package.json               # Backend dependencies
│   ├── .env                       # Environment configuration (MongoDB URI, JWT secret, Ports)
│   └── API_Documentation.txt      # HTTP REST and Socket.IO protocol specification
├── web/                           # Next.js 16 Fullstack Dashboard
│   ├── src/
│   │   ├── app/                   # App Router pages (/calls, /devices, /sms, /campaigns, /users)
│   │   ├── components/            # Reusable UI components (Navbar, Modals, Badges, ClickToCopy)
│   │   ├── context/DataContext.tsx# Centralized Socket.IO & state management store
│   │   └── utils/pdfExport.ts     # Vector PDF report generation engine
│   ├── package.json               # Frontend dependencies (Next 16, React 19, Tailwind CSS 4)
│   └── README.md                  # Web dashboard specific documentation
├── Dashboard/                     # Standalone Lightweight HTML5/JS Dashboard
│   └── index.html                 # Single-file browser dashboard for emergency operations
├── ProjectFile/                   # System Documentation & Milestone Changelogs
│   ├── Document.txt               # Comprehensive technical architecture & database schemas
│   └── update.txt                 # Step-by-step development milestone history
└── README.md                      # Root system documentation (this file)
```

---

## 🚀 Installation & Quickstart

### Prerequisites
- **Node.js**: v18.x or v20.x LTS installed.
- **MongoDB**: MongoDB Atlas connection string or local MongoDB instance.
- **Arduino CLI** or **Arduino IDE**: ESP32 board package (`esp32:esp32:esp32`) installed.

---

### 1. Backend Server Setup

1. Navigate to the `Server` directory:
   ```bash
   cd Server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `Server/.env`:
   ```env
   PORT=3000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/sim800l?retryWrites=true&w=majority
   JWT_SECRET=your_secure_jwt_secret_key_2026
   JWT_EXPIRES_IN=7d
   ```
4. Start the server:
   ```bash
   node server.js
   ```
   > The server will start on `http://localhost:3000` with WebSocket support enabled.

---

### 2. Next.js Web Dashboard Setup

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev -- -p 3001
   ```
4. Access the dashboard in your browser:
   ```
   http://localhost:3001
   ```

---

### 3. ESP32 Firmware Flashing

#### Required Arduino Libraries
Ensure the following libraries are installed in your Arduino libraries folder:
- `WiFiManager` by tzapu
- `ArduinoJson` (v6.x) by Benoit Blanchon
- `WebSockets` (with Socket.IO v4 support) by Markus Sattler
- `DFRobotDFPlayerMini` by DFRobot
- `Preferences` (built into ESP32 core)

#### Compile & Flash via Arduino CLI
```bash
arduino-cli compile --fqbn esp32:esp32:esp32 --upload -p COM13 "Farmwire/callServer"
```

#### First-Time Wi-Fi Provisioning
1. On initial boot, the ESP32 starts an access point named `ESP32_SIM800_AP`.
2. Connect to this Wi-Fi from your phone or PC (captive portal opens automatically at `http://192.168.4.1`).
3. Select your local 2.4 GHz Wi-Fi network, enter credentials, and save.
4. The ESP32 connects to Wi-Fi and connects to `https://800lcall.espserver.site`.

---

## 🔧 Dynamic Cloud Host Configuration

You can change the target cloud server host dynamically **without reflashing the firmware**:

### Method 1: Local Web Dashboard
1. Open your browser and navigate to the ESP32's local IP:
   ```
   http://<ESP32_IP_ADDRESS>/
   ```
2. Scroll to the **Cloud Server Configuration** card.
3. Enter the new hostname (e.g. `800lcall.espserver.site`).
4. Click **Save & Connect**. The ESP32 saves the host in non-volatile flash memory (NVS) and reconnects immediately.

### Method 2: USB Serial Terminal
Connect a serial terminal (115200 baud) to the ESP32 and send:
```text
SET_HOST=your-custom-server.site
```
To inspect the active host:
```text
GET_HOST
```

---

## 📡 Socket.IO Events & API Reference

### Client -> ESP32 Commands
| Event Name | Payload Format | Description |
| :--- | :--- | :--- |
| `execute_call` | `{"mac": "...", "job_id": "...", "phone": "+88017...", "prompt_track": 1}` | Triggers SIM800L to dial recipient and play prompt. |
| `dashboard_cmd_ussd` | `{"mac": "...", "code": "*121#"}` | Sends USSD command to modem and streams carrier response. |
| `dashboard_cmd_hangup` | `{"mac": "..."}` | Forces immediate call hangup via `ATH`. |
| `dashboard_cmd_reboot` | `{"mac": "..."}` | Performs hardware/software restart of the ESP32. |

### ESP32 -> Server Events
| Event Name | Payload Format | Description |
| :--- | :--- | :--- |
| `esp32_register` | `{"mac": "...", "ip": "...", "version": "1.0.0"}` | Gateway registration upon initial connection. |
| `esp32_telemetry` | `{"mac": "...", "ip": "...", "wifi_rssi": -65, "sim_operator": "GP", "sim_signal": "93%"}` | Periodic vitals heartbeat (every 10 seconds). |
| `call_result` | `{"job_id": "...", "status": "success", "duration_seconds": 45}` | Dispatched when a call finishes, declined, or times out. |
| `dashboard_cmd_result` | `{"mac": "...", "type": "ussd", "code": "*2#", "data": "+CUSD: ...", "decoded": "..."}` | Real-time response payload for USSD inquiries. |

---

## 🛠 Troubleshooting & FAQ

#### Q1: Why does the SIM800L reboot or fail to register on the network?
> **A**: The SIM800L requires up to **2A of peak current** during GSM network negotiation. Powering directly from the ESP32's 3.3V or 5V pin will cause voltage drops and modem brownouts. Always use an external DC-DC step-down buck converter (e.g., LM2596) set to **4.0V - 4.2V** with a shared common ground.

#### Q2: How do I know if my ESP32 is registered on the cloud?
> **A**: Check the serial monitor at 115200 baud. You should see:
> ```text
> [IOc] Initializing Cloud Socket.IO connection...
> [IOc] Connected to url: {"sid":"..."}
> [IOc] Sent esp32_register event: 44:1D:64:BD:22:EC
> ```
> On the dashboard (`http://localhost:3001`), the device will show a glowing green **🟢 ONLINE** badge.

#### Q3: How do I change Wi-Fi credentials if my router changes?
> **A**: If the saved Wi-Fi is unavailable, the ESP32 automatically starts its fallback captive portal `ESP32_SIM800_AP` after 40 seconds. Connect to `http://192.168.4.1` to reconfigure. Alternatively, uncomment `wm.resetSettings();` in the sketch to erase saved credentials.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
