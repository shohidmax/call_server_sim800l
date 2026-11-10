'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Device, DeviceGroup, VirtualDevice, DeviceBridge, DeviceShare, DeviceActivityEvent } from '@/types/device';
import { CallJob, IncomingCall, BlockedNumber, AudioTrack, CallFeedback } from '@/types/call';
import { SMSMessage, BulkSmsBdConfig, BulkSmsSendResult } from '@/types/sms';
import { User, UserBehaviorLog } from '@/types/user';
import { Campaign, CampaignRecipient } from '@/types/campaign';
import { useAuth } from './AuthContext';
import { io, Socket } from 'socket.io-client';

interface DataContextType {
  // State
  devices: Device[];
  groups: DeviceGroup[];
  virtualDevices: VirtualDevice[];
  bridges: DeviceBridge[];
  callJobs: CallJob[];
  incomingCalls: IncomingCall[];
  smsMessages: SMSMessage[];
  blockedNumbers: BlockedNumber[];
  audioTracks: AudioTrack[];
  complaints: CallFeedback[];
  behaviorLogs: UserBehaviorLog[];
  deviceEvents: DeviceActivityEvent[];
  campaigns: Campaign[];
  serverConnected: boolean;
  activeServerUrl: string;
  switchServer: (url: string) => void;

  // Actions
  addDevice: (device: Partial<Device>) => void;
  updateDevice: (mac: string, updates: Partial<Device>) => void;
  deleteDevice: (mac: string) => void;
  shareDevice: (mac: string, share: DeviceShare) => void;
  getDeviceEvents: (mac: string) => DeviceActivityEvent[];
  recordDeviceEvent: (event: Omit<DeviceActivityEvent, 'id' | 'timestamp'>) => void;
  
  createGroup: (group: Omit<DeviceGroup, 'id' | 'createdAt' | 'activeCallCount'>) => void;
  deleteGroup: (id: string) => void;
  createVirtualDevice: (vdev: Omit<VirtualDevice, 'id' | 'createdAt'>) => void;
  deleteVirtualDevice: (id: string) => void;
  createBridge: (bridge: Omit<DeviceBridge, 'id'>) => void;
  toggleBridge: (id: string) => void;

  triggerCall: (mac: string, phone: string, audio?: string) => Promise<boolean>;
  triggerHangup: (mac: string) => Promise<boolean>;
  triggerUssd: (mac: string, code: string) => Promise<string>;
  triggerSms: (mac: string, phone: string, message: string) => Promise<boolean>;
  triggerReboot: (mac: string) => Promise<boolean>;
  triggerFlightMode: (mac: string, state: boolean) => Promise<boolean>;

  triggerBroadcast: (phoneList: string[], options: { 
    mac?: string; 
    virtualId?: string;
    isAnonymous?: boolean;
    anonymousId?: string;
    groupId?: string; 
    audio?: string;
    recipientNames?: Record<string, string>;
  }) => Promise<void>;
  // Call Job Actions
  updateCallJob: (id: string, updates: Partial<CallJob>) => void;
  deleteCallJob: (id: string) => void;
  deleteCallJobs: (ids: string[]) => void;
  clearAllCallJobs: () => void;

  // Group & Virtual Device Actions
  updateGroup: (id: string, updates: Partial<DeviceGroup>) => void;
  updateVirtualDevice: (id: string, updates: Partial<VirtualDevice>) => void;

  // SMS Actions
  deleteSms: (id: string) => void;
  deleteSmsThread: (phoneNumber: string) => void;
  clearAllSms: () => void;
  bulkSmsConfig: BulkSmsBdConfig;
  fetchBulkSmsBalance: (customKey?: string) => Promise<{ success: boolean; balance?: string; error?: string; meaning?: string; response_code?: number }>;
  sendBulkSmsBd: (numbers: string[], message: string, senderId?: string, apiKey?: string) => Promise<BulkSmsSendResult>;
  updateBulkSmsConfig: (apiKey: string, senderId: string) => Promise<boolean>;

  // Blocked Numbers
  addBlockedNumber: (number: Omit<BlockedNumber, 'id' | 'blockedAt'>) => void;
  updateBlockedNumber: (id: string, updates: Partial<BlockedNumber>) => void;
  toggleBlockedNumber: (id: string) => void;
  removeBlockedNumber: (id: string) => void;

  // Audio Tracks
  uploadAudioTrack: (track: Omit<AudioTrack, 'id' | 'uploadedAt'>) => void;
  updateAudioTrack: (id: string, updates: Partial<AudioTrack>) => void;
  deleteAudioTrack: (id: string) => void;

  // Complaints / Feedback
  submitComplaint: (complaint: Omit<CallFeedback, 'id' | 'createdAt'>) => void;
  updateComplaintStatus: (id: string, status: CallFeedback['status']) => void;
  deleteComplaint: (id: string) => void;

  // Campaign Actions
  createCampaign: (data: Omit<Campaign, 'id' | 'createdAt' | 'completedCount' | 'successCount' | 'failedCount' | 'recipients' | 'totalRecipients'> & { recipientList: { phone: string; name?: string }[] }) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  startCampaign: (id: string) => void;
  pauseCampaign: (id: string) => void;
  resumeCampaign: (id: string) => void;
  deleteCampaign: (id: string) => void;

  // Audit Events
  deleteDeviceEvent: (id: string) => void;
  clearDeviceEvents: (mac?: string) => void;

  // Incoming Call Actions
  deleteIncomingCall: (id: string) => void;
  clearIncomingCalls: () => void;

  // Behavior Audit Logs Actions
  deleteBehaviorLog: (id: string) => void;
  clearBehaviorLogs: () => void;
}

const INITIAL_DEVICES: Device[] = [
  {
    mac: '44:1D:64:BD:22:EC',
    name: 'Primary Gateway (SIM800L Node 1)',
    group: 'Farm Main Cluster',
    ip: '192.168.1.105',
    wifi_rssi: -58,
    sim_operator: 'Grameenphone',
    sim_signal: '88%',
    sim_number: '+8801731626274',
    status: 'online',
    battery: 92,
    lastSeen: Date.now(),
    allowedUsers: ['admin@sim800l.local', 'manager@sim800l.local'],
    sharedWith: [
      {
        userId: 'usr_mgr_02',
        userEmail: 'manager@sim800l.local',
        permissions: { canDial: true, canSms: true, canView: true, canReboot: false },
        sharedAt: '2026-03-01T10:00:00Z'
      }
    ]
  },
  {
    mac: '24:0A:C4:AA:BB:CC',
    name: 'Backup SIM800L (Node 2)',
    group: 'Farm Main Cluster',
    ip: '192.168.1.112',
    wifi_rssi: -66,
    sim_operator: 'Banglalink',
    sim_signal: '75%',
    sim_number: '+8801944556677',
    status: 'online',
    battery: 84,
    lastSeen: Date.now() - 5000,
    allowedUsers: ['admin@sim800l.local', 'manager@sim800l.local', 'moderator@sim800l.local'],
    sharedWith: []
  },
  {
    mac: '30:AE:A4:11:22:33',
    name: 'Remote Pump Gateway',
    group: 'North Field Sector',
    ip: '192.168.2.45',
    wifi_rssi: -79,
    sim_operator: 'Robi Axiata',
    sim_signal: '62%',
    sim_number: '+8801812345678',
    status: 'busy',
    battery: 68,
    lastSeen: Date.now() - 2000,
    allowedUsers: ['admin@sim800l.local'],
    sharedWith: []
  },
  {
    mac: '28:CD:C1:55:66:77',
    name: 'Sector 4 Auxiliary Node',
    group: 'North Field Sector',
    ip: '192.168.2.98',
    wifi_rssi: -85,
    sim_operator: 'Teletalk',
    sim_signal: '42%',
    sim_number: '+8801552334455',
    status: 'offline',
    battery: 15,
    lastSeen: Date.now() - 3600000 * 2, // 2 hours ago
    lastOffline: Date.now() - 3600000 * 2, // 2 hours ago
    allowedUsers: ['admin@sim800l.local'],
    sharedWith: []
  }
];

const INITIAL_GROUPS: DeviceGroup[] = [
  {
    id: 'grp_01',
    name: 'Farm Main Cluster (Pooled)',
    description: 'High-availability broadcast cluster with automatic GSM modem failover',
    deviceMacs: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC'],
    strategy: 'round-robin',
    activeCallCount: 1,
    createdAt: '2026-02-10T12:00:00Z'
  },
  {
    id: 'grp_02',
    name: 'Irrigation & Security Nodes',
    description: 'Dedicated voice lines for remote telemetry and emergency alert broadcasts',
    deviceMacs: ['30:AE:A4:11:22:33'],
    strategy: 'failover',
    activeCallCount: 0,
    createdAt: '2026-03-05T08:00:00Z'
  }
];

const INITIAL_VIRTUAL_DEVICES: VirtualDevice[] = [
  {
    id: 'vdev_01',
    name: 'Virtual GSM Aggregator #1',
    virtualMac: 'V-MAC:FF:EE:DD:01',
    type: 'aggregated-pool',
    boundPhysicalMacs: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC'],
    activeMac: '44:1D:64:BD:22:EC',
    status: 'active',
    description: 'Aggregates multiple physical SIM800L modems into a single high-throughput virtual line',
    totalCallDurationSeconds: 435, // 7m 15s
    totalCallCount: 6,
    totalSmsCount: 12,
    lastCallDurationSeconds: 94,
    lastActive: '2026-11-09T18:20:00Z',
    createdAt: '2026-03-20T10:00:00Z'
  },
  {
    id: 'vdev_02',
    name: 'VIP Priority Softphone Gateway',
    virtualMac: 'VIR:VIP:02',
    type: 'failover-pair',
    boundPhysicalMacs: ['44:1D:64:BD:22:EC', '30:AE:A4:11:22:33'],
    activeMac: '44:1D:64:BD:22:EC',
    status: 'active',
    description: 'Direct WebRTC & softphone audio trunk with instant failover routing',
    totalCallDurationSeconds: 780, // 13m 00s
    totalCallCount: 9,
    totalSmsCount: 4,
    lastCallDurationSeconds: 142,
    lastActive: '2026-11-09T20:10:00Z',
    createdAt: '2026-04-01T09:00:00Z'
  },
  {
    id: 'vdev_03',
    name: 'Cluster Broadcast Bridge',
    virtualMac: 'VIR:CLUST:01',
    type: 'aggregated-pool',
    boundPhysicalMacs: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC', '30:AE:A4:11:22:33'],
    activeMac: '24:0A:C4:AA:BB:CC',
    status: 'active',
    description: 'Automated bulk campaign and queue load balancing pool',
    totalCallDurationSeconds: 1240, // 20m 40s
    totalCallCount: 15,
    totalSmsCount: 22,
    lastCallDurationSeconds: 68,
    lastActive: '2026-11-09T21:00:00Z',
    createdAt: '2026-04-15T14:30:00Z'
  }
];

const INITIAL_BRIDGES: DeviceBridge[] = [
  {
    id: 'brg_01',
    name: 'Overflow Bridge: Farm Main -> Security Nodes',
    sourceGroupId: 'grp_01',
    targetGroupId: 'grp_02',
    bridgeMode: 'overflow',
    status: 'enabled',
    lastTriggered: '2026-11-05T06:36:22Z'
  }
];

const INITIAL_AUDIO: AudioTrack[] = [
  {
    id: 'aud_01',
    trackNumber: '0001',
    title: 'Emergency Intrusion Alert (Bengali/English)',
    description: 'High priority alert warning unauthorized persons detected on perimeter',
    fileSize: '1.2 MB',
    duration: '00:28',
    uploadedAt: '2026-02-01T10:00:00Z',
    category: 'emergency'
  },
  {
    id: 'aud_02',
    trackNumber: '0002',
    title: 'Water Tank Low Water Notification',
    description: 'Automated notification reminding operator to turn on supply pump',
    fileSize: '840 KB',
    duration: '00:15',
    uploadedAt: '2026-02-15T14:30:00Z',
    category: 'notification'
  },
  {
    id: 'aud_03',
    trackNumber: '0003',
    title: 'Daily Operation Checkup Prompt',
    description: 'Scheduled status inquiry request for field engineers',
    fileSize: '1.8 MB',
    duration: '00:42',
    uploadedAt: '2026-03-10T09:15:00Z',
    category: 'marketing'
  }
];

const INITIAL_BLOCKED: BlockedNumber[] = [
  {
    id: 'blk_01',
    phoneNumber: '+8801999999999',
    label: 'Known Spammer / Telemarketer',
    reason: 'Frequent automated robocalls to modem line',
    blockedAt: '2026-03-12T11:00:00Z',
    blockedBy: 'admin@sim800l.local',
    autoRejectRule: 'hangup',
    isActive: true
  },
  {
    id: 'blk_02',
    phoneNumber: '+8801700112233',
    label: 'Repeated Prank Inbound Caller',
    reason: 'Exceeded 20 missed calls in 1 hour',
    blockedAt: '2026-04-02T16:20:00Z',
    blockedBy: 'manager@sim800l.local',
    autoRejectRule: 'busy-tone',
    isActive: true
  }
];

const INITIAL_INCOMING: IncomingCall[] = [
  {
    id: 'inc_01',
    callerNumber: '+8801711223344',
    deviceMac: '44:1D:64:BD:22:EC',
    deviceName: 'Primary Gateway',
    timestamp: '2026-11-07T14:22:10Z',
    durationSeconds: 42,
    status: 'answered',
    notes: 'Field officer confirmed perimeter check OK.'
  },
  {
    id: 'inc_02',
    callerNumber: '+8801833445566',
    deviceMac: '24:0A:C4:AA:BB:CC',
    deviceName: 'Backup SIM800L',
    timestamp: '2026-11-06T19:05:00Z',
    durationSeconds: 0,
    status: 'missed',
    notes: 'Callback queued automatically.'
  }
];

const INITIAL_COMPLAINTS: CallFeedback[] = [
  {
    id: 'cmp_01',
    callId: '6aec23e68efb0306348d172f',
    phoneNumber: '01731626274',
    rating: 2,
    category: 'audio-crackling',
    comment: 'Audio track 0001 sounded muffled; user requested repeat call.',
    submittedBy: 'Tariqul Islam',
    status: 'open',
    createdAt: '2026-11-05T07:10:00Z'
  },
  {
    id: 'cmp_02',
    callId: '6ae819778efb0306348bd142',
    phoneNumber: '01729190203',
    rating: 1,
    category: 'call-dropped',
    comment: 'Call disconnected after 3 seconds due to low network signal in sector.',
    submittedBy: 'Sarwar Jahan',
    status: 'investigating',
    createdAt: '2026-11-02T05:30:00Z'
  }
];

const INITIAL_DEVICE_EVENTS: DeviceActivityEvent[] = [
  {
    id: 'evt_01',
    deviceMac: '44:1D:64:BD:22:EC',
    type: 'CALL_OUT',
    actorName: 'Sarwar Jahan',
    actorEmail: 'admin@sim800l.local',
    actorRole: 'admin',
    actionTitle: 'Outbound Call to 01731626274',
    description: 'Triggered voice call with DFPlayer prompt track [0001]. Duration: 35s. Status: ANSWERED (SUCCESS)',
    metadata: {
      phoneNumber: '01731626274',
      duration: 35,
      status: 'success',
      audioTrack: '0001',
      ipAddress: '127.0.0.1'
    },
    timestamp: '2026-11-08T06:36:22Z',
    severity: 'success'
  },
  {
    id: 'evt_02',
    deviceMac: '44:1D:64:BD:22:EC',
    type: 'USSD_QUERY',
    actorName: 'Tariqul Islam',
    actorEmail: 'manager@sim800l.local',
    actorRole: 'manager',
    actionTitle: 'USSD Balance Checked (*121#)',
    description: 'Received operator response: "+CUSD: 0, Balance: 74.50 BDT, Validity: 30-Nov-2026", 15',
    metadata: {
      code: '*121#',
      ipAddress: '192.168.1.50'
    },
    timestamp: '2026-11-07T14:20:00Z',
    severity: 'info'
  },
  {
    id: 'evt_03',
    deviceMac: '44:1D:64:BD:22:EC',
    type: 'CONFIG_CHANGE',
    actorName: 'Sarwar Jahan',
    actorEmail: 'admin@sim800l.local',
    actorRole: 'admin',
    actionTitle: 'Renamed Device & Updated Zone',
    description: 'Changed friendly name from "ESP32 Node 1" to "Primary Gateway (SIM800L Node 1)". Group set to "Farm Main Cluster".',
    metadata: {
      fieldChanged: 'name, group',
      oldValue: 'ESP32 Node 1 (Uncategorized)',
      newValue: 'Primary Gateway (SIM800L Node 1) (Farm Main Cluster)'
    },
    timestamp: '2026-11-06T10:15:00Z',
    severity: 'warning'
  },
  {
    id: 'evt_04',
    deviceMac: '44:1D:64:BD:22:EC',
    type: 'PERMISSION_CHANGE',
    actorName: 'Sarwar Jahan',
    actorEmail: 'admin@sim800l.local',
    actorRole: 'admin',
    actionTitle: 'Delegated Device Access to Tariqul Islam',
    description: 'Granted operator permissions: Dial=TRUE, SMS=TRUE, Reboot=FALSE.',
    metadata: {
      oldValue: 'No delegates',
      newValue: 'manager@sim800l.local (Dial, SMS)'
    },
    timestamp: '2026-11-06T10:18:00Z',
    severity: 'success'
  },
  {
    id: 'evt_05',
    deviceMac: '44:1D:64:BD:22:EC',
    type: 'CALL_IN',
    actorName: 'Inbound Network Caller',
    actionTitle: 'Incoming Call Received from +8801711223344',
    description: 'Connected and answered for 42 seconds. Caller confirmed perimeter sensor status.',
    metadata: {
      phoneNumber: '+8801711223344',
      duration: 42,
      status: 'answered'
    },
    timestamp: '2026-11-07T14:22:10Z',
    severity: 'info'
  },
  {
    id: 'evt_06',
    deviceMac: '44:1D:64:BD:22:EC',
    type: 'POWER_ACTION',
    actorName: 'Sarwar Jahan',
    actorEmail: 'admin@sim800l.local',
    actorRole: 'admin',
    actionTitle: 'Soft Reboot ESP32 Executed',
    description: 'Dispatched AT command to restart MCU following SIM800L registration check.',
    timestamp: '2026-11-05T08:30:00Z',
    severity: 'warning'
  },
  {
    id: 'evt_07',
    deviceMac: '24:0A:C4:AA:BB:CC',
    type: 'CALL_OUT',
    actorName: 'Amina Khatun',
    actorEmail: 'moderator@sim800l.local',
    actorRole: 'moderator',
    actionTitle: 'Outbound Call to 01746630201',
    description: 'Triggered voice call with DFPlayer prompt track [0001]. Duration: 24s. Status: ANSWERED (SUCCESS)',
    metadata: {
      phoneNumber: '01746630201',
      duration: 24,
      status: 'success',
      audioTrack: '0001'
    },
    timestamp: '2026-11-05T05:59:56Z',
    severity: 'success'
  },
  {
    id: 'evt_08',
    deviceMac: '24:0A:C4:AA:BB:CC',
    type: 'SMS_IN',
    actorName: 'Cellular Carrier (Banglalink)',
    actionTitle: 'Inbound SMS Received',
    description: 'Decoded UCS2 message: "Your subscription validity has been extended." (Operator Notification)',
    timestamp: '2026-11-04T11:20:00Z',
    severity: 'info'
  }
];

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'cmp_voice_01',
    name: 'Emergency Weather & Storm Advisory Broadcast',
    type: 'voice',
    status: 'completed',
    totalRecipients: 4,
    completedCount: 4,
    successCount: 3,
    failedCount: 1,
    assignedDevices: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC'],
    audioTrack: 1,
    audioName: 'Storm Alert Emergency Audio (0001.mp3)',
    retryLimit: 2,
    throttleDelaySec: 5,
    createdAt: '2026-11-07T10:15:00Z',
    recipients: [
      { id: 'rcp_1', phone: '01731626274', name: 'Kabir Ahmed', status: 'answered', duration: 32, deviceMac: '44:1D:64:BD:22:EC', attemptCount: 1, timestamp: '2026-11-07T10:16:12Z' },
      { id: 'rcp_2', phone: '01944556677', name: 'Mizanur Rahman', status: 'answered', duration: 28, deviceMac: '24:0A:C4:AA:BB:CC', attemptCount: 1, timestamp: '2026-11-07T10:16:35Z' },
      { id: 'rcp_3', phone: '01822334455', name: 'Alim Hossain', status: 'answered', duration: 40, deviceMac: '44:1D:64:BD:22:EC', attemptCount: 2, timestamp: '2026-11-07T10:17:10Z' },
      { id: 'rcp_4', phone: '01677889900', name: 'Faruk Mia', status: 'busy', attemptCount: 2, timestamp: '2026-11-07T10:18:00Z', failureReason: 'Line Busy / No Answer' }
    ]
  },
  {
    id: 'cmp_sms_02',
    name: 'Monthly Service Charge & Due Billing SMS',
    type: 'sms',
    status: 'running',
    totalRecipients: 5,
    completedCount: 3,
    successCount: 3,
    failedCount: 0,
    assignedDevices: ['44:1D:64:BD:22:EC'],
    smsMessage: 'Dear Customer, your monthly service payment is due on 10th Nov. Please pay on time to avoid disruption. Thank you.',
    retryLimit: 1,
    throttleDelaySec: 4,
    createdAt: '2026-11-08T14:30:00Z',
    recipients: [
      { id: 'rcp_201', phone: '01711223344', name: 'Dr. Rafiqul', status: 'sent', deviceMac: '44:1D:64:BD:22:EC', attemptCount: 1, timestamp: '2026-11-08T14:31:02Z' },
      { id: 'rcp_202', phone: '01819876543', name: 'Sultana Begum', status: 'sent', deviceMac: '44:1D:64:BD:22:EC', attemptCount: 1, timestamp: '2026-11-08T14:31:40Z' },
      { id: 'rcp_203', phone: '01912345678', name: 'Akram Khan', status: 'sent', deviceMac: '44:1D:64:BD:22:EC', attemptCount: 1, timestamp: '2026-11-08T14:32:15Z' },
      { id: 'rcp_204', phone: '01552345678', name: 'Shirin Akter', status: 'queued', attemptCount: 0 },
      { id: 'rcp_205', phone: '01681234567', name: 'Moniruzzaman', status: 'queued', attemptCount: 0 }
    ]
  },
  {
    id: 'cmp_hyb_03',
    name: 'VIP Notification - Smart Voice Call with SMS Fallback',
    type: 'hybrid',
    status: 'paused',
    totalRecipients: 3,
    completedCount: 1,
    successCount: 1,
    failedCount: 0,
    assignedDevices: ['24:0A:C4:AA:BB:CC', '30:AE:A4:11:22:33'],
    audioTrack: 2,
    audioName: 'Welcome Prompt (0002.mp3)',
    smsMessage: 'We attempted to reach you by voice call. Please check your urgent service updates.',
    fallbackSmsMessage: 'Voice call was missed. Here is your urgent advisory message.',
    retryLimit: 2,
    throttleDelaySec: 6,
    createdAt: '2026-11-08T16:00:00Z',
    recipients: [
      { id: 'rcp_301', phone: '01700112233', name: 'Hasan Ali', status: 'answered', duration: 18, deviceMac: '24:0A:C4:AA:BB:CC', attemptCount: 1, timestamp: '2026-11-08T16:01:20Z' },
      { id: 'rcp_302', phone: '01999887766', name: 'Kamal Pasha', status: 'queued', attemptCount: 0 },
      { id: 'rcp_303', phone: '01888776655', name: 'Nasir Uddin', status: 'queued', attemptCount: 0 }
    ]
  },
  {
    id: 'cmp_sch_04',
    name: 'Scheduled Farmer Advisory Broadcast via Virtual Gateway',
    type: 'voice',
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 3600000 * 4).toISOString(), // 4 hours later
    totalRecipients: 4,
    completedCount: 0,
    successCount: 0,
    failedCount: 0,
    assignedDevices: ['VIR:CLUST:01', '44:1D:64:BD:22:EC'],
    audioTrack: 1,
    audioName: 'Storm Alert Emergency Audio (0001.mp3)',
    retryLimit: 2,
    throttleDelaySec: 5,
    createdAt: new Date().toISOString(),
    recipients: [
      { id: 'rcp_401', phone: '01711998877', name: 'Shahidul Islam', status: 'queued', attemptCount: 0 },
      { id: 'rcp_402', phone: '01822334455', name: 'Alim Hossain', status: 'queued', attemptCount: 0 },
      { id: 'rcp_403', phone: '01933445566', name: 'Moniruzzaman', status: 'queued', attemptCount: 0 },
      { id: 'rcp_404', phone: '01655667788', name: 'Shirin Akter', status: 'queued', attemptCount: 0 }
    ]
  }
];

const INITIAL_CALL_JOBS: CallJob[] = [
  {
    _id: 'job_init_01',
    mac: '44:1D:64:BD:22:EC',
    virtualId: 'VIR:CLUST:01',
    isAnonymous: false,
    phone: '01731626274',
    targetName: 'Sarwar Jahan',
    audio: '0001',
    status: 'success',
    durationSeconds: 144, // 2m 24s
    feedbackDetails: 'Call connected & answered. Audio prompt played in full.',
    createdAt: '2026-11-09T22:15:00Z',
    completedAt: '2026-11-09T22:17:24Z',
    userId: 'usr_admin',
    userName: 'Sarwar Jahan',
    userRole: 'admin',
    attempts: 1
  },
  {
    _id: 'job_init_02',
    mac: '24:0A:C4:AA:BB:CC',
    virtualId: undefined,
    isAnonymous: true,
    anonymousId: 'ANON-CLOAK-8812',
    phone: '01944556677',
    targetName: 'Amina Khatun',
    audio: '0002',
    status: 'rejected',
    durationSeconds: 8,
    feedbackDetails: 'Carrier UDUB (User Determined User Busy) / Recipient actively rejected call.',
    createdAt: '2026-11-09T22:20:00Z',
    completedAt: '2026-11-09T22:20:08Z',
    userId: 'usr_mgr_02',
    userName: 'Faruk Operations',
    userRole: 'manager',
    attempts: 1
  },
  {
    _id: 'job_init_03',
    mac: '44:1D:64:BD:22:EC',
    virtualId: 'VIR:VIP:02',
    isAnonymous: false,
    phone: '01812345678',
    targetName: 'Mizanur Rahman',
    audio: '0001',
    status: 'call_waiting',
    durationSeconds: 24,
    feedbackDetails: 'Carrier reported Call Waiting tone (Subscriber on active call). Re-queued for auto-retry.',
    createdAt: '2026-11-09T22:25:00Z',
    completedAt: '2026-11-09T22:25:24Z',
    userId: 'usr_mod_03',
    userName: 'Amina Khatun',
    userRole: 'moderator',
    attempts: 2
  },
  {
    _id: 'job_init_04',
    mac: '30:AE:A4:11:22:33',
    virtualId: 'VIR:CLUST:01',
    isAnonymous: false,
    phone: '01552345678',
    targetName: 'Kamal Hossain',
    audio: '0003',
    status: 'forwarded',
    durationSeconds: 38,
    feedbackDetails: 'Call forwarded to carrier voicemail system.',
    createdAt: '2026-11-09T22:30:00Z',
    completedAt: '2026-11-09T22:30:38Z',
    userId: 'usr_admin',
    userName: 'Sarwar Jahan',
    userRole: 'admin',
    attempts: 1
  },
  {
    _id: 'job_init_05',
    mac: '24:0A:C4:AA:BB:CC',
    virtualId: undefined,
    isAnonymous: false,
    phone: '01678901234',
    targetName: 'Nusrat Jahan',
    audio: '0001',
    status: 'busy',
    durationSeconds: 0,
    feedbackDetails: 'Subscriber busy. Re-queued in dispatcher with exponential backoff.',
    createdAt: '2026-11-09T22:35:00Z',
    userId: 'usr_admin',
    userName: 'Sarwar Jahan',
    userRole: 'admin',
    attempts: 1
  },
  {
    _id: 'job_init_06',
    mac: '44:1D:64:BD:22:EC',
    virtualId: 'VIR:CLUST:01',
    isAnonymous: false,
    phone: '01799887766',
    targetName: 'Dr. Rafiqul',
    audio: '0002',
    status: 'queued',
    durationSeconds: 0,
    feedbackDetails: 'Server channels at capacity. Queued in priority buffer (Position #1).',
    queuePosition: 1,
    createdAt: '2026-11-09T22:38:00Z',
    userId: 'usr_admin',
    userName: 'Sarwar Jahan',
    userRole: 'admin',
    attempts: 0
  }
];

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [groups, setGroups] = useState<DeviceGroup[]>(INITIAL_GROUPS);
  const [virtualDevices, setVirtualDevices] = useState<VirtualDevice[]>(INITIAL_VIRTUAL_DEVICES);
  const [bridges, setBridges] = useState<DeviceBridge[]>(INITIAL_BRIDGES);
  const [callJobs, setCallJobs] = useState<CallJob[]>(INITIAL_CALL_JOBS);
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>(INITIAL_INCOMING);
  const [smsMessages, setSmsMessages] = useState<SMSMessage[]>([]);
  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumber[]>(INITIAL_BLOCKED);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>(INITIAL_AUDIO);
  const [complaints, setComplaints] = useState<CallFeedback[]>(INITIAL_COMPLAINTS);
  const [behaviorLogs, setBehaviorLogs] = useState<UserBehaviorLog[]>([]);
  const [deviceEvents, setDeviceEvents] = useState<DeviceActivityEvent[]>(INITIAL_DEVICE_EVENTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [serverConnected, setServerConnected] = useState<boolean>(false);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // Helper to log user behavior
  const recordLog = (
    action: UserBehaviorLog['action'],
    targetResource: string,
    details: string,
    status: 'success' | 'warning' | 'error' = 'success'
  ) => {
    const newLog: UserBehaviorLog = {
      id: 'log_' + Date.now(),
      userId: currentUser?.id || 'sys',
      userName: currentUser?.name || 'System',
      userRole: currentUser?.role || 'viewer',
      action,
      targetResource,
      details,
      ipAddress: '127.0.0.1',
      timestamp: new Date().toISOString(),
      status
    };
    setBehaviorLogs(prev => [newLog, ...prev.slice(0, 99)]);
  };

  // Host configuration: Main Cloud Server, Secondary Backup, and Local Development
  const MAIN_HOST = process.env.NEXT_PUBLIC_MAIN_SERVER || 'https://800lcall.espserver.site';
  const BACKUP_HOST = process.env.NEXT_PUBLIC_BACKUP_SERVER || 'https://sim800l.maxapi.esp32.site';
  const LOCAL_HOST = 'http://localhost:3000';

  const [activeServerUrl, setActiveServerUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sim800l_active_server');
      // If user had previously stored localhost, auto-promote to live cloud cluster where ESP32 is registered
      if (saved && saved !== LOCAL_HOST) return saved;
    }
    // Default to BACKUP_HOST (sim800l.maxapi.esp32.site) where ESP32 cluster is actively registered
    return BACKUP_HOST;
  });

  const switchServer = (newUrl: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sim800l_active_server', newUrl);
    }
    setActiveServerUrl(newUrl);
  };

  const [bulkSmsConfig, setBulkSmsConfig] = useState<BulkSmsBdConfig>({
    apiKey: 'MS6MfGTEVrHaCJUQ5vAU',
    senderId: '8809617618888',
    balance: null,
    statusMessage: 'Ready'
  });

  // Connect to backend Socket.IO & fetch initial DB jobs & SMS with High-Availability Failover
  useEffect(() => {
    let socket: Socket | null = null;
    let connectErrors = 0;

    const connectToHost = (host: string) => {
      try {
        if (socket) {
          socket.disconnect();
          socket = null;
        }

        console.log(`[Socket.IO] Attempting connection to: ${host}`);
        const newSocket = io(host, { timeout: 4000, reconnectionAttempts: 2 });
        socket = newSocket;
        setSocketInstance(newSocket);
        setActiveServerUrl(host);

        newSocket.on('connect', () => {
          setServerConnected(true);
          connectErrors = 0;
          console.log(`[Socket.IO] Successfully connected to host: ${host}`);

          // Fetch initial data from connected API
          fetch(`${host}/api/jobs`)
            .then(res => res.json())
            .then(json => {
              if (json && json.success && json.data) setCallJobs(json.data);
              else if (Array.isArray(json)) setCallJobs(json);
            })
            .catch(() => {});

          fetch(`${host}/api/sms`)
            .then(res => res.json())
            .then(json => {
              if (json && json.success && json.data) setSmsMessages(json.data);
              else if (Array.isArray(json)) setSmsMessages(json);
            })
            .catch(() => {});

          // Fetch BulkSMSBD config and balance
          fetch(`${host}/api/sms/bulksmsbd/config`)
            .then(res => res.json())
            .then(cfg => {
              if (cfg && cfg.apiKey) {
                setBulkSmsConfig(prev => ({
                  ...prev,
                  apiKey: cfg.apiKey,
                  senderId: cfg.senderId || prev.senderId
                }));
                fetch(`${host}/api/sms/bulksmsbd/balance?api_key=${encodeURIComponent(cfg.apiKey)}`)
                  .then(r => r.json())
                  .then(bal => {
                    setBulkSmsConfig(prev => ({
                      ...prev,
                      balance: bal.balance !== undefined ? String(bal.balance) : null,
                      statusCode: bal.response_code,
                      statusMessage: bal.meaning || bal.error_message || (bal.success ? 'Active' : 'Ready'),
                      lastChecked: new Date().toLocaleTimeString()
                    }));
                  })
                  .catch(() => {});
              }
            })
            .catch(() => {});
        });

        newSocket.on('disconnect', () => {
          setServerConnected(false);
        });

        newSocket.on('connect_error', (err) => {
          connectErrors++;
          console.warn(`[Socket.IO] Connection error to ${host} (attempt ${connectErrors}):`, err.message);

          // Failover triggered after 2 consecutive connection failures
          if (connectErrors >= 2) {
            connectErrors = 0;
            let nextHost = host;
            if (host === LOCAL_HOST) {
              nextHost = MAIN_HOST;
            } else if (host === MAIN_HOST) {
              nextHost = BACKUP_HOST;
            } else {
              nextHost = MAIN_HOST;
            }
            console.warn(`[Socket.IO] Failover triggered! Switching active backend to: ${nextHost}`);
            connectToHost(nextHost);
          }
        });

        // Multi-device telemetry broadcast from server
        newSocket.on('active_devices_update', (incomingList: any[]) => {
          if (!Array.isArray(incomingList)) return;
          setDevices(prev => {
            const nextList = [...prev];
            incomingList.forEach(incoming => {
              const idx = nextList.findIndex(d => d.mac === incoming.mac);
              if (idx !== -1) {
                const wasStatus = nextList[idx].status;
                const newStatus = incoming.status || wasStatus;
                let offlineTime = nextList[idx].lastOffline;
                if (newStatus === 'offline' && (!offlineTime || wasStatus === 'online')) {
                  offlineTime = incoming.lastOffline || Date.now();
                } else if (incoming.lastOffline) {
                  offlineTime = incoming.lastOffline;
                }
                nextList[idx] = {
                  ...nextList[idx],
                  ...incoming,
                  status: newStatus,
                  lastOffline: offlineTime,
                  lastSeen: incoming.lastSeen || nextList[idx].lastSeen
                };
              } else {
                nextList.push({
                  mac: incoming.mac,
                  name: incoming.name || 'Discovered SIM800L Node',
                  group: incoming.group || 'Uncategorized',
                  ip: incoming.ip || '0.0.0.0',
                  wifi_rssi: incoming.wifi_rssi || -60,
                  sim_operator: incoming.sim_operator || 'GSM',
                  sim_signal: incoming.sim_signal || '70%',
                  sim_number: incoming.sim_number || 'Unknown',
                  status: incoming.status || 'online',
                  lastSeen: incoming.lastSeen || Date.now(),
                  lastOffline: incoming.lastOffline || (incoming.status === 'offline' ? Date.now() : undefined),
                  allowedUsers: incoming.allowedUsers || [],
                  sharedWith: []
                });
              }
            });
            return nextList;
          });
        });

        // Single device telemetry or status update relay
        newSocket.on('telemetry_update', (data: any) => {
          setDevices(prev => {
            const index = prev.findIndex(d => d.mac === data.mac);
            if (index !== -1) {
              const updated = [...prev];
              const wasStatus = updated[index].status;
              const newStatus = data.status || wasStatus;
              let offlineTime = updated[index].lastOffline;
              if (newStatus === 'offline' && (!offlineTime || wasStatus === 'online')) {
                offlineTime = data.lastOffline || Date.now();
              } else if (data.lastOffline) {
                offlineTime = data.lastOffline;
              }
              updated[index] = { 
                ...updated[index], 
                ...data, 
                status: newStatus,
                lastOffline: offlineTime,
                lastSeen: data.lastSeen || (newStatus === 'online' ? Date.now() : updated[index].lastSeen)
              };
              return updated;
            }
            return [...prev, {
              mac: data.mac,
              name: 'Discovered SIM800L Node',
              group: 'Uncategorized',
              ip: data.ip || '0.0.0.0',
              wifi_rssi: data.wifi_rssi || -60,
              sim_operator: data.sim_operator || 'GSM',
              sim_signal: data.sim_signal || '70%',
              sim_number: data.sim_number || 'Unknown',
              status: data.status || 'online',
              lastSeen: Date.now(),
              lastOffline: data.lastOffline || (data.status === 'offline' ? Date.now() : undefined),
              allowedUsers: [],
              sharedWith: []
            }];
          });
        });

        newSocket.on('dashboard_update', (data: any) => {
          if (data.type === 'new_jobs') {
            setCallJobs(prev => [...data.jobs, ...prev]);
          } else if (data.type === 'job_update') {
            setCallJobs(prev => {
              const idx = prev.findIndex(j => j._id === data.job._id);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = data.job;
                return updated;
              }
              return [data.job, ...prev];
            });
          }
        });

        newSocket.on('sms_update', (data: any) => {
          if (data.type === 'new_sms') {
            setSmsMessages(prev => [data.sms, ...prev]);
          }
        });
      } catch (e) {
        console.error('Socket init error:', e);
      }
    };

    connectToHost(activeServerUrl);

    return () => {
      if (socket) (socket as Socket).disconnect();
    };
  }, [activeServerUrl]);

  // Periodic device online/offline watchdog (detects dead or dropped ESP32 gateways)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDevices(prev => {
        let changed = false;
        const next = prev.map(dev => {
          // If device marked online has been silent for > 45 seconds, mark offline with timestamp
          if (dev.status === 'online' && dev.lastSeen && (now - dev.lastSeen > 45000)) {
            changed = true;
            return {
              ...dev,
              status: 'offline' as const,
              lastOffline: dev.lastOffline || dev.lastSeen || now
            };
          }
          return dev;
        });
        return changed ? next : prev;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Device Activity Logger
  const recordDeviceEvent = (eventData: Omit<DeviceActivityEvent, 'id' | 'timestamp'>) => {
    const newEvt: DeviceActivityEvent = {
      id: 'dev_evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...eventData
    };
    setDeviceEvents(prev => [newEvt, ...prev]);
  };

  const getDeviceEvents = (mac: string): DeviceActivityEvent[] => {
    return deviceEvents
      .filter(e => e.deviceMac.toUpperCase() === mac.toUpperCase())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Device Actions
  const addDevice = (deviceData: Partial<Device>) => {
    const newDev: Device = {
      mac: (deviceData.mac || '00:00:00:00:00:00').toUpperCase(),
      name: deviceData.name || 'New SIM800L Device',
      group: deviceData.group || 'Default Group',
      ip: deviceData.ip || '192.168.1.200',
      wifi_rssi: -65,
      sim_operator: deviceData.sim_operator || 'Grameenphone',
      sim_signal: '80%',
      sim_number: deviceData.sim_number || 'Unknown',
      status: 'online',
      battery: 100,
      lastSeen: Date.now(),
      allowedUsers: [currentUser?.email || 'admin@sim800l.local'],
      sharedWith: []
    };
    setDevices(prev => [newDev, ...prev]);
    recordLog('ADD_DEVICE', newDev.mac, `Added new device: ${newDev.name} (${newDev.mac})`);
    recordDeviceEvent({
      deviceMac: newDev.mac,
      type: 'SYSTEM_EVENT',
      actorName: currentUser?.name || 'Administrator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: 'Device Registered to System',
      description: `Hardware node registered with friendly name "${newDev.name}" in group "${newDev.group}".`,
      severity: 'success'
    });
  };

  const updateDevice = (mac: string, updates: Partial<Device>) => {
    const prevDev = devices.find(d => d.mac === mac);
    setDevices(prev => prev.map(d => d.mac === mac ? { ...d, ...updates } : d));
    recordLog('EDIT_DEVICE', mac, `Updated metadata for device ${mac}`);
    recordDeviceEvent({
      deviceMac: mac,
      type: 'CONFIG_CHANGE',
      actorName: currentUser?.name || 'Administrator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: 'Device Profile & Zone Changed',
      description: `Modified parameters: ${Object.keys(updates).join(', ')}`,
      metadata: {
        fieldChanged: Object.keys(updates).join(', '),
        oldValue: prevDev ? `${prevDev.name} (${prevDev.group})` : undefined,
        newValue: updates.name ? `${updates.name} (${updates.group || prevDev?.group})` : undefined
      },
      severity: 'warning'
    });
  };

  const deleteDevice = (mac: string) => {
    setDevices(prev => prev.filter(d => d.mac !== mac));
    recordLog('EDIT_DEVICE', mac, `Removed device ${mac}`, 'warning');
  };

  const shareDevice = (mac: string, share: DeviceShare) => {
    setDevices(prev => prev.map(d => {
      if (d.mac === mac) {
        const filtered = d.sharedWith.filter(s => s.userId !== share.userId);
        return {
          ...d,
          allowedUsers: Array.from(new Set([...d.allowedUsers, share.userEmail])),
          sharedWith: [...filtered, share]
        };
      }
      return d;
    }));
    recordLog('SHARE_DEVICE', mac, `Shared device ${mac} with ${share.userEmail}`);
    recordDeviceEvent({
      deviceMac: mac,
      type: 'PERMISSION_CHANGE',
      actorName: currentUser?.name || 'Administrator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: `Delegated Permissions to ${share.userEmail}`,
      description: `Access granted by ${currentUser?.name}. Dial=${share.permissions.canDial ? 'YES' : 'NO'}, SMS=${share.permissions.canSms ? 'YES' : 'NO'}, Power Reset=${share.permissions.canReboot ? 'YES' : 'NO'}`,
      severity: 'info'
    });
  };

  // Group & Bridge Actions
  const createGroup = (groupData: Omit<DeviceGroup, 'id' | 'createdAt' | 'activeCallCount'>) => {
    const newGroup: DeviceGroup = {
      id: 'grp_' + Date.now(),
      ...groupData,
      activeCallCount: 0,
      createdAt: new Date().toISOString()
    };
    setGroups(prev => [newGroup, ...prev]);
    recordLog('CREATE_GROUP', newGroup.name, `Created device group '${newGroup.name}' with ${newGroup.deviceMacs.length} devices`);
  };

  const deleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    recordLog('DELETE_GROUP', id, `Deleted device group`);
  };

  const updateGroup = (id: string, updates: Partial<DeviceGroup>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    recordLog('EDIT_GROUP', id, `Updated device group settings`);
  };

  const createVirtualDevice = (vdevData: Omit<VirtualDevice, 'id' | 'createdAt'>) => {
    const newVDev: VirtualDevice = {
      id: 'vdev_' + Date.now(),
      ...vdevData,
      createdAt: new Date().toISOString()
    };
    setVirtualDevices(prev => [newVDev, ...prev]);
    recordLog('CREATE_VIRTUAL_DEVICE', newVDev.virtualMac, `Created virtual device ${newVDev.name} [${newVDev.type}]`);
  };

  const updateVirtualDevice = (id: string, updates: Partial<VirtualDevice>) => {
    setVirtualDevices(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    recordLog('EDIT_VIRTUAL_DEVICE', id, `Updated virtual device settings`);
  };

  const deleteVirtualDevice = (id: string) => {
    setVirtualDevices(prev => prev.filter(v => v.id !== id));
    recordLog('DELETE_VIRTUAL_DEVICE', id, `Deleted virtual device`);
  };

  const createBridge = (bridgeData: Omit<DeviceBridge, 'id'>) => {
    const newBridge: DeviceBridge = {
      id: 'brg_' + Date.now(),
      ...bridgeData
    };
    setBridges(prev => [newBridge, ...prev]);
    recordLog('CREATE_GROUP', newBridge.name, `Created cluster bridge: ${newBridge.name}`);
  };

  const toggleBridge = (id: string) => {
    setBridges(prev => prev.map(b => b.id === id ? { ...b, status: b.status === 'enabled' ? 'disabled' : 'enabled' } : b));
  };

  // Hardware Control Triggers
  const triggerCall = async (mac: string, phone: string, audio?: string): Promise<boolean> => {
    if (socketInstance) {
      socketInstance.emit('dashboard_cmd_dial', { mac, phone, audio });
    }
    const newJob: CallJob = {
      _id: 'call_' + Date.now(),
      mac,
      phone,
      audio: audio || '0001',
      status: 'calling',
      createdAt: new Date().toISOString(),
      userId: currentUser?.id,
      userName: currentUser?.name
    };
    setCallJobs(prev => [newJob, ...prev]);
    recordLog('DIAL_CALL', phone, `Initiated manual call to ${phone} via ${mac}`);
    recordDeviceEvent({
      deviceMac: mac,
      type: 'CALL_OUT',
      actorName: currentUser?.name || 'Operator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: `Outbound Call Initiated to ${phone}`,
      description: `Dialed ${phone} with audio prompt track [${audio || '0001'}]. Session dispatched to SIM800L serial channel.`,
      metadata: {
        phoneNumber: phone,
        audioTrack: audio || '0001',
        status: 'calling',
        ipAddress: '127.0.0.1'
      },
      severity: 'info'
    });
    return true;
  };

  const triggerHangup = async (mac: string): Promise<boolean> => {
    if (socketInstance) {
      socketInstance.emit('dashboard_cmd_hangup', { mac });
    }
    recordLog('HANGUP', mac, `Issued hangup command to device ${mac}`);
    recordDeviceEvent({
      deviceMac: mac,
      type: 'CALL_OUT',
      actorName: currentUser?.name || 'Operator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: 'Voice Call Terminated (ATH)',
      description: `Operator issued remote hangup command to disconnect active voice call on modem.`,
      severity: 'warning'
    });
    return true;
  };

  const triggerUssd = (mac: string, code: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      recordLog('USSD_QUERY', code, `Queried USSD code ${code} on ${mac}`);

      // Standalone simulation fallback if server is offline or not connected
      if (!socketInstance || !serverConnected) {
        setTimeout(() => {
          const simulatedResp = `[Simulated / Standalone] +CUSD: 0, "Your account balance: 82.40 BDT. Validity: 15-Dec-2026.", 15`;
          recordDeviceEvent({
            deviceMac: mac,
            type: 'USSD_QUERY',
            actorName: currentUser?.name || 'Operator',
            actorEmail: currentUser?.email,
            actorRole: currentUser?.role,
            actionTitle: `USSD Query Result: ${code}`,
            description: simulatedResp,
            metadata: { code, result: simulatedResp },
            severity: 'info'
          });
          resolve(simulatedResp);
        }, 1200);
        return;
      }

      let timeoutTimer: NodeJS.Timeout;

      const resultHandler = (data: any) => {
        if (data && data.type === 'ussd' && (!data.mac || data.mac === mac)) {
          clearTimeout(timeoutTimer);
          socketInstance.off('dashboard_cmd_result', resultHandler);
          const finalResult = data.decoded || data.data || `+CUSD: 0, "OK"`;

          recordDeviceEvent({
            deviceMac: mac,
            type: 'USSD_QUERY',
            actorName: currentUser?.name || 'Operator',
            actorEmail: currentUser?.email,
            actorRole: currentUser?.role,
            actionTitle: `USSD Query Reply: ${code}`,
            description: finalResult,
            metadata: { code, result: finalResult },
            severity: 'info'
          });

          resolve(finalResult);
        }
      };

      socketInstance.on('dashboard_cmd_result', resultHandler);
      socketInstance.emit('dashboard_cmd_ussd', { mac, code });

      // Safety timeout: 22 seconds for GSM carrier network roundtrip
      timeoutTimer = setTimeout(() => {
        socketInstance.off('dashboard_cmd_result', resultHandler);
        reject(new Error(`USSD Timeout: Carrier did not reply within 22 seconds for code ${code}`));
      }, 22000);
    });
  };

  const triggerSms = async (mac: string, phone: string, message: string): Promise<boolean> => {
    if (socketInstance) {
      socketInstance.emit('dashboard_send_sms', { mac, phone, message });
    }
    const newSms: SMSMessage = {
      _id: 'sms_' + Date.now(),
      sender: phone,
      message,
      direction: 'out',
      mac,
      receivedAt: new Date().toISOString(),
      status: 'delivered'
    };
    setSmsMessages(prev => [newSms, ...prev]);
    recordLog('SEND_SMS', phone, `Sent SMS to ${phone} via ${mac}`);
    recordDeviceEvent({
      deviceMac: mac,
      type: 'SMS_OUT',
      actorName: currentUser?.name || 'Operator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: `Outbound SMS Sent to ${phone}`,
      description: `Text transmitted via modem buffer: "${message}"`,
      metadata: { phoneNumber: phone, messageText: message },
      severity: 'info'
    });
    return true;
  };

  const fetchBulkSmsBalance = async (customKey?: string) => {
    try {
      const targetKey = customKey || bulkSmsConfig.apiKey;
      const res = await fetch(`${activeServerUrl}/api/sms/bulksmsbd/balance?api_key=${encodeURIComponent(targetKey)}`);
      const data = await res.json();
      setBulkSmsConfig(prev => ({
        ...prev,
        apiKey: targetKey,
        balance: data.balance !== undefined ? String(data.balance) : null,
        statusCode: data.response_code,
        statusMessage: data.meaning || data.error_message || (data.success ? 'Active' : 'Account Error'),
        lastChecked: new Date().toLocaleTimeString()
      }));
      return data;
    } catch (err: any) {
      console.error('Failed to fetch BulkSMSBD balance:', err);
      setBulkSmsConfig(prev => ({
        ...prev,
        statusMessage: 'Connection failed',
        lastChecked: new Date().toLocaleTimeString()
      }));
      return { success: false, error: err.message };
    }
  };

  const sendBulkSmsBd = async (
    numbers: string[], 
    message: string, 
    senderId?: string, 
    apiKey?: string
  ): Promise<BulkSmsSendResult> => {
    try {
      const res = await fetch(`${activeServerUrl}/api/sms/bulksmsbd/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          message,
          senderId: senderId || bulkSmsConfig.senderId,
          apiKey: apiKey || bulkSmsConfig.apiKey
        })
      });
      const data: BulkSmsSendResult = await res.json();
      
      recordLog(
        'SEND_SMS', 
        `${numbers.length} Recipients`, 
        `Dispatched BulkSMSBD blast: ${data.success ? 'Success (' + (data.recipient_count || numbers.length) + ' sent)' : 'Failed: ' + (data.meaning || data.error_message)}`
      );

      // Re-fetch balance after dispatch
      fetchBulkSmsBalance();

      return data;
    } catch (err: any) {
      console.error('Failed to dispatch BulkSMSBD:', err);
      return {
        success: false,
        error_message: err.message,
        meaning: 'Network / Gateway Connection Error'
      };
    }
  };

  const updateBulkSmsConfig = async (apiKey: string, senderId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${activeServerUrl}/api/sms/bulksmsbd/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, senderId })
      });
      const json = await res.json();
      if (json.success) {
        setBulkSmsConfig(prev => ({
          ...prev,
          apiKey,
          senderId
        }));
        fetchBulkSmsBalance(apiKey);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed updating BulkSMS config:', err);
      return false;
    }
  };

  const triggerReboot = async (mac: string): Promise<boolean> => {
    if (socketInstance) {
      socketInstance.emit('dashboard_cmd_reboot', { mac });
    }
    recordLog('REBOOT_DEVICE', mac, `Rebooted ESP32 device ${mac}`, 'warning');
    recordDeviceEvent({
      deviceMac: mac,
      type: 'POWER_ACTION',
      actorName: currentUser?.name || 'Administrator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: 'Soft Reboot Command Executed',
      description: `Restart signal sent to microcontroller. Node expected to reconnect in ~5 seconds.`,
      severity: 'warning'
    });
    return true;
  };

  const triggerFlightMode = async (mac: string, state: boolean): Promise<boolean> => {
    if (socketInstance) {
      socketInstance.emit('dashboard_cmd_flightmode', { mac, state });
    }
    recordLog('EDIT_DEVICE', mac, `Toggled flight mode to ${state} on ${mac}`);
    recordDeviceEvent({
      deviceMac: mac,
      type: 'POWER_ACTION',
      actorName: currentUser?.name || 'Administrator',
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      actionTitle: `Modem Flight Mode ${state ? 'ENABLED' : 'DISABLED'}`,
      description: `Updated SIM800L power state. CFUN=${state ? '0 (Radio off)' : '1 (Radio full online)'}.`,
      severity: 'warning'
    });
    return true;
  };

  const triggerBroadcast = async (
    phoneList: string[], 
    options: { 
      mac?: string; 
      virtualId?: string;
      isAnonymous?: boolean;
      anonymousId?: string;
      groupId?: string; 
      audio?: string;
      recipientNames?: Record<string, string>;
    }
  ) => {
    const isAnon = options.isAnonymous || false;
    const anonId = isAnon ? (options.anonymousId || `ANON-CLOAK-${Math.floor(1000 + Math.random() * 9000)}`) : undefined;
    const targetRoute = options.virtualId ? `[Virtual Address: ${options.virtualId}]` : (options.mac ? `[MAC: ${options.mac}]` : '[Auto Cluster]');

    // High-load queue behavior: jobs are placed into priority FIFO queue with queuePosition
    const newJobs: CallJob[] = phoneList.map((p, i) => {
      // First call starts dialing immediately; subsequent ones queued safely
      const isQueued = i >= 1;
      return {
        _id: 'job_' + Date.now() + '_' + i,
        mac: options.mac || (!options.virtualId ? '44:1D:64:BD:22:EC' : undefined),
        virtualId: options.virtualId,
        isAnonymous: isAnon,
        anonymousId: anonId,
        phone: p,
        targetName: options.recipientNames?.[p] || undefined,
        audio: options.audio || '0001',
        status: isQueued ? 'queued' : 'calling',
        queuePosition: isQueued ? i : undefined,
        durationSeconds: 0,
        attempts: 0,
        feedbackDetails: isQueued 
          ? `Server load buffer. Priority Queue Position #${i} awaiting line release.` 
          : `Allocated line via ${targetRoute}. Outbound dialing initiated with Track [${options.audio || '0001'}].`,
        createdAt: new Date().toISOString(),
        userId: currentUser?.id,
        userName: isAnon ? `Anonymous (${anonId})` : (currentUser?.name || 'Administrator'),
        userRole: currentUser?.role || 'admin'
      };
    });

    setCallJobs(prev => [...newJobs, ...prev]);

    const payload = {
      user_id: currentUser?.id || 'admin',
      userName: isAnon ? `Anonymous (${anonId})` : (currentUser?.name || 'Administrator'),
      userRole: currentUser?.role || 'admin',
      phone: 'Admin Panel',
      mac: options.mac || '',
      virtualId: options.virtualId || '',
      isAnonymous: isAnon,
      anonymousId: anonId,
      phone_call_list: phoneList,
      payload: {
        address: options.virtualId || options.mac || 'Cluster Dispatch',
        message: 'Batch voice broadcast',
        audio: options.audio || '0001'
      },
      response: []
    };

    try {
      await fetch(`${activeServerUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // Keep local persistent state
    }

    recordLog('DIAL_CALL', `Broadcast (${phoneList.length} numbers)`, `Dispatched broadcast via ${targetRoute}. Requester: ${isAnon ? `Anonymous (${anonId})` : currentUser?.name}`);
  };

  const addBlockedNumber = (numberData: Omit<BlockedNumber, 'id' | 'blockedAt'>) => {
    const newBlocked: BlockedNumber = {
      id: 'blk_' + Date.now(),
      ...numberData,
      blockedAt: new Date().toISOString()
    };
    setBlockedNumbers(prev => [newBlocked, ...prev]);
  };

  const toggleBlockedNumber = (id: string) => {
    setBlockedNumbers(prev => prev.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b));
  };

  const removeBlockedNumber = (id: string) => {
    setBlockedNumbers(prev => prev.filter(b => b.id !== id));
  };

  const uploadAudioTrack = (trackData: Omit<AudioTrack, 'id' | 'uploadedAt'>) => {
    const newTrack: AudioTrack = {
      id: 'aud_' + Date.now(),
      ...trackData,
      uploadedAt: new Date().toISOString()
    };
    setAudioTracks(prev => [newTrack, ...prev]);
  };

  const submitComplaint = (complaintData: Omit<CallFeedback, 'id' | 'createdAt'>) => {
    const newComplaint: CallFeedback = {
      id: 'cmp_' + Date.now(),
      ...complaintData,
      createdAt: new Date().toISOString()
    };
    setComplaints(prev => [newComplaint, ...prev]);
  };

  const updateComplaintStatus = (id: string, status: CallFeedback['status']) => {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  // --- CAMPAIGN ACTIONS ---
  const createCampaign = (data: Omit<Campaign, 'id' | 'createdAt' | 'completedCount' | 'successCount' | 'failedCount' | 'recipients' | 'totalRecipients'> & { recipientList: { phone: string; name?: string }[] }) => {
    const recipients: CampaignRecipient[] = data.recipientList.map((r, i) => ({
      id: `rcp_${Date.now()}_${i}`,
      phone: r.phone.trim(),
      name: r.name?.trim() || undefined,
      status: 'queued',
      attemptCount: 0
    }));

    const newCampaign: Campaign = {
      id: `cmp_${Date.now()}`,
      name: data.name,
      type: data.type,
      status: data.status || 'draft',
      totalRecipients: recipients.length,
      completedCount: 0,
      successCount: 0,
      failedCount: 0,
      assignedDevices: data.assignedDevices.length > 0 ? data.assignedDevices : [devices[0]?.mac || '44:1D:64:BD:22:EC'],
      audioTrack: data.audioTrack,
      audioName: data.audioName,
      smsMessage: data.smsMessage,
      fallbackSmsMessage: data.fallbackSmsMessage,
      retryLimit: data.retryLimit || 1,
      throttleDelaySec: data.throttleDelaySec || 5,
      createdAt: new Date().toISOString(),
      recipients
    };

    setCampaigns(prev => [newCampaign, ...prev]);
    recordLog('DIAL_CALL', `Campaign: ${newCampaign.name}`, `Created ${newCampaign.type.toUpperCase()} campaign with ${recipients.length} recipients`);
  };

  const startCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c));
    recordLog('DIAL_CALL', `Campaign [${id}]`, 'Campaign launched into active queue');
  };

  const pauseCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'paused' } : c));
    recordLog('DIAL_CALL', `Campaign [${id}]`, 'Campaign paused by user');
  };

  const resumeCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c));
    recordLog('DIAL_CALL', `Campaign [${id}]`, 'Campaign resumed by user');
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    recordLog('EDIT_CAMPAIGN', id, `Updated campaign configuration`);
  };

  const deleteCampaign = (id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    recordLog('DIAL_CALL', `Campaign [${id}]`, 'Campaign deleted');
  };

  const updateCallJob = (id: string, updates: Partial<CallJob>) => {
    setCallJobs(prev => prev.map(j => j._id === id ? { ...j, ...updates } : j));
    recordLog('EDIT_JOB', id, `Updated call job record [${id}]`);
  };

  const deleteCallJob = (id: string) => {
    setCallJobs(prev => prev.filter(j => j._id !== id));
    recordLog('DELETE_JOB', id, `Deleted call job record [${id}]`);
  };

  const deleteCallJobs = (ids: string[]) => {
    setCallJobs(prev => prev.filter(j => !ids.includes(j._id)));
    recordLog('DELETE_JOB', `${ids.length} jobs`, `Bulk deleted ${ids.length} call job records`);
  };

  const clearAllCallJobs = () => {
    setCallJobs([]);
    recordLog('DELETE_JOB', 'All Jobs', `Wiped all call job history`);
  };

  const deleteSms = (id: string) => {
    setSmsMessages(prev => prev.filter(s => s._id !== id));
    recordLog('DELETE_SMS', id, `Deleted SMS message [${id}]`);
  };

  const deleteSmsThread = (phoneNumber: string) => {
    setSmsMessages(prev => prev.filter(s => s.sender !== phoneNumber && s.mac !== phoneNumber));
    recordLog('DELETE_SMS', phoneNumber, `Cleared SMS conversation thread for ${phoneNumber}`);
  };

  const clearAllSms = () => {
    setSmsMessages([]);
    recordLog('DELETE_SMS', 'All SMS', `Wiped entire SMS inbox & outbox`);
  };

  const updateBlockedNumber = (id: string, updates: Partial<BlockedNumber>) => {
    setBlockedNumbers(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    recordLog('EDIT_BLOCKED_NUMBER', id, `Updated blacklist rules for number`);
  };

  const updateAudioTrack = (id: string, updates: Partial<AudioTrack>) => {
    setAudioTracks(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    recordLog('EDIT_AUDIO', id, `Updated audio track metadata`);
  };

  const deleteAudioTrack = (id: string) => {
    setAudioTracks(prev => prev.filter(a => a.id !== id));
    recordLog('DELETE_AUDIO', id, `Deleted audio track [${id}]`);
  };

  const deleteComplaint = (id: string) => {
    setComplaints(prev => prev.filter(c => c.id !== id));
    recordLog('DELETE_COMPLAINT', id, `Deleted complaint ticket [${id}]`);
  };

  const deleteDeviceEvent = (id: string) => {
    setDeviceEvents(prev => prev.filter(e => e.id !== id));
  };

  const clearDeviceEvents = (mac?: string) => {
    if (mac) {
      setDeviceEvents(prev => prev.filter(e => e.deviceMac !== mac));
    } else {
      setDeviceEvents([]);
    }
  };

  const deleteIncomingCall = (id: string) => {
    setIncomingCalls(prev => prev.filter(c => c.id !== id));
    recordLog('ADMIN_ACTION', id, `Deleted incoming call record [${id}]`);
  };

  const clearIncomingCalls = () => {
    setIncomingCalls([]);
    recordLog('ADMIN_ACTION', 'all_incoming_calls', `Cleared all incoming call logs`);
  };

  const deleteBehaviorLog = (id: string) => {
    setBehaviorLogs(prev => prev.filter(l => l.id !== id));
  };

  const clearBehaviorLogs = () => {
    setBehaviorLogs([]);
  };

  // Automated Dispatch & Scheduler Engine for Running and Scheduled Campaigns
  useEffect(() => {
    const interval = setInterval(() => {
      setCampaigns(prevCampaigns => {
        let hasChanges = false;

        const updated = prevCampaigns.map(camp => {
          // Check if scheduled campaign trigger time has arrived
          if (camp.status === 'scheduled') {
            if (camp.scheduledAt && new Date(camp.scheduledAt).getTime() <= Date.now()) {
              hasChanges = true;
              recordLog('DIAL_CALL', `Campaign [${camp.id}]`, `Scheduled trigger time arrived for "${camp.name}". Launching automatically!`);
              return { ...camp, status: 'running' as const };
            }
            return camp;
          }

          if (camp.status !== 'running') return camp;

          // Find first queued recipient
          const queuedIndex = camp.recipients.findIndex(r => r.status === 'queued');
          if (queuedIndex === -1) {
            // Check if all are processed
            const allDone = camp.recipients.every(r => r.status !== 'queued' && r.status !== 'dialing');
            if (allDone && camp.status === 'running') {
              hasChanges = true;
              return { ...camp, status: 'completed' as const };
            }
            return camp;
          }

          hasChanges = true;
          const targetRecipient = camp.recipients[queuedIndex];
          const assignedDevice = camp.assignedDevices[queuedIndex % camp.assignedDevices.length] || '44:1D:64:BD:22:EC';

          // Virtual Device resolution if a virtual gateway MAC is used
          const isVirtualGateway = assignedDevice.startsWith('VIR:') || virtualDevices.some(v => v.virtualMac === assignedDevice);
          const matchedVirtual = virtualDevices.find(v => v.virtualMac === assignedDevice);
          const effectivePhysicalMac = matchedVirtual?.boundPhysicalMacs?.[0] || '44:1D:64:BD:22:EC';

          // Simulate call/SMS outcome (90% success, 10% busy)
          const isSuccess = Math.random() > 0.12;
          const isVoice = camp.type === 'voice';
          const isHybrid = camp.type === 'hybrid';

          const newStatus = isVoice || isHybrid 
            ? (isSuccess ? 'answered' : (isHybrid ? 'fallback_sms_sent' : 'busy'))
            : (isSuccess ? 'sent' : 'failed');

          const duration = (isVoice || isHybrid) && isSuccess ? Math.floor(Math.random() * 35) + 12 : undefined;

          const updatedRecipients = [...camp.recipients];
          updatedRecipients[queuedIndex] = {
            ...targetRecipient,
            status: newStatus as CampaignRecipient['status'],
            deviceMac: assignedDevice,
            attemptCount: targetRecipient.attemptCount + 1,
            duration,
            timestamp: new Date().toISOString()
          };

          const newCompleted = camp.completedCount + 1;
          const newSuccess = isSuccess ? camp.successCount + 1 : camp.successCount;
          const newFailed = !isSuccess ? camp.failedCount + 1 : camp.failedCount;
          const isNowCompleted = newCompleted >= camp.totalRecipients;

          // Record hardware event log for the physical or virtual device
          recordDeviceEvent({
            deviceMac: effectivePhysicalMac,
            type: camp.type === 'sms' ? 'SMS_OUT' : 'CALL_OUT',
            actorName: isVirtualGateway ? `Virtual Engine (${assignedDevice})` : 'Campaign Engine',
            actorEmail: 'system@campaign.local',
            actorRole: 'admin',
            actionTitle: `[Campaign Dispatch] ${camp.name}`,
            description: `${isVirtualGateway ? `[Virtual Trunk: ${matchedVirtual?.name || assignedDevice}] ` : ''}${camp.type.toUpperCase()} to ${targetRecipient.phone} (${targetRecipient.name || 'Recipient'}). Result: ${newStatus.toUpperCase()}`,
            metadata: {
              phoneNumber: targetRecipient.phone,
              duration,
              status: isSuccess ? 'success' : 'failed',
              audioTrack: camp.audioTrack ? String(camp.audioTrack) : undefined
            },
            severity: isSuccess ? 'success' : 'warning'
          });

          return {
            ...camp,
            completedCount: newCompleted,
            successCount: newSuccess,
            failedCount: newFailed,
            status: isNowCompleted ? ('completed' as const) : camp.status,
            recipients: updatedRecipients
          };
        });

        return hasChanges ? updated : prevCampaigns;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [virtualDevices]);

  // Automated Call Queue & Carrier Feedback Worker (Zero-Drop Guarantee & Virtual Duration Tracker)
  useEffect(() => {
    const queueInterval = setInterval(() => {
      setCallJobs(prevJobs => {
        let hasChanges = false;
        
        // 1. Process active calling job to final carrier feedback
        const activeCallingIndex = prevJobs.findIndex(j => j.status === 'calling');
        if (activeCallingIndex !== -1) {
          hasChanges = true;
          const currentJob = prevJobs[activeCallingIndex];
          
          // Realistic carrier signaling feedback
          const rand = Math.random();
          let finalStatus: CallJob['status'] = 'success';
          let durationSec = Math.floor(45 + Math.random() * 115); // 45s to 160s (e.g. 1m 15s - 2m 40s)
          let feedback = `Call answered & completed. Talk time: ${Math.floor(durationSec / 60)}m ${durationSec % 60}s. Track: [${currentJob.audio || '0001'}].`;

          if (rand < 0.08) {
            finalStatus = 'rejected';
            durationSec = Math.floor(6 + Math.random() * 8);
            feedback = `Recipient actively declined / rejected call (Carrier UDUB). Duration: 0m ${durationSec}s.`;
          } else if (rand < 0.16) {
            finalStatus = 'call_waiting';
            durationSec = Math.floor(18 + Math.random() * 12);
            feedback = `Call Waiting: Recipient is currently engaged on another phone call. Auto-retry scheduled.`;
          } else if (rand < 0.22) {
            finalStatus = 'forwarded';
            durationSec = Math.floor(25 + Math.random() * 18);
            feedback = `Call diverted / forwarded to carrier voicemail service. Duration: 0m ${durationSec}s.`;
          } else if (rand < 0.26) {
            finalStatus = 'busy';
            durationSec = 0;
            feedback = `Subscriber busy tone received. Auto-retry with backoff scheduled.`;
          }

          // Zero-Drop auto-retry guarantee for busy or waiting calls
          const shouldRetry = (finalStatus === 'busy' || finalStatus === 'call_waiting') && (currentJob.attempts || 0) < 3;
          const nextStatus = shouldRetry ? 'queued' : finalStatus;
          const nextAttempts = (currentJob.attempts || 0) + 1;

          const updatedJob: CallJob = {
            ...currentJob,
            status: nextStatus,
            durationSeconds: durationSec,
            feedbackDetails: shouldRetry ? `${feedback} (Retry attempt #${nextAttempts}/3 queued)` : feedback,
            attempts: nextAttempts,
            completedAt: shouldRetry ? undefined : new Date().toISOString()
          };

          // If virtual ID was targeted, record cumulative talk duration to that specific virtual address
          if (currentJob.virtualId && durationSec > 0) {
            setVirtualDevices(prevVDevs => prevVDevs.map(v => {
              if (v.virtualMac === currentJob.virtualId) {
                return {
                  ...v,
                  totalCallDurationSeconds: (v.totalCallDurationSeconds || 0) + durationSec,
                  totalCallCount: (v.totalCallCount || 0) + 1,
                  lastCallDurationSeconds: durationSec,
                  lastActive: new Date().toISOString()
                };
              }
              return v;
            }));
          }

          // Record hardware activity audit event
          recordDeviceEvent({
            deviceMac: currentJob.mac || currentJob.virtualId || '44:1D:64:BD:22:EC',
            type: 'CALL_OUT',
            actorName: currentJob.userName || 'System Dispatcher',
            actorEmail: currentJob.isAnonymous ? 'anonymous@cloak.local' : currentUser?.email,
            actorRole: currentJob.userRole || 'admin',
            actionTitle: `Voice Call ${finalStatus.toUpperCase()} (${currentJob.phone})`,
            description: `${currentJob.isAnonymous ? `[Anonymous: ${currentJob.anonymousId}] ` : ''}${currentJob.virtualId ? `[Virtual Address: ${currentJob.virtualId}] ` : ''}Target: ${currentJob.targetName || currentJob.phone}. Duration: ${Math.floor(durationSec / 60)}m ${durationSec % 60}s. Feedback: ${feedback}`,
            metadata: {
              phoneNumber: currentJob.phone,
              duration: durationSec,
              status: finalStatus === 'success' ? 'success' : 'failed',
              audioTrack: currentJob.audio || undefined
            },
            severity: finalStatus === 'success' ? 'success' : 'warning'
          });

          const copy = [...prevJobs];
          copy[activeCallingIndex] = updatedJob;
          return copy;
        }

        // 2. High-load FIFO Queue: Pick the next queued job and move to 'calling'
        const queuedIndex = prevJobs.findIndex(j => j.status === 'queued');
        if (queuedIndex !== -1) {
          hasChanges = true;
          const copy = [...prevJobs];
          const queuedJob = copy[queuedIndex];
          copy[queuedIndex] = {
            ...queuedJob,
            status: 'calling',
            feedbackDetails: `Channel allocated. Dialing recipient ${queuedJob.phone} via line...`
          };
          return copy;
        }

        return hasChanges ? prevJobs : prevJobs;
      });
    }, 3800);

    return () => clearInterval(queueInterval);
  }, [currentUser]);

  return (
    <DataContext.Provider
      value={{
        devices,
        groups,
        virtualDevices,
        bridges,
        callJobs,
        incomingCalls,
        smsMessages,
        blockedNumbers,
        audioTracks,
        complaints,
        behaviorLogs,
        deviceEvents,
        campaigns,
        serverConnected,
        activeServerUrl,
        switchServer,
        addDevice,
        updateDevice,
        deleteDevice,
        shareDevice,
        getDeviceEvents,
        recordDeviceEvent,
        createGroup,
        deleteGroup,
        createVirtualDevice,
        deleteVirtualDevice,
        createBridge,
        toggleBridge,
        triggerCall,
        triggerHangup,
        triggerUssd,
        triggerSms,
        triggerReboot,
        triggerFlightMode,
        triggerBroadcast,
        addBlockedNumber,
        toggleBlockedNumber,
        removeBlockedNumber,
        uploadAudioTrack,
        submitComplaint,
        updateComplaintStatus,
        createCampaign,
        updateCampaign,
        startCampaign,
        pauseCampaign,
        resumeCampaign,
        deleteCampaign,
        updateGroup,
        updateVirtualDevice,
        updateCallJob,
        deleteCallJob,
        deleteCallJobs,
        clearAllCallJobs,
        deleteSms,
        deleteSmsThread,
        clearAllSms,
        bulkSmsConfig,
        fetchBulkSmsBalance,
        sendBulkSmsBd,
        updateBulkSmsConfig,
        updateBlockedNumber,
        updateAudioTrack,
        deleteAudioTrack,
        deleteComplaint,
        deleteDeviceEvent,
        clearDeviceEvents,
        deleteIncomingCall,
        clearIncomingCalls,
        deleteBehaviorLog,
        clearBehaviorLogs
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}

