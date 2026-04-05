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

io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // ESP32 Registration
    socket.on('esp32_register', (data) => {
        const mac = data.mac;
        if (mac) {
            connectedESP32s.set(mac, socket.id);
            console.log(`✅ ESP32 registered with MAC: ${mac} on socket: ${socket.id}`);
            // Trigger next job if any exist when it re/connects
            sendNextJobToESP32(mac);
        }
    });

    // ESP32 Telemetry Relay
    socket.on('esp32_telemetry', (data) => {
        io.emit('telemetry_update', data);
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

    // Inbound Live SMS from ESP32 -> DB -> Dashboard
    socket.on('hardware_incoming_sms', async (data) => {
        try {
            const newSms = new SMS({
                sender: data.sender,
                message: data.message,
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
            const updatedJob = await EspJob.findByIdAndUpdate(job_id, { status }, { new: true });
            console.log(`📞 Call Result for ${updatedJob?.phone || 'unknown'}: ${status.toUpperCase()}`);
            
            // Notify dashboards
            io.emit('dashboard_update', { type: 'job_update', job: updatedJob });

            // Fetch and send the next job for this ESP32
            if (updatedJob && updatedJob.mac) {
                sendNextJobToESP32(updatedJob.mac);
            }
        } catch (error) {
            console.error('Error handling call_result via socket:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        for (const [mac, id] of connectedESP32s.entries()) {
            if (id === socket.id) {
                connectedESP32s.delete(mac);
                console.log(`🔻 ESP32 MAC ${mac} disconnected`);
                break;
            }
        }
    });
});

// Helper function to send next job via Socket
async function sendNextJobToESP32(mac) {
    const espSocketId = connectedESP32s.get(mac);
    if (!espSocketId) return;

    try {
        const pendingJob = await EspJob.findOneAndUpdate(
            { mac: mac, status: 'pending' },
            { status: 'calling' },
            { new: true }
        );

        if (pendingJob) {
            io.to(espSocketId).emit('execute_call', {
                job_id: pendingJob._id,
                phone_to_call: pendingJob.phone
            });
            io.emit('dashboard_update', { type: 'job_update', job: pendingJob });
            console.log(`⏳ Pushed job ${pendingJob._id} to ESP32 ${mac}`);
        }
    } catch (e) {
        console.error('Error sending next job to ESP32:', e);
    }
}


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
    mac: { type: String, required: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ['pending', 'calling', 'success', 'fail'], default: 'pending' },
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

        const newSms = new SMS({ sender, message, timestamp });
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
        if (mac && phone_call_list && phone_call_list.length > 0) {
            const jobsToCreate = phone_call_list.map(num => ({
                mac: mac,
                phone: num,
                status: 'pending'
            }));
            const insertedJobs = await EspJob.insertMany(jobsToCreate);
            
            // Send newly created jobs to all dashboards
            io.emit('dashboard_update', { type: 'new_jobs', jobs: insertedJobs });

            // Push first pending job directly to the specific ESP32
            sendNextJobToESP32(mac);
        }

        console.log(`📡 Broadcast saved & calls queued for MAC: ${mac}`);
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

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});