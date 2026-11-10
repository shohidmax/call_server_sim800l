'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { IncomingCall } from '@/types/call';
import { 
  PhoneIncoming, 
  Search, 
  CheckCircle2, 
  XCircle, 
  PhoneForwarded, 
  Clock, 
  PhoneCall, 
  ShieldCheck,
  Radio,
  Trash2,
  Calendar,
  X,
  Download,
  FileText
} from 'lucide-react';
import { exportIncomingPdf } from '@/utils/pdfExport';
import ClickToCopy from '@/components/ClickToCopy';

export default function IncomingCallsPage() {
  const { hasPermission } = useAuth();
  const { incomingCalls, triggerCall, deleteIncomingCall, clearIncomingCalls } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Quick Date Range Presets
  const setQuickRange = (range: 'today' | '7days' | '30days' | 'all') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (range === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (range === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (range === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const filtered = useMemo(() => {
    return incomingCalls.filter(call => {
      const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
      const matchesSearch = call.callerNumber.includes(searchTerm) || call.deviceName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesStatus || !matchesSearch) return false;

      // Date Range Matching
      if (call.timestamp) {
        const callTime = new Date(call.timestamp).getTime();
        if (startDate) {
          const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
          if (callTime < startTimestamp) return false;
        }
        if (endDate) {
          const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
          if (callTime > endTimestamp) return false;
        }
      }

      return true;
    });
  }, [incomingCalls, statusFilter, searchTerm, startDate, endDate]);

  const exportIncomingCSV = () => {
    const headers = ["ID", "Caller Number", "Status", "Receiving Node", "Device MAC", "Duration (s)", "Timestamp", "Notes"];
    const rows = filtered.map(c => [
      `"${c.id}"`,
      `"${c.callerNumber}"`,
      `"${c.status}"`,
      `"${c.deviceName}"`,
      `"${c.deviceMac}"`,
      c.durationSeconds || 0,
      `"${new Date(c.timestamp).toISOString()}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inbound_calls_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportIncomingPDF = () => {
    exportIncomingPdf(
      {
        title: 'Inbound Cellular Call Reception & Gateway History',
        subtitle: 'SIM800L Gateway Received Calls Audit Log',
        dateRange: { from: startDate, to: endDate },
        generatedBy: 'Administrator',
        summaryMetrics: [
          { label: 'Total Inbound', value: incomingCalls.length, color: '#0f172a' },
          { label: 'Answered', value: incomingCalls.filter(c => c.status === 'answered').length, color: '#16a34a' },
          { label: 'Missed Calls', value: incomingCalls.filter(c => c.status === 'missed').length, color: '#dc2626' },
          { label: 'Auto-Rejected', value: incomingCalls.filter(c => c.status === 'rejected').length, color: '#475569' }
        ]
      },
      filtered
    );
  };

  const getStatusBadge = (status: IncomingCall['status']) => {
    switch (status) {
      case 'answered':
        return <span className="badge badge-success badge-sm font-bold uppercase text-[10px] text-white">Answered</span>;
      case 'missed':
        return <span className="badge badge-error badge-sm font-bold uppercase text-[10px] text-white">Missed</span>;
      case 'rejected':
        return <span className="badge badge-neutral badge-sm font-bold uppercase text-[10px]">Blocked / Rejected</span>;
      case 'forwarded':
        return <span className="badge badge-info badge-sm font-bold uppercase text-[10px] text-white">Forwarded</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
          <PhoneIncoming className="w-6 h-6 text-primary" /> Incoming & Received Call Center
        </h1>
        <p className="text-xs text-base-content/60 mt-0.5">
          Log of inbound calls received by physical SIM800L cellular modems and forwarded virtual trunks
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Inbound Ringing</span>
          <span className="text-2xl font-black text-base-content">{incomingCalls.length}</span>
          <span className="text-[10px] text-base-content/50 block mt-1">Total received calls</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Answered Rate</span>
          <span className="text-2xl font-black text-success">
            {incomingCalls.filter(c => c.status === 'answered').length}
          </span>
          <span className="text-[10px] text-success block mt-1">Successfully connected</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Missed Calls</span>
          <span className="text-2xl font-black text-error">
            {incomingCalls.filter(c => c.status === 'missed').length}
          </span>
          <span className="text-[10px] text-error block mt-1">Requires callback</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Auto-Rejected</span>
          <span className="text-2xl font-black text-neutral">
            {incomingCalls.filter(c => c.status === 'rejected').length}
          </span>
          <span className="text-[10px] text-base-content/50 block mt-1">Blocked list hits</span>
        </div>
      </div>

      {/* Search & Date Filter Bar */}
      <div className="bg-base-100 p-4 rounded-2xl border border-base-200 shadow-xs space-y-3">
        {/* Row 1: Search, Status Filter & Actions */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text" 
              placeholder="Search by caller phone number or receiving gateway node..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input input-bordered input-sm w-full pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="select select-bordered select-sm text-xs font-semibold"
            >
              <option value="all">All Inbound Statuses</option>
              <option value="answered">Answered</option>
              <option value="missed">Missed</option>
              <option value="rejected">Rejected / Blocked</option>
              <option value="forwarded">Forwarded</option>
            </select>

            <button 
              onClick={exportIncomingCSV}
              disabled={filtered.length === 0}
              className="btn btn-sm btn-ghost gap-1.5 text-xs font-bold border border-base-200"
              title="Export filtered incoming calls as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button 
              onClick={exportIncomingPDF}
              disabled={filtered.length === 0}
              className="btn btn-sm btn-ghost text-error gap-1.5 text-xs font-bold border border-error/20 hover:bg-error/10"
              title="Export filtered incoming calls as printable vector PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            {hasPermission('admin') && incomingCalls.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear all incoming call history? This action is permanent.')) {
                    clearIncomingCalls();
                  }
                }}
                className="btn btn-sm btn-ghost text-error text-xs gap-1 border border-error/20"
                title="Clear all incoming call logs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date to Date Filter & Quick Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2.5 border-t border-base-200/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-base-200/50 py-1 px-2.5 rounded-xl border border-base-200">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase font-bold text-base-content/60">From:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent font-mono text-xs outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-base-200/50 py-1 px-2.5 rounded-xl border border-base-200">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase font-bold text-base-content/60">To:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent font-mono text-xs outline-none cursor-pointer"
              />
            </div>

            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="btn btn-ghost btn-xs text-error gap-1 text-[11px]"
                title="Reset Date Filters"
              >
                <X className="w-3 h-3" /> Clear Dates
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-base-content/50 uppercase font-bold mr-1">Quick Range:</span>
            <button 
              onClick={() => setQuickRange('today')} 
              className={`btn btn-xs ${startDate && startDate === endDate ? 'btn-primary' : 'btn-ghost'}`}
            >
              Today
            </button>
            <button 
              onClick={() => setQuickRange('7days')} 
              className="btn btn-ghost btn-xs"
            >
              Last 7 Days
            </button>
            <button 
              onClick={() => setQuickRange('30days')} 
              className="btn btn-ghost btn-xs"
            >
              Last 30 Days
            </button>
            <button 
              onClick={() => setQuickRange('all')} 
              className={`btn btn-xs ${!startDate && !endDate ? 'btn-neutral' : 'btn-ghost'}`}
            >
              All Time
            </button>

            <span className="badge badge-outline badge-sm ml-2 font-mono text-[10px]">
              Showing {filtered.length} of {incomingCalls.length}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 border border-base-200 shadow-xs overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="border-b border-base-200 text-[11px] uppercase tracking-wider text-base-content/60">
              <th>Caller Phone Number</th>
              <th>Status</th>
              <th>Receiving Hardware Node</th>
              <th>Duration</th>
              <th>Timestamp</th>
              <th>Notes & Context</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 text-xs">
            {filtered.map(call => (
              <tr key={call.id} className="hover:bg-base-200/40">
                <td>
                  <ClickToCopy 
                    text={call.callerNumber} 
                    className="font-mono font-bold text-base-content text-sm block" 
                    title="Click to copy caller phone number" 
                  />
                </td>
                <td>{getStatusBadge(call.status)}</td>
                <td>
                  <span className="font-semibold text-base-content block">{call.deviceName}</span>
                  <ClickToCopy 
                    text={call.deviceMac} 
                    className="text-[10px] text-base-content/50" 
                    title="Click to copy MAC address" 
                  />
                </td>
                <td className="font-mono text-xs">
                  {call.durationSeconds > 0 ? `${call.durationSeconds}s` : '—'}
                </td>
                <td className="font-mono text-[11px] text-base-content/60">
                  {new Date(call.timestamp).toLocaleString()}
                </td>
                <td className="text-base-content/70 max-w-xs truncate">
                  {call.notes || '—'}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      onClick={() => triggerCall(call.deviceMac, call.callerNumber, '0001')}
                      className="btn btn-xs btn-primary font-bold gap-1"
                    >
                      <PhoneCall className="w-3 h-3" /> Call Back
                    </button>
                    {hasPermission('admin') && (
                      <button 
                        onClick={() => {
                          if (confirm('Delete this inbound call record?')) {
                            deleteIncomingCall(call.id);
                          }
                        }}
                        className="btn btn-xs btn-ghost text-error"
                        title="Delete Call Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

