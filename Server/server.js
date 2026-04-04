require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse incoming JSON payloads
app.use(express.urlencoded({ extended: true }));

// --- MongoDB Connection ---
// Default to local MongoDB if URI is not provided in .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sarwarjahanshohid_db_trans:OXAqtShYSdEIbBXG@transformer.7b8ec5a.mongodb.net/?appName=transformer';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Mongoose Schema & Model ---
// This schema defines how an SMS will be saved in the database
const smsSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    message: { type: String, required: true },
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
            await EspJob.insertMany(jobsToCreate);
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

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});