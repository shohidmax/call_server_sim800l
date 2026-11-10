'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ClickToCopy from '@/components/ClickToCopy';
import { 
  Server, 
  PhoneCall, 
  MessageSquare, 
  Activity, 
  CheckCircle2, 
  Radio, 
  Signal, 
  Plus, 
  Users, 
  Clock, 
  Layers, 
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

export default function DashboardPage() {
  const { currentUser, hasPermission } = useAuth();
  const { devices, callJobs, smsMessages, complaints, behaviorLogs, triggerCall } = useData();

  // Metrics
  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const busyDevices = devices.filter(d => d.status === 'busy').length;
  const totalCalls = callJobs.length;
  const successfulCalls = callJobs.filter(c => c.status === 'success').length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 94;
  const totalSms = smsMessages.length;
  const openComplaints = complaints.filter(c => c.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-base-100 to-base-100 p-6 rounded-3xl border border-base-300/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary badge-sm font-bold uppercase tracking-wider">
              {currentUser?.role} Console
            </span>
            <span className="text-xs text-base-content/60 font-mono">SIM800L Cluster Core</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-base-content tracking-tight">
            Welcome, {currentUser?.name}
          </h1>
          <p className="text-xs md:text-sm text-base-content/70 mt-1 max-w-xl">
            Live operations monitor for GSM voice broadcast queues, cellular modems, DFPlayer prompts, and SMS pipelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('manager') && (
            <Link href="/devices" className="btn btn-sm btn-outline gap-2 font-bold">
              <Plus className="w-4 h-4" /> Add Device
            </Link>
          )}
          <Link href="/calls" className="btn btn-sm btn-primary gap-2 font-bold shadow-sm">
            <PhoneCall className="w-4 h-4" /> Start Broadcast
          </Link>
          <Link href="/calls/virtual" className="btn btn-sm btn-neutral gap-2 font-bold">
            <Radio className="w-4 h-4" /> IP Call Center
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hardware Status */}
        <div className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="card-body p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Fleet Nodes</span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-base-content">{devices.length}</span>
              <span className="text-xs font-semibold text-success flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> {onlineDevices} Online
              </span>
            </div>
            <p className="text-[11px] text-base-content/50 mt-1 truncate">
              {busyDevices > 0 ? `${busyDevices} nodes dialing active call` : 'All channels stand by'}
            </p>
          </div>
        </div>

        {/* Total Calls */}
        <div className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="card-body p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Total Calls</span>
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-base-content">{totalCalls}</span>
              <span className="badge badge-success badge-xs font-bold text-[10px]">{successRate}% OK</span>
            </div>
            <p className="text-[11px] text-base-content/50 mt-1 truncate">
              {successfulCalls} calls answered successfully
            </p>
          </div>
        </div>

        {/* SMS Messages */}
        <div className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="card-body p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">SMS Processed</span>
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-base-content">{totalSms}</span>
              <span className="text-xs font-bold text-base-content/60">texts</span>
            </div>
            <p className="text-[11px] text-base-content/50 mt-1 truncate">
              Bengali UCS2 & ASCII supported
            </p>
          </div>
        </div>

        {/* Quality Complaints */}
        <div className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="card-body p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Tickets / Feedback</span>
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-base-content">{openComplaints}</span>
              <span className="text-xs text-warning font-semibold">Active</span>
            </div>
            <p className="text-[11px] text-base-content/50 mt-1 truncate">
              Call quality & audio drop reports
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Hardware Fleet + Active Call Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Connected Hardware Fleet */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></div>
              <h2 className="text-base font-bold text-base-content">Active SIM800L Fleet</h2>
            </div>
            <Link href="/devices" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {devices.map(dev => (
              <div 
                key={dev.mac}
                className="card bg-base-100 border border-base-200 shadow-xs hover:border-primary/50 transition-all p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-primary font-bold">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-base-content flex items-center gap-1.5">
                        {dev.name}
                      </h4>
                      <ClickToCopy text={dev.mac} className="text-[11px] text-base-content/60" title="Click to copy MAC address" />
                    </div>
                  </div>
                  <span className={`badge badge-xs font-semibold capitalize py-2 px-2.5 ${
                    dev.status === 'online' ? 'badge-success' : dev.status === 'busy' ? 'badge-warning' : 'badge-neutral'
                  }`}>
                    {dev.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-base-200 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-base-content/50 block">Operator</span>
                    <span className="text-xs font-semibold text-base-content truncate block">{dev.sim_operator}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-base-content/50 block">Signal</span>
                    <span className="text-xs font-semibold text-base-content flex items-center justify-center gap-1">
                      <Signal className="w-3 h-3 text-success" /> {dev.sim_signal}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-base-content/50 block">Group</span>
                    <span className="text-xs font-semibold text-base-content truncate block">{dev.group}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 flex items-center justify-between text-[11px]">
                  <ClickToCopy text={dev.sim_number} className="text-base-content/60" title="Click to copy SIM phone number" />
                  <Link href={`/devices/${encodeURIComponent(dev.mac)}`} className="text-primary font-bold hover:underline">
                    Manage & Controls →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Virtual Devices & Bridge Preview */}
          <div className="card bg-gradient-to-r from-base-100 to-base-200/50 border border-base-200 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-base-content">Virtual GSM Aggregation & Cross-Cluster Bridges</h4>
                  <p className="text-[11px] text-base-content/60">Automatic failover pooling across 2 groups with 3 bridged SIM modems</p>
                </div>
              </div>
              <Link href="/devices/groups" className="btn btn-xs btn-outline">
                Configure Bridges
              </Link>
            </div>
          </div>
        </div>

        {/* Right Col: Recent Call Queue & Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-base-content flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Live Call Jobs
            </h2>
            <Link href="/calls" className="text-xs text-primary font-bold hover:underline">
              Full Queue →
            </Link>
          </div>

          <div className="card bg-base-100 border border-base-200 shadow-xs divide-y divide-base-200">
            {callJobs.slice(0, 6).map(job => (
              <div key={job._id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <ClickToCopy text={job.phone} className="font-mono font-bold text-base-content" title="Click to copy phone number" />
                  <p className="text-[10px] text-base-content/50">
                    Track: {job.audio || 'None'} • {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`badge badge-sm font-bold uppercase text-[10px] ${
                  job.status === 'success' 
                    ? 'badge-success text-white' 
                    : job.status === 'calling' 
                    ? 'badge-info animate-pulse' 
                    : job.status === 'received' 
                    ? 'badge-accent' 
                    : 'badge-ghost'
                }`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>

          {/* Behavior Audit Trail Preview */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Audit Log</span>
              <Link href="/users/logs" className="text-[11px] text-primary hover:underline font-semibold">
                View Trail
              </Link>
            </div>
            <div className="card bg-base-100 border border-base-200 shadow-xs p-3 space-y-2 text-[11px]">
              {behaviorLogs.length === 0 ? (
                <p className="text-base-content/50 text-center py-2">No activity recorded yet</p>
              ) : (
                behaviorLogs.slice(0, 3).map(log => (
                  <div key={log.id} className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-base-content">{log.userName}: </span>
                      <span className="text-base-content/70">{log.details}</span>
                    </div>
                    <span className="text-[9px] text-base-content/40 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
