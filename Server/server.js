require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Initialize Express App
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

// Socket.IO Logic
const connectedESP32s = new Map();
const activeDeviceTelemetry = new Map(); // Store latest telemetry for each MAC

// Helper function to broadcast all active devices
const broadcastActiveDevices = async () => {
    try {
        const devicesArray = Array.from(activeDeviceTelemetry.values());
        
        // Fetch profiles if Mongoose is ready
        let DeviceProfile;
        try { DeviceProfile = mongoose.model('DeviceProfile'); } catch(e) {}
        
        let enrichedDevices = devicesArray;
        if (DeviceProfile && mongoose.connection.readyState === 1) { // MUST BE CONNECTED TO DB
            try {
                const profiles = await DeviceProfile.find().maxTimeMS(2000); // Prevent hanging
                enrichedDevices = devicesArray.map(device => {
                    const profile = profiles.find(p => p.mac === device.mac);
                    if (profile) {
                        return { ...device, name: profile.name, group: profile.group, allowedUsers: profile.allowedUsers };
                    }
                    return { ...device, name: 'Unnamed ESP32', group: 'Uncategorized', allowedUsers: [] };
                });
            } catch(dbErr) {
               console.error("DB Timeout fetching profiles, using raw array.");
            }
        }
        io.emit('active_devices_update', enrichedDevices);
    } catch (err) { console.error('Error broadcasting:', err); }
};

io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);
    
    // Immediately send current devices to new client
    socket.emit('active_devices_update', Array.from(activeDeviceTelemetry.values()));

    // ESP32 Registration
    socket.on('esp32_register', (data) => {
        const mac = data.mac;
        if (mac) {
            connectedESP32s.set(mac, socket.id);
            const existing = activeDeviceTelemetry.get(mac) || {};
            activeDeviceTelemetry.set(mac, { 
                ...existing, 
                mac, 
                ip: data.ip || existing.ip || 'Unknown', 
                status: 'online', 
                lastSeen: Date.now(),
                initializedDate: existing.initializedDate || Date.now() 
            });
            broadcastActiveDevices();
            console.log(`✅ ESP32 registered with MAC: ${mac} on socket: ${socket.id} (Status: ONLINE)`);
            // Trigger dispatcher immediately to see if jobs are waiting
            if(typeof dispatchJobs === 'function') dispatchJobs();
        }
    });

    // ESP32 Telemetry Relay
    socket.on('esp32_telemetry', (data) => {
        if (data.mac) {
            data.lastSeen = Date.now();
            data.status = 'online';
            const existing = activeDeviceTelemetry.get(data.mac) || {};
            activeDeviceTelemetry.set(data.mac, { ...existing, ...data, status: 'online' });
            broadcastActiveDevices(); // Broadcast full state array
        }
        io.emit('telemetry_update', data); // Keep backwards compatible relay
    });

    // --- MANUAL CONTROL EVENTS (Dashboard -> ESP32) ---
    const relayToESP = (mac, eventName, payload) => {
        const espSocketId = connectedESP32s.get(mac);
        if (espSocketId) {
            io.to(espSocketId).emit(eventName, payload);
            console.log(`📡 Relayed ${eventName} to ESP32 MAC ${mac}`);
        } else {
            console.log(`⚠️ Failed to relay ${eventName}. ESP32 MAC ${mac} offline.`);
            if (eventName === 'esptarget_cmd_ussd') {
                socket.emit('dashboard_cmd_result', {
                    mac,
                    type: 'ussd',
                    code: payload?.code,
                    data: `[Error: Device Offline] Device (${mac}) is not connected to this backend server instance. Please switch your dashboard server to the cloud server (sim800l.maxapi.esp32.site) where this ESP32 is connected.`
                });
            }
        }
    };

    socket.on('dashboard_cmd_dial', (data) => relayToESP(data.mac, 'esptarget_cmd_dial', data));
    socket.on('dashboard_cmd_hangup', (data) => relayToESP(data.mac, 'esptarget_cmd_hangup', data));
    socket.on('dashboard_cmd_ussd', (data) => relayToESP(data.mac, 'esptarget_cmd_ussd', data));
    socket.on('dashboard_cmd_flightmode', (data) => relayToESP(data.mac, 'esptarget_cmd_flightmode', data));
    socket.on('dashboard_cmd_reboot', (data) => relayToESP(data.mac, 'esptarget_cmd_reboot', data));
    
    // Outbound SMS from Dashboard -> DB -> ESP32
    socket.on('dashboard_send_sms', async (data) => {
        try {
            const newSms = new SMS({
                sender: data.phone, // Sent *to* this number, but stored under sender field for UI simplicity
                message: data.message,
                direction: 'out',
                gateway: 'sim800l',
                mac: data.mac,
                timestamp: new Date().toLocaleString()
            });
            const savedSms = await newSms.save();
            
            io.emit('sms_update', { type: 'new_sms', sms: savedSms });
            relayToESP(data.mac, 'esptarget_cmd_sendsms', data);
        } catch(err) { console.error('Error saving outbound SMS:', err); }
    });

    // Outbound Bulk SMS via BulkSMSBD Cloud Gateway
    socket.on('dashboard_send_bulksms', async (data) => {
        try {
            const result = await sendViaBulkSmsBd(data);
            socket.emit('bulksms_result', result);
        } catch (err) {
            console.error('Error sending BulkSMSBD via socket:', err);
            socket.emit('bulksms_result', { success: false, error_message: err.message });
        }
    });

    // Helper function to detect and decode SIM800L UCS2 Hex strings (e.g. for Bengali SMS)
    const decodeUCS2 = (str) => {
        if (!str || typeof str !== 'string' || str.length % 4 !== 0 || !/^[0-9A-Fa-f]+$/.test(str)) {
            return str; // Return original if not perfectly forming a UCS2 hex string
        }
        let result = '';
        for (let i = 0; i < str.length; i += 4) {
            result += String.fromCharCode(parseInt(str.substr(i, 4), 16));
        }
        
        // Sometimes short english words happen to be valid Hex (like "FEED"). 
        // We ensure we don't accidentally ruin them if they decode to unprintable garbage.
        // A standard Bengali text will decode cleanly.
        if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result)) return str; 
        
        return result;
    };

    // Inbound Live SMS from ESP32 -> DB -> Dashboard
    socket.on('hardware_incoming_sms', async (data) => {
        try {
            const newSms = new SMS({
                sender: decodeUCS2(data.sender),
                message: decodeUCS2(data.message),
                direction: 'in',
                timestamp: data.timestamp
            });
            const savedSms = await newSms.save();
            io.emit('sms_update', { type: 'new_sms', sms: savedSms });
        } catch(err) { console.error('Error saving hardware SMS:', err); }
    });

    // Helper function to decode UCS2 hex text within +CUSD USSD messages
    const decodeUssdPayload = (raw) => {
        if (!raw || typeof raw !== 'string') return raw;
        const quoteMatch = raw.match(/"([^"]+)"/);
        if (quoteMatch && quoteMatch[1]) {
            const inner = quoteMatch[1];
            if (inner.length >= 4 && inner.length % 4 === 0 && /^[0-9A-Fa-f]+$/.test(inner)) {
                let decoded = '';
                for (let i = 0; i < inner.length; i += 4) {
                    decoded += String.fromCharCode(parseInt(inner.substr(i, 4), 16));
                }
                if (!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)) {
                    return raw.replace(`"${inner}"`, `"${decoded}"`);
                }
            }
        }
        return raw;
    };

    // Relayed generic manual command results (like USSD responses)
    socket.on('esp32_cmd_result', (data) => {
        if (data && data.type === 'ussd' && data.data) {
            data.decoded = decodeUssdPayload(data.data);
            console.log(`📡 Relayed USSD response from MAC: ${data.mac || 'ESP32'} (Code: ${data.code || '-'}):`, data.decoded);
        }
        io.emit('dashboard_cmd_result', data);
    });

    // ESP32 reports call result
    socket.on('call_result', async (data) => {
        const { job_id, status } = data;
        if (!job_id || !status) return;

        try {
            let actualStatus = status;
            
            // If it failed due to hardware error, release the job back to the global pool! (Failover)
            if (status === 'hardware_error') {
                actualStatus = 'pending';
            }

            const updateData = { status: actualStatus };
            if (actualStatus === 'pending') {
                updateData.mac = null; // Unbind MAC so any free ESP32 can pick it up
            }

            const updatedJob = await EspJob.findByIdAndUpdate(job_id, updateData, { new: true });
            
            console.log(`📞 Call Result for ${updatedJob?.phone || 'unknown'}: ${status.toUpperCase()}`);
            
            // Notify dashboards
            io.emit('dashboard_update', { type: 'job_update', job: updatedJob });

            // Free the ESP32 that just finished so it can take another call
            let callerMac = null;
            for (const [m, sId] of connectedESP32s.entries()) {
                if (sId === socket.id) { callerMac = m; break; }
            }
            if (callerMac && activeDeviceTelemetry.has(callerMac)) {
                const telem = activeDeviceTelemetry.get(callerMac);
                telem.isBusy = false;
                activeDeviceTelemetry.set(callerMac, telem);
            }

            // Immediately check for next jobs across the cluster
            if(typeof dispatchJobs === 'function') dispatchJobs();
        } catch (error) {
            console.error('Error handling call_result via socket:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        for (const [mac, id] of connectedESP32s.entries()) {
            if (id === socket.id) {
                connectedESP32s.delete(mac);
                const existing = activeDeviceTelemetry.get(mac) || { mac };
                const offlineTimestamp = Date.now();
                existing.status = 'offline';
                existing.lastOffline = offlineTimestamp;
                activeDeviceTelemetry.set(mac, existing);
                broadcastActiveDevices();
                io.emit('telemetry_update', { 
                    mac, 
                    status: 'offline', 
                    lastOffline: offlineTimestamp 
                });
                console.log(`🔻 ESP32 MAC ${mac} disconnected - Marked OFFLINE (lastOffline: ${new Date(offlineTimestamp).toISOString()})`);
                break;
            }
        }
    });
});

// Periodic device stale / offline watchdog (every 10 seconds)
setInterval(() => {
    let changed = false;
    const now = Date.now();
    for (const [mac, dev] of activeDeviceTelemetry.entries()) {
        const isSocketAlive = connectedESP32s.has(mac);
        // If device was online but socket dropped or no telemetry for > 35s
        if (dev.status === 'online') {
            if (!isSocketAlive || (dev.lastSeen && (now - dev.lastSeen > 35000))) {
                dev.status = 'offline';
                dev.lastOffline = dev.lastSeen || now;
                changed = true;
                console.log(`⏱️ Watchdog: Device ${mac} unresponsive for >35s. Marked OFFLINE at ${new Date(dev.lastOffline).toISOString()}.`);
                io.emit('telemetry_update', { mac, status: 'offline', lastOffline: dev.lastOffline });
            }
        }
    }
    if (changed) {
        broadcastActiveDevices();
    }
}, 10000);

// Global Load Balancer Dispatcher
const dispatchJobs = async () => {
    try {
        const freeMacs = [];
        for (const [mac, telemetry] of activeDeviceTelemetry.entries()) {
            // Check if device is free and socket actually connected
            if (!telemetry.isBusy && connectedESP32s.has(mac)) {
                freeMacs.push(mac);
            }
        }
        
        for (const mac of freeMacs) {
            // Find an open job (bound to this mac OR floating)
            const pendingJob = await EspJob.findOneAndUpdate(
                { status: 'pending', $or: [{ mac: mac }, { mac: null }, { mac: "" }] },
                { status: 'calling', mac: mac },
                { sort: { createdAt: 1 }, new: true }
            );

            if (pendingJob) {
                // Lock this MAC locally immediately so we don't spam it in the loop
                const telemetry = activeDeviceTelemetry.get(mac);
                telemetry.isBusy = true;
                activeDeviceTelemetry.set(mac, telemetry);

                const espSocketId = connectedESP32s.get(mac);
                io.to(espSocketId).emit('execute_call', {
                    job_id: pendingJob._id.toString(),
                    phone_to_call: pendingJob.phone,
                    audio: pendingJob.audio || null
                });
                
                io.emit('dashboard_update', { type: 'job_update', job: pendingJob });
                console.log(`🚀 [Load Balancer] Pushed job ${pendingJob._id} to ESP32 ${mac}`);
            }
        }
    } catch(e) { console.error('Dispatch error:', e); }
};

// Check dispatch queue routinely for safety
setInterval(dispatchJobs, 3000);


// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse incoming JSON payloads
app.use(express.urlencoded({ extended: true }));

// --- MongoDB Connection ---
// Default to local MongoDB if URI is not provided in .env
const MONGO_URI = process.env.MONGO_URI || 'ffffff';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Mongoose Schema & Model ---
// This schema defines how an SMS will be saved in the database
const smsSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    message: { type: String, required: true },
    direction: { type: String, enum: ['in', 'out'], default: 'in' },
    gateway: { type: String, enum: ['sim800l', 'bulksmsbd'], default: 'sim800l' },
    senderId: { type: String },
    mac: { type: String },
    status: { type: String, enum: ['delivered', 'failed', 'pending'], default: 'delivered' },
    timestamp: { type: String }, // Time reported by SIM800L or server
    receivedAt: { type: Date, default: Date.now } // Time saved to database
});

const SMS = mongoose.model('SMS', smsSchema);

// --- Device Profile Schema & Model ---
const deviceProfileSchema = new mongoose.Schema({
    mac: { type: String, required: true, unique: true },
    name: { type: String, default: 'Unnamed ESP32' },
    group: { type: String, default: 'Uncategorized' },
    allowedUsers: [{ type: String }], // Comma separated or array of User IDs
    registeredAt: { type: Date, default: Date.now }
});
const DeviceProfile = mongoose.model('DeviceProfile', deviceProfileSchema);

// --- Broadcast/Alert Schema & Model ---
// This schema matches your specific JSON payload structure
const broadcastSchema = new mongoose.Schema({
    user_id: { type: String },
    phone: { type: String },
    mac: { type: String },
    phone_call_list: [{ type: String }], // Updated to match the new JSON array name
    payload: {
        address: { type: String },
        message: { type: String }
    },
    response: [{ type: mongoose.Schema.Types.Mixed }], // Mixed type to allow dynamic keys like {"0179...": "success"}
    createdAt: { type: Date, default: Date.now } // Time saved to database
});

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

// --- ESP32 Call Job Schema ---
// This schema creates a queue of individual phone calls for the ESP32 to make
const espJobSchema = new mongoose.Schema({
    mac: { type: String, required: false }, // Optional, allowing floating jobs
    phone: { type: String, required: true },
    audio: { type: String, required: false }, // Track number (e.g. "0001") for DFPlayer
    status: { type: String, enum: ['pending', 'calling', 'success', 'fail', 'failed', 'hardware_error', 'busy', 'received', 'number_off', 'unreachable'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const EspJob = mongoose.model('EspJob', espJobSchema);

// --- API Routes ---

// 1. Basic Server Check
app.get('/', (req, res) => {
    res.send('ESP32 SIM800L Backend Server is running!');
});

// 2. POST Route: Save a new SMS (ESP32 will send data here)
app.post('/api/sms', async (req, res) => {
    try {
        const { sender, message, timestamp } = req.body;

        if (!sender || !message) {
            return res.status(400).json({ error: 'Sender and message are required' });
        }

        // Helper function for the HTTP route as well
        const decodeUCS2 = (str) => {
            if (!str || typeof str !== 'string' || str.length % 4 !== 0 || !/^[0-9A-Fa-f]+$/.test(str)) {
                return str; 
            }
            let result = '';
            for (let i = 0; i < str.length; i += 4) {
                result += String.fromCharCode(parseInt(str.substr(i, 4), 16));
            }
            if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result)) return str; 
            return result;
        };

        const newSms = new SMS({ 
            sender: decodeUCS2(sender), 
            message: decodeUCS2(message), 
            timestamp 
        });
        const savedSms = await newSms.save();

        console.log(`📩 New SMS saved from ${sender}`);
        io.emit('sms_update', { type: 'new_sms', sms: savedSms }); // Real-time emit
        res.status(201).json({ success: true, data: savedSms });
    } catch (error) {
        console.error('Error saving SMS:', error);
        res.status(500).json({ error: 'Failed to save SMS' });
    }
});

// 3. GET Route: Fetch all saved SMS messages
app.get('/api/sms', async (req, res) => {
    try {
        // Fetch all SMS, sorted by newest first
        const messages = await SMS.find().sort({ receivedAt: -1 });
        res.status(200).json({ success: true, count: messages.length, data: messages });
    } catch (error) {
        console.error('Error fetching SMS:', error);
        res.status(500).json({ error: 'Failed to fetch SMS' });
    }
});

// --- BulkSMSBD.COM Cloud Gateway Integration ---
let runtimeBulkSmsConfig = {
    apiKey: process.env.BULKSMSBD_API_KEY || 'MS6MfGTEVrHaCJUQ5vAU',
    senderId: process.env.BULKSMSBD_SENDER_ID || '8809617618888'
};

const BULKSMSBD_ERRORS = {
    202: 'SMS Submitted Successfully',
    1001: 'Invalid Number',
    1002: 'Sender ID not correct or sender id is disabled',
    1003: 'Please Required all fields / Contact Your System Administrator',
    1005: 'Internal Error',
    1006: 'Balance Validity Not Available',
    1007: 'Balance Insufficient',
    1011: 'User id not found in this API key',
    1012: 'Masking SMS must be sent in Bengali',
    1013: 'Sender ID has not found Gateway by API key',
    1014: 'Sender Type Name not found using this sender by API key',
    1015: 'Sender ID has not found Any Valid Gateway by API key',
    1016: 'Sender Type Name Active Price Info not found by this sender ID',
    1017: 'Sender Type Name Price Info not found by this sender ID',
    1018: 'The Owner of this username Account is disabled',
    1019: 'The sender type name Price of this username Account is disabled',
    1020: 'The parent of this account is not found',
    1021: 'The parent active sender type name price of this account is not found',
    1031: 'Your Account Not Verified, Please Contact Administrator',
    1032: 'IP Not Whitelisted'
};

function formatBdNumber(raw) {
    if (!raw) return '';
    let cleaned = String(raw).replace(/[^\d+]/g, '').trim();
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('880')) return cleaned;
    if (cleaned.startsWith('0')) return '88' + cleaned;
    if (cleaned.length === 10 && cleaned.startsWith('1')) return '880' + cleaned;
    return cleaned;
}

async function getBulkSmsBdBalance(apiKey) {
    const key = apiKey || runtimeBulkSmsConfig.apiKey;
    const apiUrl = `http://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(key)}`;
    const apiRes = await fetch(apiUrl, { method: 'GET' });
    const json = await apiRes.json();
    const meaning = BULKSMSBD_ERRORS[json.response_code] || json.error_message || '';
    return {
        success: json.response_code === 202,
        ...json,
        meaning
    };
}

async function sendViaBulkSmsBd({ numbers, message, senderId, apiKey }) {
    const key = apiKey || runtimeBulkSmsConfig.apiKey;
    const sender = senderId || runtimeBulkSmsConfig.senderId;

    let rawList = [];
    if (Array.isArray(numbers)) {
        rawList = numbers;
    } else if (typeof numbers === 'string') {
        rawList = numbers.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    }

    const formattedNumbers = rawList.map(formatBdNumber).filter(n => n.length >= 11);
    if (formattedNumbers.length === 0) {
        return { success: false, response_code: 1001, error_message: 'No valid mobile numbers provided', meaning: BULKSMSBD_ERRORS[1001] };
    }
    if (!message || !message.trim()) {
        return { success: false, response_code: 1003, error_message: 'Message content cannot be empty', meaning: BULKSMSBD_ERRORS[1003] };
    }

    const numberParam = formattedNumbers.join(',');
    const queryParams = new URLSearchParams({
        api_key: key,
        type: 'text',
        number: numberParam,
        senderid: sender,
        message: message.trim()
    });

    const apiUrl = `http://bulksmsbd.net/api/smsapi?${queryParams.toString()}`;
    const apiRes = await fetch(apiUrl, { method: 'POST' });
    const json = await apiRes.json();

    const isSuccess = json.response_code === 202;
    const meaning = BULKSMSBD_ERRORS[json.response_code] || json.error_message || json.success_message || 'Unknown response';

    // Save outbound SMS records to database and broadcast to real-time clients
    for (const num of formattedNumbers) {
        try {
            const record = new SMS({
                sender: num,
                message: message.trim(),
                direction: 'out',
                gateway: 'bulksmsbd',
                senderId: sender,
                status: isSuccess ? 'delivered' : 'failed',
                timestamp: new Date().toLocaleString()
            });
            const saved = await record.save();
            io.emit('sms_update', { type: 'new_sms', sms: saved });
        } catch (dbErr) {
            console.error('Failed saving BulkSMS record:', dbErr);
        }
    }

    return {
        success: isSuccess,
        response_code: json.response_code,
        message_id: json.message_id,
        error_message: json.error_message,
        success_message: json.success_message,
        meaning,
        recipient_count: formattedNumbers.length,
        recipients: formattedNumbers
    };
}

// BulkSMSBD: Check Account Credit Balance
app.get('/api/sms/bulksmsbd/balance', async (req, res) => {
    try {
        const apiKey = req.query.api_key;
        const result = await getBulkSmsBdBalance(apiKey);
        res.json(result);
    } catch (err) {
        console.error('BulkSMSBD balance check failed:', err);
        res.status(500).json({ success: false, error_message: err.message });
    }
});

// BulkSMSBD: Dispatch SMS Blast / Message
app.post('/api/sms/bulksmsbd/send', async (req, res) => {
    try {
        const { numbers, message, senderId, apiKey } = req.body;
        const result = await sendViaBulkSmsBd({ numbers, message, senderId, apiKey });
        res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error('BulkSMSBD send failed:', err);
        res.status(500).json({ success: false, error_message: err.message });
    }
});

// BulkSMSBD: Get / Update Runtime Configuration
app.get('/api/sms/bulksmsbd/config', (req, res) => {
    res.json({
        apiKey: runtimeBulkSmsConfig.apiKey,
        senderId: runtimeBulkSmsConfig.senderId
    });
});

app.post('/api/sms/bulksmsbd/config', (req, res) => {
    const { apiKey, senderId } = req.body;
    if (apiKey) runtimeBulkSmsConfig.apiKey = apiKey.trim();
    if (senderId) runtimeBulkSmsConfig.senderId = senderId.trim();
    res.json({
        success: true,
        message: 'BulkSMSBD credentials updated',
        config: {
            apiKey: runtimeBulkSmsConfig.apiKey,
            senderId: runtimeBulkSmsConfig.senderId
        }
    });
});

// 4. POST Route: Save the Broadcast Request AND Queue Calls for ESP32
app.post('/api/broadcast', async (req, res) => {
    try {
        const { user_id, phone, mac, phone_call_list, payload, response } = req.body;

        // 1. Save the main broadcast JSON
        const newBroadcast = new Broadcast({
            user_id, phone, mac, phone_call_list, payload, response
        });
        const savedBroadcast = await newBroadcast.save();

        // 2. Break down the phone list and queue individual jobs for the ESP32
        if (phone_call_list && phone_call_list.length > 0) {
            const assignedMac = mac && mac.trim() !== '' ? mac.trim() : null;
            const audioTrack = payload && payload.audio ? payload.audio : null;
            const jobsToCreate = phone_call_list.map(num => ({
                mac: assignedMac,
                phone: num,
                audio: audioTrack,
                status: 'pending'
            }));
            const insertedJobs = await EspJob.insertMany(jobsToCreate);
            
            // Send newly created jobs to all dashboards
            io.emit('dashboard_update', { type: 'new_jobs', jobs: insertedJobs });

            // Trigger global dispatcher immediately
            if(typeof dispatchJobs === 'function') dispatchJobs();
        }

        console.log(`📡 Broadcast saved & ${phone_call_list?.length} calls queued globally.`);
        res.status(201).json({ success: true, message: 'Broadcast saved & calls queued', data: savedBroadcast });
    } catch (error) {
        console.error('Error saving broadcast report:', error);
        res.status(500).json({ error: 'Failed to save broadcast data' });
    }
});

// 5. GET Route: ESP32 fetches the next pending call (Polling)
app.get('/api/esp32/pending-calls/:mac', async (req, res) => {
    try {
        const { mac } = req.params;

        // Find ONE pending call for this specific ESP32 MAC address
        // Immediately mark it as 'calling' so it isn't fetched twice
        const pendingJob = await EspJob.findOneAndUpdate(
            { mac: mac, status: 'pending' },
            { status: 'calling' },
            { new: true } // Return the updated document
        );

        if (!pendingJob) {
            return res.status(200).json({ has_job: false, message: 'No pending calls' });
        }

        console.log(`⏳ ESP32 fetched job. Calling: ${pendingJob.phone}`);
        res.status(200).json({
            has_job: true,
            job_id: pendingJob._id,
            phone_to_call: pendingJob.phone
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 6. POST Route: ESP32 reports back if the call was successful or failed
app.post('/api/esp32/call-result', async (req, res) => {
    try {
        const { job_id, status } = req.body; // status should be 'success' or 'fail'

        if (!job_id || !status) {
            return res.status(400).json({ error: 'job_id and status are required' });
        }

        // Update the job with the final result
        const updatedJob = await EspJob.findByIdAndUpdate(
            job_id,
            { status: status },
            { new: true }
        );

        if (!updatedJob) {
            return res.status(404).json({ error: 'Job not found' });
        }

        console.log(`📞 Call Result for ${updatedJob.phone}: ${status.toUpperCase()}`);
        res.status(200).json({ success: true, message: 'Result updated successfully' });
    } catch (error) {
        console.error('Error updating call result:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 7. GET Route: Fetch all pending & recent jobs for dashboard initialization
app.get('/api/jobs', async (req, res) => {
    try {
        const jobs = await EspJob.find().sort({ createdAt: -1 }).limit(100);
        res.status(200).json({ success: true, data: jobs });
    } catch(err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. GET Route: Fetch all device profiles (for registry tab)
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await DeviceProfile.find().sort({ registeredAt: -1 });
        res.status(200).json({ success: true, data: devices });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 9. POST Route: Save or Update Device Profile (Name, Group, Users)
app.post('/api/devices', async (req, res) => {
    try {
        const { mac, name, group, allowedUsers } = req.body;
        if (!mac) return res.status(400).json({ error: 'MAC required' });

        const updatedDevice = await DeviceProfile.findOneAndUpdate(
            { mac: mac },
            { name, group, allowedUsers },
            { new: true, upsert: true }
        );
        
        // Re-broadcast so everyone sees the new name/group instantly
        broadcastActiveDevices();
        
        res.status(200).json({ success: true, data: updatedDevice });
    } catch (error) {
        console.error('Update Profile error:', error);
        res.status(500).json({ error: 'Failed to update device' });
    }
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});