export type UserRole = 'admin' | 'manager' | 'moderator' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending';
  assignedDevices: string[]; // MAC addresses
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
}

export interface UserBehaviorLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 
    | 'LOGIN' 
    | 'LOGOUT' 
    | 'DIAL_CALL' 
    | 'HANGUP' 
    | 'SEND_SMS' 
    | 'ADD_DEVICE' 
    | 'EDIT_DEVICE' 
    | 'DELETE_DEVICE'
    | 'SHARE_DEVICE' 
    | 'REBOOT_DEVICE' 
    | 'USSD_QUERY' 
    | 'CREATE_GROUP' 
    | 'EDIT_GROUP'
    | 'DELETE_GROUP'
    | 'CREATE_VIRTUAL_DEVICE'
    | 'EDIT_VIRTUAL_DEVICE'
    | 'DELETE_VIRTUAL_DEVICE'
    | 'EDIT_CAMPAIGN'
    | 'DELETE_CAMPAIGN'
    | 'EDIT_JOB'
    | 'DELETE_JOB'
    | 'DELETE_SMS'
    | 'EDIT_BLOCKED_NUMBER'
    | 'EDIT_AUDIO'
    | 'DELETE_AUDIO'
    | 'DELETE_COMPLAINT'
    | 'EDIT_USER'
    | 'DELETE_USER'
    | 'ADMIN_ACTION';
  targetResource?: string; // e.g. MAC address, phone number, group id
  details: string;
  ipAddress: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

