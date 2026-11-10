'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ThemeToggle from '@/components/ThemeToggle';
import { UserRole } from '@/types/user';
import { 
  Wifi, 
  WifiOff, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  PhoneCall, 
  ShieldCheck, 
  Menu,
  Sparkles
} from 'lucide-react';

export default function Navbar({ onOpenQuickDial }: { onOpenQuickDial?: () => void }) {
  const { currentUser, switchRole, logout, isAuthenticated } = useAuth();
  const { serverConnected, devices, complaints, activeServerUrl, switchServer } = useData();

  const openTickets = complaints.filter(c => c.status === 'open').length;

  return (
    <header className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-40 px-3 sm:px-6 lg:px-8 shadow-xs">
      <div className="flex-1 items-center gap-2 sm:gap-4">
        {/* Mobile menu hamburger toggle button */}
        <label 
          htmlFor="app-drawer" 
          className="btn btn-square btn-ghost btn-sm sm:btn-md lg:hidden"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 text-base-content" />
        </label>

        {/* Server Status Dropdown & Node Indicator */}
        <div className="flex items-center gap-2">
          <div className="dropdown">
            <label tabIndex={0} className="cursor-pointer">
              {serverConnected ? (
                <div 
                  className="badge badge-success badge-sm gap-1.5 py-2 px-2.5 text-[11px] font-semibold shadow-xs hover:opacity-90 transition-opacity"
                  title="Click to view or switch cluster server"
                >
                  <span className="w-2 h-2 rounded-full bg-success-content animate-pulse"></span>
                  <span className="font-mono">
                    {activeServerUrl.includes('maxapi') ? 'sim800l.maxapi (Cloud)' : (activeServerUrl.includes('800lcall') ? '800lcall (Main)' : 'Localhost:3000')}
                  </span>
                </div>
              ) : (
                <div 
                  className="badge badge-warning badge-sm gap-1.5 py-2 px-2.5 text-[11px] font-semibold shadow-xs hover:opacity-90 transition-opacity"
                  title="Click to view or switch cluster server"
                >
                  <span className="w-2 h-2 rounded-full bg-warning-content"></span>
                  <span>Connecting...</span>
                </div>
              )}
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-64 border border-base-200 z-50 text-xs mt-2">
              <li className="menu-title text-[10px] tracking-wider uppercase font-bold text-base-content/50">Cluster Server Routing</li>
              <li>
                <button 
                  onClick={() => switchServer('https://sim800l.maxapi.esp32.site')} 
                  className={activeServerUrl.includes('maxapi') ? 'active font-bold text-emerald-600' : ''}
                >
                  🌐 Cloud Backup (sim800l.maxapi.esp32.site)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => switchServer('https://800lcall.espserver.site')} 
                  className={activeServerUrl.includes('800lcall') ? 'active font-bold text-primary' : ''}
                >
                  🌐 Cloud Main (800lcall.espserver.site)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => switchServer('http://localhost:3000')} 
                  className={activeServerUrl.includes('localhost') ? 'active font-bold text-purple-600' : ''}
                >
                  💻 Localhost (http://localhost:3000)
                </button>
              </li>
            </ul>
          </div>

          <div className="hidden md:flex items-center text-xs text-base-content/60 font-mono gap-1">
            <span>Cluster:</span>
            <span className="font-bold text-primary">{devices.length} Nodes</span>
          </div>
        </div>
      </div>

      <div className="flex-none items-center gap-3">
        {/* Quick Dial Button */}
        {onOpenQuickDial && (
          <button 
            onClick={onOpenQuickDial}
            className="btn btn-sm btn-primary gap-2 shadow-sm text-xs font-semibold"
          >
            <PhoneCall className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Call</span>
          </button>
        )}

        {/* Interactive Role Switcher for instant Demo & Testing */}
        {isAuthenticated && (
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-outline btn-ghost gap-2 normal-case border-base-300">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline font-bold uppercase text-xs">{currentUser?.role}</span>
              <span className="badge badge-xs badge-neutral">Role</span>
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-52 border border-base-200 z-50 text-xs">
              <li className="menu-title text-[10px] tracking-wider uppercase font-bold text-base-content/50">Switch Active Role</li>
              <li>
                <button onClick={() => switchRole('admin')} className={currentUser?.role === 'admin' ? 'active font-bold' : ''}>
                  👑 Super Admin (Full Control)
                </button>
              </li>
              <li>
                <button onClick={() => switchRole('manager')} className={currentUser?.role === 'manager' ? 'active font-bold' : ''}>
                  💼 Manager (Ops & Fleet)
                </button>
              </li>
              <li>
                <button onClick={() => switchRole('moderator')} className={currentUser?.role === 'moderator' ? 'active font-bold' : ''}>
                  🎧 Moderator (Calls & SMS)
                </button>
              </li>
              <li>
                <button onClick={() => switchRole('viewer')} className={currentUser?.role === 'viewer' ? 'active font-bold' : ''}>
                  👁️ Viewer (Read Only)
                </button>
              </li>
            </ul>
          </div>
        )}

        {/* Dark/Light Theme Toggle */}
        <ThemeToggle />

        {/* Notifications / Tickets */}
        <Link href="/calls/feedback" className="btn btn-ghost btn-circle btn-sm relative">
          <Bell className="w-4 h-4" />
          {openTickets > 0 && (
            <span className="badge badge-error badge-xs absolute -top-1 -right-1 text-[9px] p-1 font-bold">
              {openTickets}
            </span>
          )}
        </Link>

        {/* User Profile dropdown */}
        {isAuthenticated ? (
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar btn-sm ring-1 ring-primary/30">
              <div className="w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                {currentUser?.name.charAt(0) || 'U'}
              </div>
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-2xl bg-base-100 rounded-box w-60 border border-base-200 z-50 text-xs">
              <li className="p-3 border-b border-base-200 bg-base-200/40 rounded-t-lg">
                <p className="font-bold text-sm text-base-content truncate">{currentUser?.name}</p>
                <p className="text-base-content/60 text-[11px] truncate">{currentUser?.email}</p>
                <span className="badge badge-primary badge-xs mt-1.5 font-bold uppercase">{currentUser?.role}</span>
              </li>
              <li><Link href="/users">User Directory & Sharing</Link></li>
              <li><Link href="/users/logs">Behavior Audit Logs</Link></li>
              <li className="border-t border-base-200 mt-1 pt-1">
                <button onClick={logout} className="text-error font-semibold flex items-center justify-between">
                  <span>Sign Out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link href="/login" className="btn btn-sm btn-ghost">Login</Link>
            <Link href="/signup" className="btn btn-sm btn-primary">Sign Up</Link>
          </div>
        )}
      </div>
    </header>
  );
}

