'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types/user';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role?: UserRole) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (requiredRole: UserRole) => boolean;
}

const DEMO_USERS: Record<UserRole, User> = {
  admin: {
    id: 'usr_admin_01',
    name: 'Sarwar Jahan (Super Admin)',
    email: 'admin@sim800l.local',
    role: 'admin',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC', '30:AE:A4:11:22:33'],
    createdAt: '2026-01-10T08:00:00Z',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
  },
  manager: {
    id: 'usr_mgr_02',
    name: 'Tariqul Islam (Ops Manager)',
    email: 'manager@sim800l.local',
    role: 'manager',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC'],
    createdAt: '2026-02-15T09:30:00Z',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'
  },
  moderator: {
    id: 'usr_mod_03',
    name: 'Amina Khatun (Call Moderator)',
    email: 'moderator@sim800l.local',
    role: 'moderator',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC'],
    createdAt: '2026-03-01T11:00:00Z',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'
  },
  viewer: {
    id: 'usr_view_04',
    name: 'Rafiqul Alam (Audit Viewer)',
    email: 'viewer@sim800l.local',
    role: 'viewer',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC'],
    createdAt: '2026-04-05T14:20:00Z',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100'
  }
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  moderator: 2,
  manager: 3,
  admin: 4
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(DEMO_USERS.admin);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sim800l_active_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      } else {
        setCurrentUser(DEMO_USERS.admin);
      }
    } catch (e) {
      setCurrentUser(DEMO_USERS.admin);
    }
    setIsLoaded(true);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Check if matches demo users or create session
    const matched = Object.values(DEMO_USERS).find(u => u.email.toLowerCase() === email.toLowerCase());
    const userToSet: User = matched || {
      id: 'usr_' + Date.now(),
      name: email.split('@')[0],
      email: email,
      role: 'admin',
      status: 'active',
      assignedDevices: ['44:1D:64:BD:22:EC'],
      createdAt: new Date().toISOString()
    };
    setCurrentUser(userToSet);
    localStorage.setItem('sim800l_active_user', JSON.stringify(userToSet));
    return true;
  };

  const signup = async (name: string, email: string, password: string, role: UserRole = 'manager'): Promise<boolean> => {
    const newUser: User = {
      id: 'usr_' + Date.now(),
      name,
      email,
      role,
      status: 'active',
      assignedDevices: ['44:1D:64:BD:22:EC'],
      createdAt: new Date().toISOString()
    };
    setCurrentUser(newUser);
    localStorage.setItem('sim800l_active_user', JSON.stringify(newUser));
    return true;
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sim800l_active_user');
  };

  const switchRole = (role: UserRole) => {
    const user = DEMO_USERS[role];
    setCurrentUser(user);
    localStorage.setItem('sim800l_active_user', JSON.stringify(user));
  };

  const hasPermission = (requiredRole: UserRole): boolean => {
    if (!currentUser) return false;
    return ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[requiredRole];
  };

  if (!isLoaded) return null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        signup,
        forgotPassword,
        logout,
        switchRole,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

