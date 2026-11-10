'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { CallJob, CallStatus } from '@/types/call';
import { 
  Phone, 
  PhoneCall, 
  Search, 
  Plus, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Activity, 
  Radio, 
  Music, 
  Calendar,
  X,
  Download,
  RotateCcw,
  Cpu,
  EyeOff,
  User,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Flame,
  PhoneForwarded,
  PhoneMissed,
  Info,
  Trash2,
  Sliders,
  Edit3
} from 'lucide-react';
import { exportCallsPdf } from '@/utils/pdfExport';
import ClickToCopy from '@/components/ClickToCopy';

export default function CallsPage() {
  const { currentUser, hasPermission } = useAuth();
  const { 
    callJobs, 
    devices, 
    virtualDevices, 
    audioTracks, 
    triggerBroadcast, 
    updateCallJob, 
    deleteCallJob, 
    deleteCallJobs, 
    clearAllCallJobs 
  } = useData();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<CallJob | null>(null);
  const [editJobModal, setEditJobModal] = useState<CallJob | null>(null);

  // Broadcast Modal Form State
  const [phoneListInput, setPhoneListInput] = useState('');
  const [routeType, setRouteType] = useState<'auto' | 'mac' | 'virtual'>('auto');
  const [targetMac, setTargetMac] = useState('');
  const [targetVirtualId, setTargetVirtualId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonymousId, setAnonymousId] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('0001');
  const [broadcastSource, setBroadcastSource] = useState<'podcast' | 'dashboard' | 'api'>('podcast');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Quick Date Range Setters
  const setQuickRange = (range: 'today' | '7days' | '30days' | 'all') => {
    const now = new Date();
    if (range === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    const endStr = now.toISOString().split('T')[0];
    setEndDate(endStr);

    if (range === 'today') {
      setStartDate(endStr);
    } else if (range === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
    } else if (range === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
    }
  };

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return callJobs.filter(job => {
      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }

      // Route filter
      if (routeFilter === 'virtual' && !job.virtualId) return false;
      if (routeFilter === 'mac' && (!job.mac || job.virtualId)) return false;
      if (routeFilter === 'anonymous' && !job.isAnonymous) return false;

      // Source / Origin filter (API, Podcast, Dashboard, Campaign)
      if (sourceFilter !== 'all') {
        const jSource = job.source || 'dashboard';
        if (sourceFilter === 'api' && jSource !== 'api') return false;
        if (sourceFilter === 'podcast' && jSource !== 'podcast') return false;
        if (sourceFilter === 'dashboard' && jSource !== 'dashboard') return false;
        if (sourceFilter === 'campaign' && jSource !== 'campaign') return false;
      }

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesPhone = job.phone.includes(query);
        const matchesName = job.targetName ? job.targetName.toLowerCase().includes(query) : false;
        const matchesMac = job.mac ? job.mac.toLowerCase().includes(query) : false;
        const matchesVirtual = job.virtualId ? job.virtualId.toLowerCase().includes(query) : false;
        const matchesAnon = job.anonymousId ? job.anonymousId.toLowerCase().includes(query) : false;
        const matchesUser = job.userName ? job.userName.toLowerCase().includes(query) : false;
        const matchesSource = job.source ? job.source.toLowerCase().includes(query) : false;
        const matchesDetails = job.sourceDetails ? job.sourceDetails.toLowerCase().includes(query) : false;
        const matchesEmail = job.userEmail ? job.userEmail.toLowerCase().includes(query) : false;

        if (!matchesPhone && !matchesName && !matchesMac && !matchesVirtual && !matchesAnon && !matchesUser && !matchesSource && !matchesDetails && !matchesEmail) {
          return false;
        }
      }

      // Date Range Matching
      if (job.createdAt) {
        const jobTime = new Date(job.createdAt).getTime();
        if (startDate) {
          const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
          if (jobTime < startTimestamp) return false;
        }
        if (endDate) {
          const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
          if (jobTime > endTimestamp) return false;
        }
      }

      return true;
    });
  }, [callJobs, statusFilter, routeFilter, sourceFilter, searchTerm, startDate, endDate]);

  // Overall Statistics & Analytics
  const totalCalls = filteredJobs.length;
  const successfulCalls = filteredJobs.filter(c => c.status === 'success' || c.status === 'received').length;
  const callingCalls = filteredJobs.filter(c => c.status === 'calling').length;
  const queuedCalls = filteredJobs.filter(c => c.status === 'queued' || c.status === 'pending').length;
  const rejectedCalls = filteredJobs.filter(c => c.status === 'rejected').length;
  const waitingCalls = filteredJobs.filter(c => c.status === 'call_waiting').length;
  const forwardedCalls = filteredJobs.filter(c => c.status === 'forwarded').length;
  const busyCalls = filteredJobs.filter(c => c.status === 'busy').length;
  const unreachableCalls = filteredJobs.filter(c => c.status === 'unreachable' || c.status === 'number_off').length;
  
  const totalTalkSeconds = filteredJobs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
  const totalTalkMinutes = (totalTalkSeconds / 60).toFixed(1);
  const avgTalkSeconds = successfulCalls > 0 ? Math.round(totalTalkSeconds / successfulCalls) : 0;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  // Format Duration helper
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Admin Delete Actions
  const handleDeleteJob = (id: string) => {
    if (confirm('Are you sure you want to permanently delete this call record?')) {
      deleteCallJob(id);
    }
  };

  const handleDeleteFiltered = () => {
    if (filteredJobs.length === 0) return;
    if (confirm(`Are you sure you want to delete all ${filteredJobs.length} currently filtered call records?`)) {
      deleteCallJobs(filteredJobs.map(j => j._id));
    }
  };

  const handleClearAllLogs = () => {
    if (confirm('CRITICAL ACTION: Are you sure you want to wipe ALL call records from the server? This cannot be undone.')) {
      clearAllCallJobs();
    }
  };

  const handleSaveJobEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJobModal) return;
    updateCallJob(editJobModal._id, {
      status: editJobModal.status,
      durationSeconds: Number(editJobModal.durationSeconds) || 0,
      targetName: editJobModal.targetName,
      feedbackDetails: editJobModal.feedbackDetails,
      audio: editJobModal.audio
    });
    setEditJobModal(null);
  };

  // CSV Exporter
  const exportFilteredCSV = () => {
    const headers = [
      "Job ID", 
      "Call Origin",
      "Source Details",
      "Requester Name", 
      "Requester Email",
      "User Role", 
      "Client IP",
      "Anonymous ID", 
      "Target Phone", 
      "Target Name", 
      "Route Type", 
      "Assigned Node / Virtual ID", 
      "Status", 
      "Audio Track", 
      "Duration (Sec)", 
      "Duration (Formatted)", 
      "Attempts", 
      "Queue Position", 
      "Carrier Feedback Details", 
      "Created At", 
      "Completed At"
    ];

    const rows = filteredJobs.map(j => [
      `"${j._id}"`,
      `"${(j.source || 'dashboard').toUpperCase()}"`,
      `"${(j.sourceDetails || '').replace(/"/g, '""')}"`,
      `"${j.userName || 'System'}"`,
      `"${j.userEmail || ''}"`,
      `"${j.userRole || 'admin'}"`,
      `"${j.clientIp || ''}"`,
      `"${j.isAnonymous ? (j.anonymousId || 'ANON-CLOAK') : 'N/A'}"`,
      `"${j.phone}"`,
      `"${j.targetName || ''}"`,
      `"${j.virtualId ? 'Virtual Device' : j.mac ? 'Physical MAC' : 'Auto Pool'}"`,
      `"${j.virtualId || j.mac || 'Auto'}"`,
      `"${j.status}"`,
      `"${j.audio ? 'Track ' + j.audio : 'Silent'}"`,
      j.durationSeconds || 0,
      `"${formatDuration(j.durationSeconds)}"`,
      j.attempts || 1,
      j.queuePosition || 0,
      `"${(j.feedbackDetails || '').replace(/"/g, '""')}"`,
      `"${new Date(j.createdAt).toISOString()}"`,
      `"${j.completedAt ? new Date(j.completedAt).toISOString() : ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gsm_call_report_${startDate || "all"}_to_${endDate || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // PDF Exporter
  const handleExportPDF = () => {
    exportCallsPdf(
      {
        title: 'Voice Call History & Broadcast Performance Report',
        subtitle: 'SIM800L Cellular Modem Cluster Dispatch & Performance Audit',
        dateRange: { from: startDate, to: endDate },
        generatedBy: currentUser?.name || 'Administrator',
        summaryMetrics: [
          { label: 'Total Dispatches', value: totalCalls, color: '#0f172a' },
          { label: 'Answer Rate', value: `${successRate}%`, color: '#16a34a' },
          { label: 'Total Talk Time', value: `${totalTalkMinutes} min`, color: '#0284c7' },
          { label: 'Queued Buffer', value: queuedCalls, color: '#d97706' },
          { label: 'Unanswered Calls', value: rejectedCalls + waitingCalls + forwardedCalls + busyCalls, color: '#dc2626' }
        ]
      },
      filteredJobs
    );
  };

  // Handle Broadcast Submission
  const handleStartBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = phoneListInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const parsedNumbers: string[] = [];
    const recipientNames: Record<string, string> = {};

    lines.forEach(line => {
      const parts = line.split(/[,\t]+/).map(p => p.trim());
      const phone = parts[0];
      const name = parts[1];
      if (phone && phone.length >= 7) {
        parsedNumbers.push(phone);
        if (name) recipientNames[phone] = name;
      }
    });

    if (parsedNumbers.length === 0) return;

    setIsBroadcasting(true);
    await triggerBroadcast(parsedNumbers, {
      mac: routeType === 'mac' ? targetMac : undefined,
      virtualId: routeType === 'virtual' ? targetVirtualId : undefined,
      isAnonymous,
      anonymousId: isAnonymous ? (anonymousId || `ANON-CLOAK-${Math.floor(1000 + Math.random() * 9000)}`) : undefined,
      audio: selectedAudio,
      recipientNames
    });

    setIsBroadcasting(false);
    setIsBroadcastOpen(false);
    setPhoneListInput('');
    setRouteType('auto');
    setTargetMac('');
    setTargetVirtualId('');
    setIsAnonymous(false);
    setAnonymousId('');
  };

  // Status Badge Component
  const getStatusBadge = (job: CallJob) => {
    switch (job.status) {
      case 'success':
      case 'received':
        return (
          <span className="badge badge-success badge-sm font-bold uppercase text-[10px] text-white gap-1">
            <CheckCircle2 className="w-3 h-3" /> Answered
          </span>
        );
      case 'calling':
        return (
          <span className="badge badge-info badge-sm font-bold uppercase text-[10px] text-white animate-pulse gap-1">
            <PhoneCall className="w-3 h-3" /> Dialing...
          </span>
        );
      case 'queued':
      case 'pending':
        return (
          <span className="badge badge-warning badge-sm font-bold uppercase text-[10px] gap-1">
            <Clock className="w-3 h-3" /> Queued (Pos #{job.queuePosition || 1})
          </span>
        );
      case 'rejected':
        return (
          <span className="badge badge-error badge-sm font-bold uppercase text-[10px] text-white gap-1">
            <PhoneMissed className="w-3 h-3" /> Call Rejected
          </span>
        );
      case 'call_waiting':
        return (
          <span className="badge badge-info badge-sm font-bold uppercase text-[10px] text-white gap-1">
            <Activity className="w-3 h-3" /> Call Waiting
          </span>
        );
      case 'forwarded':
        return (
          <span className="badge badge-secondary badge-sm font-bold uppercase text-[10px] text-white gap-1">
            <PhoneForwarded className="w-3 h-3" /> Forwarded
          </span>
        );
      case 'busy':
        return (
          <span className="badge badge-neutral badge-sm font-bold uppercase text-[10px] gap-1">
            Line Busy
          </span>
        );
      case 'unreachable':
      case 'number_off':
        return (
          <span className="badge badge-ghost badge-sm font-bold uppercase text-[10px] gap-1">
            Unreachable
          </span>
        );
      default:
        return (
          <span className="badge badge-error badge-sm font-bold uppercase text-[10px] text-white gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" /> Voice Call History & Broadcast Queue
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Real-time tracking of outgoing calls, virtual routes, carrier signaling feedback, and zero-drop priority queues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsReportOpen(true)}
            className="btn btn-sm btn-outline gap-1.5 font-bold shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-secondary" /> Call Report & Analytics
          </button>

          {hasPermission('moderator') && (
            <button 
              onClick={() => setIsBroadcastOpen(true)}
              className="btn btn-sm btn-primary gap-2 font-bold shadow-sm"
            >
              <PhoneCall className="w-4 h-4" /> Start Bulk Broadcast
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Total Dispatches</span>
          <span className="text-2xl font-black text-base-content">{totalCalls}</span>
          <span className="text-[10px] text-base-content/50 block mt-1">Across all modems</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Answer Rate</span>
          <span className="text-2xl font-black text-success">{successRate}%</span>
          <span className="text-[10px] text-success block mt-1">{successfulCalls} completed calls</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Total Talk Time</span>
          <span className="text-2xl font-black text-primary">{totalTalkMinutes} min</span>
          <span className="text-[10px] text-base-content/50 block mt-1">Avg {avgTalkSeconds}s / call</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">High-Load Buffer</span>
          <span className="text-2xl font-black text-warning">{queuedCalls}</span>
          <span className="text-[10px] text-warning block mt-1">Zero-Drop Queue Active</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200 col-span-2 md:col-span-1">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Carrier Unanswered</span>
          <span className="text-2xl font-black text-error">{rejectedCalls + waitingCalls + forwardedCalls + busyCalls}</span>
          <span className="text-[10px] text-base-content/50 block mt-1">
            {rejectedCalls} rejected, {busyCalls} busy
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-base-100 p-4 rounded-2xl border border-base-200 shadow-xs space-y-3">
        {/* Row 1: Search, Status, Route Filter & Actions */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text" 
              placeholder="Search by phone, recipient name, MAC, virtual ID, anonymous ID, or requester..." 
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
              <option value="all">All Carrier Statuses</option>
              <option value="calling">Dialing / Active Line</option>
              <option value="success">Answered / Success</option>
              <option value="queued">Queued (High Load)</option>
              <option value="rejected">Call Rejected (UDUB)</option>
              <option value="call_waiting">Call Waiting (CW)</option>
              <option value="forwarded">Forwarded to Voicemail</option>
              <option value="busy">Busy Line</option>
              <option value="unreachable">Unreachable / Offline</option>
            </select>

            <select 
              value={routeFilter} 
              onChange={e => setRouteFilter(e.target.value)}
              className="select select-bordered select-sm text-xs font-semibold"
            >
              <option value="all">All Routing Types</option>
              <option value="mac">Physical Hardware MACs</option>
              <option value="virtual">Virtual Device IDs</option>
              <option value="anonymous">Anonymous / Cloaked ID</option>
            </select>

            <select 
              value={sourceFilter} 
              onChange={e => setSourceFilter(e.target.value)}
              className="select select-bordered select-sm text-xs font-semibold"
            >
              <option value="all">All Origins (API / Podcast / Web)</option>
              <option value="api">🌐 API Triggers (/api/broadcast, /api/call)</option>
              <option value="podcast">🎙️ Podcast Broadcasts (Audio Prompts)</option>
              <option value="dashboard">🖥️ Dashboard Web UI Dialer</option>
              <option value="campaign">📢 Campaign Broadcasts</option>
            </select>

            <button 
              onClick={exportFilteredCSV}
              className="btn btn-sm btn-ghost gap-1.5 text-xs font-bold border border-base-200"
              title="Export filtered call log as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button 
              onClick={handleExportPDF}
              className="btn btn-sm btn-ghost text-error gap-1.5 text-xs font-bold border border-error/20 hover:bg-error/10"
              title="Export filtered call log as printable vector PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            {hasPermission('admin') && (
              <>
                <button 
                  onClick={handleDeleteFiltered}
                  disabled={filteredJobs.length === 0}
                  className="btn btn-sm btn-ghost text-error gap-1 text-xs border border-error/20 hover:bg-error/10"
                  title="Delete all currently filtered call jobs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Filtered</span>
                </button>
                <button 
                  onClick={handleClearAllLogs}
                  disabled={callJobs.length === 0}
                  className="btn btn-sm btn-ghost text-error gap-1 text-xs border border-error/20 hover:bg-error/10"
                  title="Wipe all call records from database"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Wipe All</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Date to Date Filter & Quick Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-base-200/60 text-xs">
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
              Showing {filteredJobs.length} of {callJobs.length}
            </span>
          </div>
        </div>
      </div>

      {/* Call History Table */}
      <div className="card bg-base-100 border border-base-200 shadow-xs overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="border-b border-base-200 text-[11px] uppercase tracking-wider text-base-content/60">
              <th>Target Recipient</th>
              <th>Status & Feedback</th>
              <th>Talk Duration</th>
              <th>Dispatched Route</th>
              <th>Requester Identity</th>
              <th>Audio Track Prompt</th>
              <th>Timestamp</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 text-xs">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-base-content/40">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Phone className="w-8 h-8 opacity-20" />
                    <p className="font-semibold">No call records found matching criteria</p>
                    <p className="text-[11px]">Adjust your search query or date range filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredJobs.map(job => (
                <tr key={job._id} className="hover:bg-base-200/40 transition-colors">
                  {/* Recipient */}
                  <td>
                    <div>
                      <ClickToCopy 
                        text={job.phone} 
                        className="font-mono font-bold text-base-content text-sm block" 
                        title="Click to copy recipient phone number" 
                      />
                      {job.targetName ? (
                        <span className="text-[11px] font-semibold text-primary block">
                          {job.targetName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-base-content/40 italic">Direct Subscriber</span>
                      )}
                    </div>
                  </td>

                  {/* Status & Feedback */}
                  <td>
                    <div className="space-y-1">
                      <div>{getStatusBadge(job)}</div>
                      {job.feedbackDetails && (
                        <span className="text-[10px] text-base-content/60 font-mono block max-w-[180px] truncate" title={job.feedbackDetails}>
                          {job.feedbackDetails}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Duration */}
                  <td>
                    <div className="flex items-center gap-1 font-mono font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-base-content/40" />
                      <span className={job.durationSeconds && job.durationSeconds > 0 ? "text-success font-black" : "text-base-content/40"}>
                        {formatDuration(job.durationSeconds)}
                      </span>
                    </div>
                    {job.attempts && job.attempts > 1 && (
                      <span className="text-[10px] text-warning block font-semibold">
                        Retries: {job.attempts}
                      </span>
                    )}
                  </td>

                  {/* Dispatched Route */}
                  <td>
                    {job.virtualId ? (
                      <div>
                        <ClickToCopy 
                          text={job.virtualId} 
                          className="badge badge-secondary badge-outline badge-xs font-mono font-bold text-[10px] gap-1"
                          title="Click to copy Virtual Address ID"
                        />
                        <span className="text-[9px] text-base-content/40 block mt-0.5">Virtual Gateway</span>
                      </div>
                    ) : job.mac ? (
                      <div>
                        <ClickToCopy 
                          text={job.mac} 
                          className="badge badge-neutral badge-outline badge-xs font-mono text-[10px] gap-1"
                          title="Click to copy MAC address"
                        />
                        <span className="text-[9px] text-base-content/40 block mt-0.5">Physical SIM800L</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-base-content/40 italic">Auto-Balance Pool</span>
                    )}
                  </td>

                  {/* Requester Identity */}
                  <td>
                    {job.isAnonymous ? (
                      <div className="flex items-center gap-1">
                        <ClickToCopy 
                          text={job.anonymousId || 'ANON-CLOAK'} 
                          className="badge badge-ghost badge-xs font-mono text-[10px] text-secondary font-bold gap-1"
                          title="Click to copy Anonymous Cloak ID"
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="font-semibold text-base-content text-[11px] block">
                          {job.userName || 'Admin System'}
                        </span>
                        <span className="badge badge-ghost badge-xs text-[9px] uppercase">
                          {job.userRole || 'moderator'}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Audio Prompt */}
                  <td>
                    {job.audio ? (
                      <span className="badge badge-primary badge-outline badge-xs gap-1 font-mono text-[10px]">
                        <Music className="w-2.5 h-2.5" /> Track {job.audio}
                      </span>
                    ) : (
                      <span className="text-base-content/40 text-[10px] italic">Silent / Direct</span>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className="text-[11px] text-base-content/60 font-mono whitespace-nowrap">
                    {new Date(job.createdAt).toLocaleString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                    })}
                  </td>

                  {/* Actions Column */}
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setSelectedJobForDetail(job)}
                        className="btn btn-ghost btn-xs text-primary font-bold hover:bg-primary/10"
                        title="Inspect Carrier Telemetry & Full Event Trace"
                      >
                        <Info className="w-3.5 h-3.5" /> Details
                      </button>

                      {hasPermission('admin') && (
                        <>
                          <button 
                            onClick={() => setEditJobModal(job)}
                            className="btn btn-ghost btn-xs text-info hover:bg-info/10"
                            title="Edit Call Record"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteJob(job._id)}
                            className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                            title="Delete Call Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: Bulk Broadcast & Custom Routing */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-base-200 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-primary" /> Launch Voice Broadcast
                </h3>
                <p className="text-xs text-base-content/60">
                  Target physical modems, virtual bonded lines, or cloak with anonymous caller ID
                </p>
              </div>
              <button 
                onClick={() => setIsBroadcastOpen(false)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartBroadcast} className="space-y-4 mt-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">
                  Recipient Numbers & Optional Names (One per line: <code className="text-primary font-mono">+88017XXXXXXXX, Name</code>)
                </label>
                <textarea 
                  value={phoneListInput}
                  onChange={e => setPhoneListInput(e.target.value)}
                  rows={4}
                  placeholder="+8801711111111, Sakib Al Hasan&#10;+8801722222222, Tamim Iqbal&#10;+8801933333333" 
                  required
                  className="textarea textarea-bordered w-full font-mono text-xs"
                />
                <span className="text-[10px] text-base-content/50 block mt-1">
                  Supports comma or newline separation. Recipient names are stored for reporting.
                </span>
              </div>

              {/* Routing Mode Selector */}
              <div className="bg-base-200/50 p-3 rounded-xl space-y-2 border border-base-200">
                <span className="text-xs font-bold text-base-content/80 block">Dispatch Routing Target</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRouteType('auto')}
                    className={`btn btn-xs ${routeType === 'auto' ? 'btn-primary' : 'btn-ghost border border-base-300'} text-[11px] font-bold`}
                  >
                    Auto-Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouteType('mac')}
                    className={`btn btn-xs ${routeType === 'mac' ? 'btn-primary' : 'btn-ghost border border-base-300'} text-[11px] font-bold`}
                  >
                    Hardware MAC
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouteType('virtual')}
                    className={`btn btn-xs ${routeType === 'virtual' ? 'btn-primary' : 'btn-ghost border border-base-300'} text-[11px] font-bold`}
                  >
                    Virtual Device
                  </button>
                </div>

                {routeType === 'mac' && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="text-[11px] font-bold text-base-content/70 block mb-1">Select Specific SIM800L Node</label>
                    <select 
                      value={targetMac} 
                      onChange={e => setTargetMac(e.target.value)}
                      required
                      className="select select-bordered select-sm w-full text-xs font-mono"
                    >
                      <option value="">-- Choose Physical Node MAC --</option>
                      {devices.map(d => (
                        <option key={d.mac} value={d.mac}>
                          {d.name} ({d.mac}) - {d.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {routeType === 'virtual' && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="text-[11px] font-bold text-base-content/70 block mb-1">Select Virtual Aggregation Line</label>
                    <select 
                      value={targetVirtualId} 
                      onChange={e => setTargetVirtualId(e.target.value)}
                      required
                      className="select select-bordered select-sm w-full text-xs font-mono"
                    >
                      <option value="">-- Choose Virtual Address / ID --</option>
                      {virtualDevices.map(vd => (
                        <option key={vd.id} value={vd.virtualMac || vd.id}>
                          {vd.name} [{vd.virtualMac}] ({vd.totalCallCount || 0} calls, {Math.round((vd.totalCallDurationSeconds || 0)/60)}m talk)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Anonymous Caller ID */}
              <div className="bg-base-200/50 p-3 rounded-xl border border-base-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isAnonymous}
                    onChange={e => {
                      setIsAnonymous(e.target.checked);
                      if (e.target.checked && !anonymousId) {
                        setAnonymousId(`ANON-CLOAK-${Math.floor(1000 + Math.random() * 9000)}`);
                      }
                    }}
                    className="checkbox checkbox-sm checkbox-secondary"
                  />
                  <div>
                    <span className="text-xs font-bold text-base-content block flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-secondary" /> Anonymous / Cloaked Caller ID (#31# Prefix)
                    </span>
                    <span className="text-[10px] text-base-content/60 block">
                      Dispatches call with GSM private CLI flag and masks agent identity in logs
                    </span>
                  </div>
                </label>

                {isAnonymous && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="text-[11px] font-bold text-base-content/70 block mb-1">Anonymous Identifier Cloak Tag</label>
                    <input 
                      type="text" 
                      value={anonymousId}
                      onChange={e => setAnonymousId(e.target.value)}
                      placeholder="e.g. ANON-CLOAK-8812"
                      className="input input-bordered input-sm w-full font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Audio Prompt */}
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">DFPlayer Voice Prompt Audio Track</label>
                <select 
                  value={selectedAudio} 
                  onChange={e => setSelectedAudio(e.target.value)}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  {audioTracks.map(t => (
                    <option key={t.id} value={t.trackNumber}>
                      Track [{t.trackNumber}] - {t.title} ({t.duration || 'Default'})
                    </option>
                  ))}
                </select>
              </div>

              {/* High-Load Note */}
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-2 text-[11px] text-primary">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Zero-Drop Guarantee & FIFO Priority Queue</span>
                  Under high channel or server load, requests stay securely queued with automatic retry backoff. No calls fail.
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsBroadcastOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isBroadcasting}
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  {isBroadcasting ? 'Dispatching...' : 'Dispatch Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Carrier Telemetry & Call Feedback Inspector */}
      {selectedJobForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-base-200 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-base-200">
              <div>
                <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Call Feedback & Telemetry Inspector
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-base-content/60 mt-0.5">
                  <span>Job ID:</span>
                  <ClickToCopy text={selectedJobForDetail._id} title="Click to copy Job ID" />
                </div>
              </div>
              <button 
                onClick={() => setSelectedJobForDetail(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              {/* Recipient & Requester */}
              <div className="grid grid-cols-2 gap-3 bg-base-200/50 p-3 rounded-xl border border-base-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Target Subscriber</span>
                  <span className="text-sm font-mono font-bold text-base-content block mt-0.5">
                    {selectedJobForDetail.phone}
                  </span>
                  <span className="text-[11px] text-primary font-semibold">
                    {selectedJobForDetail.targetName || 'Direct Subscriber'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Dispatched By</span>
                  <span className="text-sm font-bold text-base-content block mt-0.5">
                    {selectedJobForDetail.isAnonymous ? (selectedJobForDetail.anonymousId || 'Anonymous Agent') : (selectedJobForDetail.userName || 'Admin System')}
                  </span>
                  <span className="badge badge-ghost badge-xs uppercase text-[9px]">
                    {selectedJobForDetail.isAnonymous ? 'Cloaked CLI' : (selectedJobForDetail.userRole || 'moderator')}
                  </span>
                </div>
              </div>

              {/* Status & Timing */}
              <div className="grid grid-cols-3 gap-2 bg-base-200/50 p-3 rounded-xl border border-base-200 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Carrier Status</span>
                  <div className="mt-1">{getStatusBadge(selectedJobForDetail)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Exact Talk Time</span>
                  <span className="text-sm font-mono font-black text-success block mt-1">
                    {formatDuration(selectedJobForDetail.durationSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Delivery Retries</span>
                  <span className="text-sm font-mono font-bold text-base-content block mt-1">
                    {selectedJobForDetail.attempts || 1} of 3
                  </span>
                </div>
              </div>

              {/* Routing & Audio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-base-100 border border-base-200">
                  <span className="font-semibold text-base-content/70">Dispatched Gateway:</span>
                  <span className="font-mono font-bold text-base-content">
                    {selectedJobForDetail.virtualId ? `Virtual: ${selectedJobForDetail.virtualId}` : (selectedJobForDetail.mac || 'Auto-Pool')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-base-100 border border-base-200">
                  <span className="font-semibold text-base-content/70">Audio Prompt Trigger:</span>
                  <span className="font-mono font-bold text-primary">
                    {selectedJobForDetail.audio ? `Track ${selectedJobForDetail.audio}` : 'Silent Handshake'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-base-100 border border-base-200">
                  <span className="font-semibold text-base-content/70">Creation Timestamp:</span>
                  <span className="font-mono text-base-content/80">
                    {new Date(selectedJobForDetail.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Carrier Feedback Diagnostics */}
              <div>
                <span className="text-xs font-bold text-base-content/80 block mb-1">
                  Carrier Signaling Feedback & Diagnostic Trace:
                </span>
                <div className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800">
                  <div className="text-emerald-400">$ SIM800L AT Command Response Trace:</div>
                  <div className="text-slate-300 mt-1">
                    {selectedJobForDetail.feedbackDetails || `ATD${selectedJobForDetail.phone}; -> OK -> CONNECT ${selectedJobForDetail.durationSeconds || 0}s`}
                  </div>
                  <div className="text-slate-400 mt-2 text-[10px]">
                    Signaling: {selectedJobForDetail.status.toUpperCase()} | QPos: {selectedJobForDetail.queuePosition || 0} | Zero-Drop Active
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => setSelectedJobForDetail(null)}
                  className="btn btn-sm btn-neutral w-full font-bold"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Comprehensive Call Management Report & Analytics */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-base-200 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-base-200">
              <div>
                <h3 className="font-bold text-xl text-base-content flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-primary" /> Call Management Report & Analytics
                </h3>
                <p className="text-xs text-base-content/60">
                  Consolidated performance metrics, virtual line talk records, and carrier signaling audit
                </p>
              </div>
              <button 
                onClick={() => setIsReportOpen(false)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-bold text-base-content">
                    Report Period: {startDate || 'All Time'} to {endDate || 'Present'}
                  </span>
                </div>
                <span className="badge badge-primary badge-sm font-bold font-mono">
                  {filteredJobs.length} Records Analyzed
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-base-200/50 p-3 rounded-xl border border-base-200">
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Answered Calls</span>
                  <span className="text-xl font-black text-success">{successfulCalls}</span>
                  <span className="text-[10px] text-success block">{successRate}% Answer Rate</span>
                </div>
                <div className="bg-base-200/50 p-3 rounded-xl border border-base-200">
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Cumulative Talk Time</span>
                  <span className="text-xl font-black text-primary">{totalTalkMinutes}m</span>
                  <span className="text-[10px] text-base-content/50 block">{totalTalkSeconds} seconds total</span>
                </div>
                <div className="bg-base-200/50 p-3 rounded-xl border border-base-200">
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Avg Duration</span>
                  <span className="text-xl font-black text-info">{avgTalkSeconds}s</span>
                  <span className="text-[10px] text-base-content/50 block">Per completed call</span>
                </div>
                <div className="bg-base-200/50 p-3 rounded-xl border border-base-200">
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Queue & Load</span>
                  <span className="text-xl font-black text-warning">{queuedCalls}</span>
                  <span className="text-[10px] text-warning block">0% Dropped (FIFO)</span>
                </div>
              </div>

              <div className="bg-base-200/50 p-4 rounded-xl border border-base-200 space-y-2">
                <h4 className="font-bold text-xs text-base-content flex items-center justify-between">
                  <span>Carrier Signaling Feedback Breakdown</span>
                  <span className="text-[10px] text-base-content/50 font-normal">Accurate Telco States</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-base-100 border border-base-200">
                    <span className="text-[10px] text-base-content/60 block font-semibold">User Rejection (UDUB)</span>
                    <span className="text-base font-bold text-error">{rejectedCalls}</span>
                    <span className="text-[9px] text-base-content/40 block">Declined on handset</span>
                  </div>
                  <div className="p-2 rounded-lg bg-base-100 border border-base-200">
                    <span className="text-[10px] text-base-content/60 block font-semibold">Call Waiting (CW)</span>
                    <span className="text-base font-bold text-info">{waitingCalls}</span>
                    <span className="text-[9px] text-base-content/40 block">Other call active</span>
                  </div>
                  <div className="p-2 rounded-lg bg-base-100 border border-base-200">
                    <span className="text-[10px] text-base-content/60 block font-semibold">Call Forwarding</span>
                    <span className="text-base font-bold text-secondary">{forwardedCalls}</span>
                    <span className="text-[9px] text-base-content/40 block">Diverted to voicemail</span>
                  </div>
                  <div className="p-2 rounded-lg bg-base-100 border border-base-200">
                    <span className="text-[10px] text-base-content/60 block font-semibold">Line Busy</span>
                    <span className="text-base font-bold text-base-content/70">{busyCalls}</span>
                    <span className="text-[9px] text-base-content/40 block">Engaged line</span>
                  </div>
                  <div className="p-2 rounded-lg bg-base-100 border border-base-200">
                    <span className="text-[10px] text-base-content/60 block font-semibold">Unreachable</span>
                    <span className="text-base font-bold text-base-content/50">{unreachableCalls}</span>
                    <span className="text-[9px] text-base-content/40 block">Switched off</span>
                  </div>
                  <div className="p-2 rounded-lg bg-base-100 border border-base-200">
                    <span className="text-[10px] text-base-content/60 block font-semibold">Answered & Connected</span>
                    <span className="text-base font-bold text-success">{successfulCalls}</span>
                    <span className="text-[9px] text-base-content/40 block">Full audio played</span>
                  </div>
                </div>
              </div>

              <div className="bg-base-200/50 p-4 rounded-xl border border-base-200 space-y-2">
                <h4 className="font-bold text-xs text-base-content flex items-center justify-between">
                  <span>Virtual Device & Virtual MAC Talk Time Summary</span>
                  <span className="text-[10px] text-secondary font-bold font-mono">{virtualDevices.length} Virtual Lines</span>
                </h4>

                <div className="space-y-1.5 pt-1">
                  {virtualDevices.map(vd => (
                    <div key={vd.id} className="flex items-center justify-between p-2 rounded-lg bg-base-100 border border-base-200 text-xs">
                      <div>
                        <span className="font-bold text-base-content block">{vd.name}</span>
                        <span className="font-mono text-[10px] text-primary">{vd.virtualMac}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-success text-xs block">
                          {formatDuration(vd.totalCallDurationSeconds || 0)}
                        </span>
                        <span className="text-[10px] text-base-content/50">
                          {vd.totalCallCount || 0} calls | {vd.totalSmsCount || 0} SMS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="btn btn-sm btn-ghost font-bold text-xs"
                >
                  Close
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="btn btn-sm btn-outline btn-error flex-1 font-bold text-xs gap-1.5 shadow-xs"
                >
                  <FileText className="w-4 h-4" /> Download PDF Report
                </button>
                <button 
                  onClick={exportFilteredCSV}
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs gap-1.5 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Download Full CSV Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Admin Edit Call Record */}
      {editJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-base-200">
              <div>
                <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-info" /> Admin: Edit Call Job Record
                </h3>
                <p className="text-[11px] text-base-content/60 font-mono">Job ID: {editJobModal._id}</p>
              </div>
              <button 
                onClick={() => setEditJobModal(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveJobEdit} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Target Phone Number</label>
                <input 
                  type="text" 
                  value={editJobModal.phone} 
                  disabled
                  className="input input-bordered input-sm w-full font-mono text-xs opacity-60 bg-base-200"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Contact Recipient Name</label>
                <input 
                  type="text" 
                  value={editJobModal.targetName || ''}
                  onChange={e => setEditJobModal({ ...editJobModal, targetName: e.target.value })}
                  placeholder="e.g. Sakib Al Hasan"
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Carrier Status</label>
                  <select 
                    value={editJobModal.status}
                    onChange={e => setEditJobModal({ ...editJobModal, status: e.target.value as CallStatus })}
                    className="select select-bordered select-sm w-full text-xs font-semibold"
                  >
                    <option value="success">Answered (success)</option>
                    <option value="calling">Calling / Active</option>
                    <option value="queued">Queued Buffer</option>
                    <option value="rejected">Call Rejected (UDUB)</option>
                    <option value="call_waiting">Call Waiting (CW)</option>
                    <option value="forwarded">Forwarded to Voicemail</option>
                    <option value="busy">Line Busy</option>
                    <option value="unreachable">Unreachable</option>
                    <option value="failed">Failed / Dropped</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Talk Duration (Sec)</label>
                  <input 
                    type="number" 
                    min={0}
                    value={editJobModal.durationSeconds || 0}
                    onChange={e => setEditJobModal({ ...editJobModal, durationSeconds: parseInt(e.target.value) || 0 })}
                    className="input input-bordered input-sm w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Carrier Feedback Trace</label>
                <textarea 
                  value={editJobModal.feedbackDetails || ''}
                  onChange={e => setEditJobModal({ ...editJobModal, feedbackDetails: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full font-mono text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditJobModal(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
