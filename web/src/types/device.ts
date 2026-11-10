export type DeviceStatus = 'online' | 'offline' | 'busy' | 'error';

export interface Device {
  mac: string;
  name: string;
  group: string;
  ip: string;
  wifi_rssi: number;
  sim_operator: string;
  sim_signal: string;
  sim_number: string;
  status: DeviceStatus;
  battery?: number;
  lastSeen: number;
  allowedUsers: string[]; // user IDs or emails
  sharedWith: DeviceShare[];
  isVirtual?: boolean;
}

export interface DeviceShare {
  userId: string;
  userEmail: string;
  permissions: {
    canDial: boolean;
    canSms: boolean;
    canView: boolean;
    canReboot: boolean;
  };
  sharedAt: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description: string;
  deviceMacs: string[];
  strategy: 'round-robin' | 'failover' | 'broadcast' | 'lowest-latency';
  activeCallCount: number;
  createdAt: string;
}

export interface VirtualDevice {
  id: string;
  name: string;
  virtualMac: string;
  type: 'aggregated-pool' | 'failover-pair' | 'simulated-modem';
  boundPhysicalMacs: string[];
  activeMac?: string;
  status: 'active' | 'standby' | 'degraded';
  description: string;
  totalCallDurationSeconds: number; // Cumulative talk time recorded
  totalCallCount: number; // Total voice calls processed
  totalSmsCount: number; // Total SMS routed
  lastCallDurationSeconds?: number; // Duration of last call
  lastActive?: string;
  createdAt: string;
}

export interface DeviceBridge {
  id: string;
  name: string;
  sourceGroupId: string;
  targetGroupId: string;
  bridgeMode: 'overflow' | 'mirror' | 'bi-directional';
  status: 'enabled' | 'disabled';
  lastTriggered?: string;
}

export type DeviceEventType = 
  | 'CALL_OUT' 
  | 'CALL_IN' 
  | 'SMS_OUT' 
  | 'SMS_IN' 
  | 'CONFIG_CHANGE' 
  | 'USSD_QUERY' 
  | 'POWER_ACTION' 
  | 'PERMISSION_CHANGE' 
  | 'SYSTEM_EVENT';

export interface DeviceActivityEvent {
  id: string;
  deviceMac: string;
  type: DeviceEventType;
  actorName: string;
  actorEmail?: string;
  actorRole?: string;
  actionTitle: string;
  description: string;
  metadata?: {
    phoneNumber?: string;
    duration?: number;
    status?: string;
    audioTrack?: string;
    code?: string;
    messageText?: string;
    fieldChanged?: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
  };
  timestamp: string;
  severity: 'success' | 'warning' | 'error' | 'info';
}

