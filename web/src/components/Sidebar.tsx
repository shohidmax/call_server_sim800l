'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LayoutDashboard,
  Server,
  Network,
  Cpu,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Radio,
  Music,
  MessageSquare,
  Users,
  ShieldAlert,
  ClipboardList,
  Sparkles,
  ArrowRightLeft,
  Megaphone,
  X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, currentUser } = useAuth();

  const closeDrawer = () => {
    const drawerCheckbox = document.getElementById('app-drawer') as HTMLInputElement | null;
    if (drawerCheckbox) {
      drawerCheckbox.checked = false;
    }
  };

  const isLinkActive = (href: string) => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  const navItemClass = (href: string) => `
    flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all
    ${isLinkActive(href) 
      ? 'bg-primary text-primary-content shadow-sm font-semibold' 
      : 'text-base-content/80 hover:bg-base-200 hover:text-base-content'}
  `;

  return (
    <aside className="w-64 bg-base-100 border-r border-base-200 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-base-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-primary-content shadow-md shadow-primary/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-1 text-base-content">
              SIM800L <span className="text-primary text-xs uppercase px-1.5 py-0.5 rounded bg-primary/10">Cloud</span>
            </h1>
            <p className="text-[10px] text-base-content/60 font-medium">ESP32 Voice & SMS Hub</p>
          </div>
        </div>

        {/* Mobile close drawer button */}
        <button 
          onClick={closeDrawer}
          className="btn btn-ghost btn-circle btn-xs lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav list */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Core */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
            Overview
          </div>
          <div className="space-y-1">
            <Link href="/" onClick={closeDrawer} className={navItemClass('/')}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Fleet & Devices */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
            Device Management
          </div>
          <div className="space-y-1">
            <Link href="/devices" onClick={closeDrawer} className={navItemClass('/devices')}>
              <Server className="w-4 h-4" />
              <span>All Hardware Fleet</span>
            </Link>
            <Link href="/devices/groups" onClick={closeDrawer} className={navItemClass('/devices/groups')}>
              <Network className="w-4 h-4" />
              <span>Groups & Bridges</span>
            </Link>
            <Link href="/devices/virtual" onClick={closeDrawer} className={navItemClass('/devices/virtual')}>
              <Cpu className="w-4 h-4" />
              <span>Virtual GSM Devices</span>
            </Link>
          </div>
        </div>

        {/* Voice & Call Systems */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
            Voice & Call Engine
          </div>
          <div className="space-y-1">
            <Link href="/calls" onClick={closeDrawer} className={navItemClass('/calls')}>
              <Phone className="w-4 h-4" />
              <span>Call History & Queue</span>
            </Link>
            <Link href="/calls/incoming" onClick={closeDrawer} className={navItemClass('/calls/incoming')}>
              <PhoneIncoming className="w-4 h-4" />
              <span>Incoming & Received</span>
            </Link>
            <Link href="/calls/virtual" onClick={closeDrawer} className={navItemClass('/calls/virtual')}>
              <Radio className="w-4 h-4" />
              <span>IP & Virtual Calling</span>
            </Link>
            <Link href="/calls/blocked" onClick={closeDrawer} className={navItemClass('/calls/blocked')}>
              <PhoneOff className="w-4 h-4" />
              <span>Blocked Numbers</span>
            </Link>
            <Link href="/audio" onClick={closeDrawer} className={navItemClass('/audio')}>
              <Music className="w-4 h-4" />
              <span>Audio Prompts (DFPlayer)</span>
            </Link>
            <Link href="/calls/feedback" onClick={closeDrawer} className={navItemClass('/calls/feedback')}>
              <ShieldAlert className="w-4 h-4" />
              <span>Feedback & Complaints</span>
            </Link>
          </div>
        </div>

        {/* Campaigns & Broadcast */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40 flex items-center justify-between">
            <span>Campaigns</span>
            <span className="badge badge-primary badge-xs scale-90">Auto</span>
          </div>
          <div className="space-y-1">
            <Link href="/campaigns" onClick={closeDrawer} className={navItemClass('/campaigns')}>
              <Megaphone className="w-4 h-4 text-secondary" />
              <span>Call & SMS Campaigns</span>
            </Link>
          </div>
        </div>

        {/* Messaging */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
            SMS Messaging
          </div>
          <div className="space-y-1">
            <Link href="/sms" onClick={closeDrawer} className={navItemClass('/sms')}>
              <MessageSquare className="w-4 h-4" />
              <span>SMS Inbox & Dispatch</span>
            </Link>
          </div>
        </div>

        {/* Administration */}
        {hasPermission('manager') && (
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
              User & Security
            </div>
            <div className="space-y-1">
              <Link href="/users" onClick={closeDrawer} className={navItemClass('/users')}>
                <Users className="w-4 h-4" />
                <span>User Directory & Roles</span>
              </Link>
              <Link href="/users/logs" onClick={closeDrawer} className={navItemClass('/users/logs')}>
                <ClipboardList className="w-4 h-4" />
                <span>Behavior Audit Trail</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Footer Info & Theme Switcher */}
      <div className="p-4 border-t border-base-200 bg-base-200/30 text-[11px] text-base-content/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-base-content/70">Theme Mode</span>
          <ThemeToggle showLabel />
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] pt-1 border-t border-base-200/50">
          <span>Firmware v3.2</span>
          <span className="badge badge-xs badge-outline">Ready</span>
        </div>
      </div>
    </aside>
  );
}

