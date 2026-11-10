export type CallStatus = 
  | 'pending' 
  | 'queued' 
  | 'calling' 
  | 'success' 
  | 'received' 
  | 'busy' 
  | 'rejected' 
  | 'call_waiting' 
  | 'forwarded' 
  | 'number_off' 
  | 'unreachable' 
  | 'hardware_error' 
  | 'fail' 
  | 'failed';

export interface CallJob {
  _id: string;
  mac?: string; // Physical MAC address
  virtualId?: string; // Specific Virtual Address / Virtual MAC (e.g. VIR:CLUST:01)
  isAnonymous?: boolean; // Anonymous / Cloaked Caller ID
  anonymousId?: string; // e.g. "ANON-CLOAK-9921" or "#31#"
  phone: string;
  targetName?: string; // Recipient contact name
  audio?: string | null; // Track number (e.g. "0001", "0002")
  status: CallStatus;
  durationSeconds?: number; // Exact call duration in seconds
  feedbackDetails?: string; // Detailed carrier feedback (e.g. "Call answered - 2m 14s", "User actively rejected call")
  queuePosition?: number; // Priority FIFO Queue index
  attempts?: number; // Number of dispatch retry attempts
  createdAt: string;
  completedAt?: string;
  userId?: string; // Who requested it (User ID or 'system')
  userName?: string; // Requester display name
  userRole?: string; // Requester role (admin, manager, etc.)
}

export interface IncomingCall {
  id: string;
  callerNumber: string;
  deviceMac: string;
  deviceName: string;
  timestamp: string;
  durationSeconds: number;
  status: 'answered' | 'missed' | 'rejected' | 'forwarded';
  notes?: string;
}

export interface BlockedNumber {
  id: string;
  phoneNumber: string;
  label: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  autoRejectRule: 'hangup' | 'busy-tone' | 'forward-voicemail';
  isActive: boolean;
}

export interface AudioTrack {
  id: string;
  trackNumber: string; // e.g. "0001", "0002"
  title: string;
  description: string;
  fileSize: string;
  duration: string;
  uploadedAt: string;
  category: 'alarm' | 'marketing' | 'notification' | 'emergency';
}

export interface CallFeedback {
  id: string;
  callId: string;
  phoneNumber: string;
  rating: 1 | 2 | 3 | 4 | 5;
  category: 'audio-crackling' | 'call-dropped' | 'no-audio' | 'delayed-answer' | 'other';
  comment: string;
  submittedBy: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
}

