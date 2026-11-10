export interface SMSMessage {
  _id: string;
  sender: string;
  message: string;
  direction: 'in' | 'out';
  gateway?: 'sim800l' | 'bulksmsbd';
  senderId?: string;
  mac?: string;
  timestamp?: string;
  receivedAt: string;
  status?: 'delivered' | 'failed' | 'pending';
}

export interface BulkSmsBdConfig {
  apiKey: string;
  senderId: string;
  balance?: string | null;
  lastChecked?: string;
  statusCode?: number;
  statusMessage?: string;
}

export interface BulkSmsSendResult {
  success: boolean;
  response_code?: number;
  message_id?: number | string;
  error_message?: string;
  success_message?: string;
  meaning?: string;
  recipient_count?: number;
  recipients?: string[];
}

