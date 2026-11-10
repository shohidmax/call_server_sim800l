export type CampaignType = 'voice' | 'sms' | 'hybrid';

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'scheduled';

export type RecipientStatus = 'queued' | 'dialing' | 'answered' | 'busy' | 'failed' | 'sent' | 'fallback_sms_sent';

export interface CampaignRecipient {
  id: string;
  phone: string;
  name?: string;
  status: RecipientStatus;
  deviceMac?: string;
  attemptCount: number;
  duration?: number; // Call duration in seconds
  timestamp?: string;
  failureReason?: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  totalRecipients: number;
  completedCount: number;
  successCount: number;
  failedCount: number;
  assignedDevices: string[]; // MAC addresses of SIM800L devices handling the campaign
  audioTrack?: string | number; // DFPlayer Mini track ID for voice calls (e.g. "0001")
  audioName?: string;
  smsMessage?: string; // Text / Bengali UCS2 message
  fallbackSmsMessage?: string; // Used in hybrid mode when voice call is unanswered
  retryLimit: number; // e.g. 1, 2, or 3 retries
  throttleDelaySec: number; // Delay in seconds between dispatches per device to avoid SIM block
  createdAt: string;
  scheduledAt?: string;
  recipients: CampaignRecipient[];
}
