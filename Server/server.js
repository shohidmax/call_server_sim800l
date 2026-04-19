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
            if (!activeDeviceTelemetry.has(mac)) {
                activeDeviceTelemetry.set(mac, { mac, ip: data.ip || 'Unknown', status: 'online', initializedDate: Date.now() });
                broadcastActiveDevices();
            }
            console.log(`✅ ESP32 registered with MAC: ${mac} on socket: ${socket.id}`);
            console.log(`✅ ESP32 registered with MAC: ${mac} on socket: ${socket.id}`);
            // Trigger dispatcher immediately to see if jobs are waiting
            if(typeof dispatchJobs === 'function') dispatchJobs();
        }
    });

    // ESP32 Telemetry Relay
    socket.on('esp32_telemetry', (data) => {
        if (data.mac) {
            data.lastSeen = Date.now();
            activeDeviceTelemetry.set(data.mac, data);
            broadcastActiveDevices(); // Broad cast full state array
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
                timestamp: new Date().toLocaleString()
            });
            const savedSms = await newSms.save();
            
            io.emit('sms_update', { type: 'new_sms', sms: savedSms });
            relayToESP(data.mac, 'esptarget_cmd_sendsms', data);
        } catch(err) { console.error('Error saving outbound SMS:', err); }
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

    // Relayed generic manual command results (like USSD responses)
    socket.on('esp32_cmd_result', (data) => {
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
                activeDeviceTelemetry.delete(mac);
                broadcastActiveDevices();
                console.log(`🔻 ESP32 MAC ${mac} disconnected`);
                break;
            }
        }
    });
});

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
    timestamp: { type: String }, // Time reported by SIM800L
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