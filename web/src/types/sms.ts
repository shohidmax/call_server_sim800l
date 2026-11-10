export interface SMSMessage {
  _id: string;
  sender: string;
  message: string;
  direction: 'in' | 'out';
  mac?: string;
  timestamp?: string;
  receivedAt: string;
  status?: 'delivered' | 'failed' | 'pending';
}

