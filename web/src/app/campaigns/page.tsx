'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { Campaign, CampaignType, CampaignStatus } from '@/types/campaign';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Download,
  PhoneCall,
  MessageSquare,
  Sparkles,
  Server,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  ArrowRight,
  Filter,
  Eye,
  RefreshCw,
  Calendar,
  Cpu,
  Layers,
  Globe,
  X
} from 'lucide-react';
import ClickToCopy from '@/components/ClickToCopy';

export default function CampaignsPage() {
  const { hasPermission } = useAuth();
  const {
    campaigns,
    devices,
    virtualDevices,
    audioTracks,
    createCampaign,
    updateCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    deleteCampaign
  } = useData();

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected Campaign for Inspection Modal
  const [inspectCampaign, setInspectCampaign] = useState<Campaign | null>(null);
  const [editCampaignModal, setEditCampaignModal] = useState<Campaign | null>(null);

  // Create Campaign Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [campName, setCampName] = useState('');
  const [campType, setCampType] = useState<CampaignType>('voice');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('0001');
  const [smsText, setSmsText] = useState('');
  const [fallbackSmsText, setFallbackSmsText] = useState('');
  const [rawNumbers, setRawNumbers] = useState('');
  const [throttleDelay, setThrottleDelay] = useState<number>(5);
  const [retryLimit, setRetryLimit] = useState<number>(1);

  // Schedule & Timing
  const [launchMode, setLaunchMode] = useState<'now' | 'scheduled' | 'draft'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');

  // Helper to format ISO local datetime-local value
  const getDefaultScheduledTime = () => {
    const d = new Date(Date.now() + 3600000 * 2); // 2 hours from now
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Initialize devices on open
  const openCreateModal = () => {
    setCampName('');
    setCampType('voice');
    // Default to first physical device + first virtual device if available
    const initialDevs = [
      ...(devices[0] ? [devices[0].mac] : []),
      ...(virtualDevices[0] ? [virtualDevices[0].virtualMac] : [])
    ];
    setSelectedDevices(initialDevs);
    setSelectedAudioTrack(audioTracks[0]?.trackNumber || '0001');
    setSmsText('');
    setFallbackSmsText('Voice call was missed. Please contact us for urgent advisory.');
    setRawNumbers('');
    setThrottleDelay(5);
    setRetryLimit(1);
    setLaunchMode('now');
    setScheduledDateTime(getDefaultScheduledTime());
    setStep(1);
    setIsCreateOpen(true);
  };

  const handleDeviceToggle = (mac: string) => {
    setSelectedDevices(prev => 
      prev.includes(mac) ? prev.filter(m => m !== mac) : [...prev, mac]
    );
  };

  // Helper for SMS Part Calculation
  const isBengaliOrUnicode = (text: string) => /[^\u0000-\u007F]/.test(text);
  const charLimitPerSms = isBengaliOrUnicode(smsText) ? 70 : 160;
  const smsPartCount = Math.max(1, Math.ceil(smsText.length / charLimitPerSms));

  // Quick sample contacts filler
  const loadSampleNumbers = () => {
    const samples = [
      '01731626274, Sarwar Jahan',
      '01944556677, Amina Begum',
      '01812345678, Rafiqul Islam',
      '01552345678, Kamal Hossain',
      '01678901234, Nusrat Jahan'
    ].join('\n');
    setRawNumbers(samples);
  };

  // Submit New Campaign
  const handleCreateSubmit = (timingMode: 'now' | 'scheduled' | 'draft' = launchMode) => {
    if (!campName.trim()) {
      alert('Please enter a campaign name');
      return;
    }

    const lines = rawNumbers
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      alert('Please add at least one recipient phone number');
      return;
    }

    if (selectedDevices.length === 0) {
      alert('Please select at least one physical or virtual device to handle dispatches.');
      return;
    }

    if (timingMode === 'scheduled' && !scheduledDateTime) {
      alert('Please specify a valid schedule date and time.');
      return;
    }

    const recipientList = lines.map(line => {
      const parts = line.split(',');
      const phone = parts[0]?.trim();
      const name = parts[1]?.trim() || undefined;
      return { phone, name };
    });

    const chosenAudio = audioTracks.find(a => a.trackNumber === selectedAudioTrack);

    const calculatedStatus: CampaignStatus = 
      timingMode === 'now' ? 'running' :
      timingMode === 'scheduled' ? 'scheduled' : 'draft';

    createCampaign({
      name: campName,
      type: campType,
      status: calculatedStatus,
      assignedDevices: selectedDevices,
      audioTrack: campType !== 'sms' ? selectedAudioTrack : undefined,
      audioName: campType !== 'sms' ? (chosenAudio?.title || `Track ${selectedAudioTrack}`) : undefined,
      smsMessage: campType !== 'voice' ? smsText : undefined,
      fallbackSmsMessage: campType === 'hybrid' ? fallbackSmsText : undefined,
      retryLimit,
      throttleDelaySec: throttleDelay,
      scheduledAt: timingMode === 'scheduled' ? new Date(scheduledDateTime).toISOString() : undefined,
      recipientList
    });

    setIsCreateOpen(false);
  };

  // CSV Export for a Campaign
  const exportCampaignCSV = (camp: Campaign) => {
    const headers = ['ID', 'Phone', 'Name', 'Status', 'Device MAC', 'Attempts', 'Duration(s)', 'Timestamp'];
    const rows = camp.recipients.map(r => [
      r.id,
      r.phone,
      r.name || '',
      r.status,
      r.deviceMac || '',
      r.attemptCount,
      r.duration || 0,
      r.timestamp || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Campaign_${camp.name.replace(/\s+/g, '_')}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered List
  const filteredCampaigns = campaigns.filter(c => {
    const matchesType = filterType === 'all' || c.type === filterType;
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  // Calculate Overall Stats
  const totalCampaigns = campaigns.length;
  const runningCount = campaigns.filter(c => c.status === 'running').length;
  const totalDispatched = campaigns.reduce((acc, c) => acc + c.completedCount, 0);
  const totalSuccess = campaigns.reduce((acc, c) => acc + c.successCount, 0);
  const overallSuccessRate = totalDispatched > 0 ? Math.round((totalSuccess / totalDispatched) * 100) : 0;

  const handleSaveEditCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCampaignModal) return;

    updateCampaign(editCampaignModal.id, {
      name: editCampaignModal.name,
      throttleDelaySec: editCampaignModal.throttleDelaySec,
      retryLimit: editCampaignModal.retryLimit,
      audioTrack: editCampaignModal.audioTrack,
      smsMessage: editCampaignModal.smsMessage,
      fallbackSmsMessage: editCampaignModal.fallbackSmsMessage
    });

    setEditCampaignModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Voice Call & SMS Campaigns
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Automated voice & SMS broadcast engine with multi-SIM load balancing, anti-spam throttling, and smart fallback
          </p>
        </div>

        {hasPermission('moderator') && (
          <button 
            onClick={openCreateModal}
            className="btn btn-primary btn-sm font-bold gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-base-content/60 text-xs font-semibold">
            <span>Total Campaigns</span>
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-base-content mt-2">{totalCampaigns}</div>
          <div className="text-[10px] text-base-content/50 mt-1 flex items-center gap-1">
            <span className="badge badge-primary badge-xs">{runningCount} Running</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-base-content/60 text-xs font-semibold">
            <span>Total Dispatched</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-black text-base-content mt-2">{totalDispatched}</div>
          <div className="text-[10px] text-base-content/50 mt-1">Recipients reached</div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-base-content/60 text-xs font-semibold">
            <span>Success Rate</span>
            <Sparkles className="w-4 h-4 text-secondary" />
          </div>
          <div className="text-2xl font-black text-secondary mt-2">{overallSuccessRate}%</div>
          <div className="text-[10px] text-base-content/50 mt-1">Answered / Delivered</div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-base-content/60 text-xs font-semibold">
            <span>Active SIM Nodes</span>
            <Server className="w-4 h-4 text-info" />
          </div>
          <div className="text-2xl font-black text-base-content mt-2">
            {devices.filter(d => d.status === 'online').length} / {devices.length}
          </div>
          <div className="text-[10px] text-base-content/50 mt-1">Ready for load distribution</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card bg-base-100 border border-base-200 shadow-xs p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Search campaigns..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input input-bordered input-xs w-full md:w-64"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Type Filter */}
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="select select-bordered select-xs"
            >
              <option value="all">All Types</option>
              <option value="voice">Voice Call Only</option>
              <option value="sms">SMS Only</option>
              <option value="hybrid">Smart Hybrid</option>
            </select>

            {/* Status Filter */}
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="select select-bordered select-xs"
            >
              <option value="all">All Statuses</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaign Cards List */}
      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <div className="card bg-base-100 border border-base-200 p-8 sm:p-12 text-center">
            <Megaphone className="w-12 h-12 text-base-content/20 mx-auto mb-3" />
            <h3 className="font-bold text-base-content text-base">No campaigns found</h3>
            <p className="text-xs text-base-content/60 mt-1">
              Click <strong>Create Campaign</strong> above to launch a new voice or SMS broadcast.
            </p>
          </div>
        ) : (
          filteredCampaigns.map(camp => {
            const percent = camp.totalRecipients > 0 
              ? Math.round((camp.completedCount / camp.totalRecipients) * 100) 
              : 0;

            return (
              <div 
                key={camp.id} 
                className="card bg-base-100 border border-base-200 shadow-xs hover:border-primary/40 transition-all p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-base-content">
                        {camp.name}
                      </span>
                      <ClickToCopy text={camp.id} className="badge badge-outline badge-xs text-[9px] text-base-content/50" title="Click to copy Campaign ID" />

                      {/* Type Badge */}
                      {camp.type === 'voice' && (
                        <span className="badge badge-primary badge-sm font-bold gap-1 text-xs">
                          <PhoneCall className="w-3 h-3" /> Voice Broadcast
                        </span>
                      )}
                      {camp.type === 'sms' && (
                        <span className="badge badge-secondary badge-sm font-bold gap-1 text-xs">
                          <MessageSquare className="w-3 h-3" /> Bulk SMS
                        </span>
                      )}
                      {camp.type === 'hybrid' && (
                        <span className="badge badge-accent badge-sm font-bold gap-1 text-xs text-white">
                          <Sparkles className="w-3 h-3" /> Hybrid (Call + SMS)
                        </span>
                      )}

                      {/* Status Badge */}
                      <span className={`badge badge-sm font-bold uppercase text-[10px] ${
                        camp.status === 'running' ? 'badge-success text-white animate-pulse' :
                        camp.status === 'scheduled' ? 'badge-info text-white' :
                        camp.status === 'completed' ? 'badge-neutral' :
                        camp.status === 'paused' ? 'badge-warning text-white' : 'badge-ghost'
                      }`}>
                        {camp.status === 'scheduled' ? 'Scheduled' : camp.status}
                      </span>

                      {/* Virtual Device Indicator */}
                      {camp.assignedDevices.some(d => d.startsWith('VIR:') || virtualDevices.some(v => v.virtualMac === d)) && (
                        <span className="badge badge-secondary badge-sm font-bold gap-1 text-[10px]">
                          <Cpu className="w-3 h-3" /> Virtual Gateway
                        </span>
                      )}
                    </div>

                    {/* Metadata details */}
                    <div className="flex items-center gap-4 text-xs text-base-content/60 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Users className="w-3.5 h-3.5" /> {camp.totalRecipients} Contacts
                      </span>
                      {camp.status === 'scheduled' && camp.scheduledAt && (
                        <span className="badge badge-info badge-outline badge-xs gap-1 font-mono font-bold">
                          <Calendar className="w-3 h-3" /> Scheduled for: {new Date(camp.scheduledAt).toLocaleString()}
                        </span>
                      )}
                      {camp.audioName && (
                        <span className="badge badge-outline badge-xs">
                          Audio: {camp.audioName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3" /> {new Date(camp.createdAt).toLocaleDateString()}
                      </span>
                      <span className="badge badge-ghost badge-xs">
                        Throttle: {camp.throttleDelaySec}s delay
                      </span>
                    </div>

                    {/* SMS Preview snippet if SMS/Hybrid */}
                    {camp.smsMessage && (
                      <p className="text-xs bg-base-200/50 p-2 rounded-lg font-sans text-base-content/80 line-clamp-1 border border-base-200">
                        💬 <strong>SMS:</strong> {camp.smsMessage}
                      </p>
                    )}
                  </div>

                  {/* Progress & Controls */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
                    {/* Progress Bar & Stats */}
                    <div className="w-48 space-y-1">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span className="text-base-content/70">{camp.completedCount} / {camp.totalRecipients}</span>
                        <span className="text-primary">{percent}%</span>
                      </div>
                      <progress 
                        className="progress progress-primary w-full h-2" 
                        value={percent} 
                        max="100"
                      />
                      <div className="flex justify-between text-[10px] text-base-content/50">
                        <span className="text-success font-semibold">✓ {camp.successCount} Ok</span>
                        {camp.failedCount > 0 && (
                          <span className="text-error font-semibold">✕ {camp.failedCount} Failed</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      {camp.status === 'running' ? (
                        <button 
                          onClick={() => pauseCampaign(camp.id)}
                          className="btn btn-warning btn-square btn-sm text-white" 
                          title="Pause Campaign"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : camp.status === 'paused' ? (
                        <button 
                          onClick={() => resumeCampaign(camp.id)}
                          className="btn btn-success btn-square btn-sm text-white" 
                          title="Resume Campaign"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : camp.status === 'scheduled' ? (
                        <button 
                          onClick={() => startCampaign(camp.id)}
                          className="btn btn-info btn-square btn-sm text-white" 
                          title="Trigger Scheduled Campaign Immediately"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : camp.status === 'draft' ? (
                        <button 
                          onClick={() => startCampaign(camp.id)}
                          className="btn btn-primary btn-square btn-sm text-white" 
                          title="Start Campaign"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : null}

                      {/* View & Inspect Recipients */}
                      <button 
                        onClick={() => setInspectCampaign(camp)}
                        className="btn btn-neutral btn-sm btn-square" 
                        title="View Live Queue & Recipients"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Export CSV */}
                      <button 
                        onClick={() => exportCampaignCSV(camp)}
                        className="btn btn-outline btn-sm btn-square" 
                        title="Export CSV Report"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Edit & Delete */}
                      {hasPermission('manager') && (
                        <>
                          <button 
                            onClick={() => setEditCampaignModal(camp)}
                            className="btn btn-ghost btn-sm btn-square text-info hover:bg-info/10" 
                            title="Edit Campaign Settings"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${camp.name}"?`)) {
                                deleteCampaign(camp.id);
                              }
                            }}
                            className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10" 
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Campaign Details / Live Queue Inspection Modal */}
      {inspectCampaign && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-base-200">
              <div>
                <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-primary" /> {inspectCampaign.name}
                </h3>
                <p className="text-xs text-base-content/60 font-mono mt-0.5">
                  ID: {inspectCampaign.id} • Status: <span className="uppercase font-bold text-primary">{inspectCampaign.status}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportCampaignCSV(inspectCampaign)}
                  className="btn btn-outline btn-xs font-bold gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> CSV Report
                </button>
                <button 
                  onClick={() => setInspectCampaign(null)}
                  className="btn btn-sm btn-circle btn-ghost"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-4 gap-3 my-4">
              <div className="bg-base-200/50 p-3 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-base-content/60">Total Numbers</div>
                <div className="text-lg font-black text-base-content">{inspectCampaign.totalRecipients}</div>
              </div>
              <div className="bg-base-200/50 p-3 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-base-content/60">Completed</div>
                <div className="text-lg font-black text-primary">{inspectCampaign.completedCount}</div>
              </div>
              <div className="bg-base-200/50 p-3 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-base-content/60">Success</div>
                <div className="text-lg font-black text-success">{inspectCampaign.successCount}</div>
              </div>
              <div className="bg-base-200/50 p-3 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-base-content/60">Failed / Busy</div>
                <div className="text-lg font-black text-error">{inspectCampaign.failedCount}</div>
              </div>
            </div>

            {/* Recipient Status Table */}
            <div className="overflow-x-auto max-h-80 border border-base-200 rounded-xl">
              <table className="table table-xs table-pin-rows">
                <thead>
                  <tr className="bg-base-200 text-base-content/70">
                    <th>#</th>
                    <th>Phone</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Device</th>
                    <th>Duration</th>
                    <th>Dispatched At</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectCampaign.recipients.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-base-200/40">
                      <td className="font-mono text-base-content/40">{idx + 1}</td>
                      <td>
                        <ClickToCopy text={r.phone} className="font-mono font-bold" title="Click to copy recipient phone number" />
                      </td>
                      <td>{r.name || '—'}</td>
                      <td>
                        <span className={`badge badge-xs font-bold uppercase ${
                          r.status === 'answered' || r.status === 'sent' ? 'badge-success text-white' :
                          r.status === 'dialing' ? 'badge-primary text-white animate-pulse' :
                          r.status === 'fallback_sms_sent' ? 'badge-accent text-white' :
                          r.status === 'busy' || r.status === 'failed' ? 'badge-error text-white' : 'badge-ghost'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {r.deviceMac ? (
                          <ClickToCopy text={r.deviceMac} className="text-[11px] text-base-content/60" title="Click to copy MAC address" />
                        ) : (
                          <span className="font-mono text-[11px] text-base-content/40">Pending</span>
                        )}
                      </td>
                      <td className="font-mono">{r.duration ? `${r.duration}s` : '—'}</td>
                      <td className="text-[11px] text-base-content/60">
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : 'In Queue'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-action">
              <button 
                onClick={() => setInspectCampaign(null)} 
                className="btn btn-sm btn-neutral"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Step Create Campaign Modal */}
      {isCreateOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Steps Indicator */}
            <div className="flex items-center justify-between pb-4 border-b border-base-200 mb-4">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-base-content flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-primary" /> Create Voice & SMS Campaign
                </h3>
                <p className="text-xs text-base-content/60">Step {step} of 3</p>
              </div>
              <ul className="steps steps-horizontal text-xs">
                <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Setup</li>
                <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Content</li>
                <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Audience</li>
              </ul>
            </div>

            {/* STEP 1: Basic Config */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-base-content/70 block mb-1">
                    Campaign Name *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Emergency Weather Advisory or Monthly Bill Reminder"
                    value={campName}
                    onChange={e => setCampName(e.target.value)}
                    className="input input-bordered input-sm w-full font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-base-content/70 block mb-1">
                    Campaign Type
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button 
                      type="button"
                      onClick={() => setCampType('voice')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        campType === 'voice' 
                          ? 'border-primary bg-primary/10 text-primary font-bold' 
                          : 'border-base-200 hover:bg-base-200/50'
                      }`}
                    >
                      <PhoneCall className="w-5 h-5 mb-1.5" />
                      <div className="text-xs">Voice Call Only</div>
                      <div className="text-[10px] text-base-content/60 font-normal">DFPlayer MP3 prompt broadcast</div>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setCampType('sms')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        campType === 'sms' 
                          ? 'border-secondary bg-secondary/10 text-secondary font-bold' 
                          : 'border-base-200 hover:bg-base-200/50'
                      }`}
                    >
                      <MessageSquare className="w-5 h-5 mb-1.5" />
                      <div className="text-xs">SMS Only</div>
                      <div className="text-[10px] text-base-content/60 font-normal">Bulk SMS (GSM-7 & UCS2)</div>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setCampType('hybrid')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        campType === 'hybrid' 
                          ? 'border-accent bg-accent/10 text-accent font-bold' 
                          : 'border-base-200 hover:bg-base-200/50'
                      }`}
                    >
                      <Sparkles className="w-5 h-5 mb-1.5" />
                      <div className="text-xs">Smart Hybrid</div>
                      <div className="text-[10px] text-base-content/60 font-normal">Auto SMS on missed call</div>
                    </button>
                  </div>
                </div>

                {/* Assigned Devices & Virtual Gateways */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase text-base-content/70">
                      Select Target Fleet & Virtual Gateways (Load Balancing)
                    </label>
                    <span className="text-[10px] text-primary font-bold">
                      {selectedDevices.length} Selected
                    </span>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto border border-base-200 p-2.5 rounded-xl bg-base-200/20">
                    {/* Physical Hardware Devices */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-1 flex items-center gap-1">
                        <Server className="w-3 h-3 text-primary" /> Physical SIM800L Hardware Fleet
                      </div>
                      <div className="space-y-1">
                        {devices.map(d => (
                          <label key={d.mac} className="flex items-center gap-2 text-xs p-1.5 hover:bg-base-200/60 rounded-lg cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={selectedDevices.includes(d.mac)} 
                              onChange={() => handleDeviceToggle(d.mac)}
                              className="checkbox checkbox-primary checkbox-xs"
                            />
                            <span className="font-mono font-bold text-base-content">{d.name}</span>
                            <span className="text-[10px] text-base-content/60 font-mono">({d.mac})</span>
                            <span className={`badge badge-xs ml-auto ${d.status === 'online' ? 'badge-success text-white' : 'badge-ghost'}`}>
                              {d.sim_operator}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Virtual Devices & Cluster Gateways */}
                    {virtualDevices.length > 0 && (
                      <div className="pt-2 border-t border-base-200/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1 flex items-center gap-1">
                          <Cpu className="w-3 h-3" /> Virtual GSM Gateways & Cluster Pools
                        </div>
                        <div className="space-y-1">
                          {virtualDevices.map(v => (
                            <label key={v.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-secondary/10 rounded-lg cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={selectedDevices.includes(v.virtualMac)} 
                                onChange={() => handleDeviceToggle(v.virtualMac)}
                                className="checkbox checkbox-secondary checkbox-xs"
                              />
                              <span className="font-mono font-bold text-secondary">{v.name}</span>
                              <span className="text-[10px] text-base-content/60 font-mono">({v.virtualMac})</span>
                              <span className="badge badge-secondary badge-outline badge-xs ml-auto uppercase text-[9px] font-bold">
                                {v.type} ({v.boundPhysicalMacs.length} Nodes)
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cloud Bulk SMS Gateway (BulkSMSBD) */}
                    {campType !== 'voice' && (
                      <div className="pt-2 border-t border-base-200/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Cloud Bulk SMS Gateways
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center gap-2 text-xs p-1.5 hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={selectedDevices.includes('GATEWAY_BULKSMSBD')} 
                              onChange={() => handleDeviceToggle('GATEWAY_BULKSMSBD')}
                              className="checkbox checkbox-success checkbox-xs"
                            />
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">BulkSMSBD.COM Cloud API</span>
                            <span className="text-[10px] text-base-content/60 font-mono">(High Volume Bulk Blast)</span>
                            <span className="badge badge-success text-white badge-xs ml-auto uppercase text-[9px] font-bold">
                              Cloud
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-action">
                  <button onClick={() => setIsCreateOpen(false)} className="btn btn-sm btn-ghost">Cancel</button>
                  <button 
                    onClick={() => {
                      if (!campName.trim()) { alert('Please enter a campaign name'); return; }
                      setStep(2);
                    }} 
                    className="btn btn-sm btn-primary font-bold gap-1"
                  >
                    Next: Content <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Content (Audio & SMS) */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Voice audio selection */}
                {campType !== 'sms' && (
                  <div>
                    <label className="text-xs font-bold uppercase text-base-content/70 block mb-1">
                      Select DFPlayer Mini Audio Track *
                    </label>
                    <select 
                      value={selectedAudioTrack} 
                      onChange={e => setSelectedAudioTrack(e.target.value)}
                      className="select select-bordered select-sm w-full"
                    >
                      {audioTracks.map(a => (
                        <option key={a.id} value={a.trackNumber}>
                          [Track {a.trackNumber}] {a.title} ({a.duration} - {a.fileSize})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* SMS Text Message */}
                {campType !== 'voice' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase text-base-content/70">
                        SMS Message Text *
                      </label>
                      <span className="text-[11px] font-mono text-base-content/60">
                        {smsText.length} Chars • {smsPartCount} SMS ({isBengaliOrUnicode(smsText) ? 'UCS2 Unicode' : 'GSM-7 Standard'})
                      </span>
                    </div>
                    <textarea 
                      rows={3}
                      placeholder="Enter SMS message content (English and Unicode supported)..."
                      value={smsText}
                      onChange={e => setSmsText(e.target.value)}
                      className="textarea textarea-bordered w-full text-xs"
                    />
                  </div>
                )}

                {/* Fallback SMS if Hybrid */}
                {campType === 'hybrid' && (
                  <div>
                    <label className="text-xs font-bold uppercase text-secondary block mb-1">
                      Smart Fallback SMS (Sent if voice call is unanswered or busy)
                    </label>
                    <textarea 
                      rows={2}
                      placeholder="Fallback message sent when call is missed..."
                      value={fallbackSmsText}
                      onChange={e => setFallbackSmsText(e.target.value)}
                      className="textarea textarea-bordered w-full text-xs"
                    />
                  </div>
                )}

                {/* Throttling & Anti-Spam */}
                <div className="bg-base-200/40 p-3 rounded-xl border border-base-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-base-content">
                    <span className="flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-primary" /> Anti-Spam Throttling (Dispatch Delay)
                    </span>
                    <span className="font-mono text-primary">{throttleDelay}s pause</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="20" 
                    value={throttleDelay}
                    onChange={e => setThrottleDelay(Number(e.target.value))}
                    className="range range-xs range-primary w-full"
                  />
                  <p className="text-[10px] text-base-content/60">
                    * Inserting a pause between dispatches helps protect SIM cards from carrier spam filters.
                  </p>
                </div>

                <div className="modal-action">
                  <button onClick={() => setStep(1)} className="btn btn-sm btn-ghost">Back</button>
                  <button 
                    onClick={() => {
                      if (campType !== 'voice' && !smsText.trim()) { alert('Please enter SMS message text'); return; }
                      setStep(3);
                    }} 
                    className="btn btn-sm btn-primary font-bold gap-1"
                  >
                    Next: Audience <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Audience Contacts & Review */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase text-base-content/70">
                      Target Phone Numbers List *
                    </label>
                    <button 
                      type="button"
                      onClick={loadSampleNumbers}
                      className="btn btn-ghost btn-xs text-primary font-bold"
                    >
                      + Load 5 Demo Numbers
                    </button>
                  </div>
                  <textarea 
                    rows={6}
                    placeholder="Enter one recipient per line with optional name:&#10;01731626274, Sarwar&#10;01944556677, Amina&#10;01812345678"
                    value={rawNumbers}
                    onChange={e => setRawNumbers(e.target.value)}
                    className="textarea textarea-bordered w-full font-mono text-xs"
                  />
                  <p className="text-[10px] text-base-content/50 mt-1">
                    Format: <code>017XXXXXXXX, Name</code> (comma or newline separated)
                  </p>
                </div>

                {/* Auto-retry policy */}
                <div className="flex items-center justify-between text-xs bg-base-200/50 p-3 rounded-xl border border-base-200">
                  <span className="font-bold text-base-content">
                    Busy / No-Answer Auto Retry Policy:
                  </span>
                  <select 
                    value={retryLimit}
                    onChange={e => setRetryLimit(Number(e.target.value))}
                    className="select select-bordered select-xs"
                  >
                    <option value={0}>No Retry (0x)</option>
                    <option value={1}>1 Retry (1x)</option>
                    <option value={2}>2 Retries (2x)</option>
                    <option value={3}>3 Retries (3x)</option>
                  </select>
                </div>

                {/* Launch Timing & Scheduling */}
                <div className="bg-base-200/40 p-3 sm:p-4 rounded-xl border border-base-200 space-y-3">
                  <label className="text-xs font-bold uppercase text-base-content/70 block">
                    Campaign Execution & Launch Schedule
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setLaunchMode('now')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        launchMode === 'now' 
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs' 
                          : 'border-base-200 hover:bg-base-200/50'
                      }`}
                    >
                      <Play className="w-4 h-4 mb-1" />
                      <div>Run Immediately</div>
                      <div className="text-[10px] text-base-content/60 font-normal">Start dispatching now</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLaunchMode('scheduled')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        launchMode === 'scheduled' 
                          ? 'border-info bg-info/10 text-info font-bold shadow-xs' 
                          : 'border-base-200 hover:bg-base-200/50'
                      }`}
                    >
                      <Calendar className="w-4 h-4 mb-1" />
                      <div>Schedule Later</div>
                      <div className="text-[10px] text-base-content/60 font-normal">Auto-launch at set time</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLaunchMode('draft')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        launchMode === 'draft' 
                          ? 'border-neutral bg-base-300 font-bold shadow-xs' 
                          : 'border-base-200 hover:bg-base-200/50'
                      }`}
                    >
                      <Clock className="w-4 h-4 mb-1" />
                      <div>Save as Draft</div>
                      <div className="text-[10px] text-base-content/60 font-normal">Keep idle in queue</div>
                    </button>
                  </div>

                  {launchMode === 'scheduled' && (
                    <div className="pt-2 border-t border-base-200 space-y-1.5 animate-fadeIn">
                      <label className="text-[11px] font-bold text-base-content flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-info" /> Select Target Launch Date & Time:
                      </label>
                      <input 
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={e => setScheduledDateTime(e.target.value)}
                        className="input input-bordered input-sm w-full font-mono text-xs"
                      />
                      {scheduledDateTime && (
                        <p className="text-[10px] text-info font-semibold">
                          ✓ Campaign will automatically start on {new Date(scheduledDateTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-action">
                  <button onClick={() => setStep(2)} className="btn btn-sm btn-ghost">Back</button>
                  <button 
                    onClick={() => handleCreateSubmit(launchMode)}
                    className="btn btn-sm btn-primary font-bold gap-1 shadow-sm"
                  >
                    {launchMode === 'now' && <><Play className="w-3.5 h-3.5" /> Launch Now</>}
                    {launchMode === 'scheduled' && <><Calendar className="w-3.5 h-3.5" /> Schedule Campaign</>}
                    {launchMode === 'draft' && <><Clock className="w-3.5 h-3.5" /> Save as Draft</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Admin Edit Campaign */}
      {editCampaignModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg p-6">
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <div>
                <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" /> Admin: Edit Campaign Settings
                </h3>
                <p className="text-[11px] text-base-content/60">{editCampaignModal.id}</p>
              </div>
              <button 
                onClick={() => setEditCampaignModal(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCampaign} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Campaign Name</label>
                <input 
                  type="text" 
                  value={editCampaignModal.name}
                  onChange={e => setEditCampaignModal({ ...editCampaignModal, name: e.target.value })}
                  required
                  className="input input-bordered input-sm w-full text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Throttle Delay (Sec)</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={60}
                    value={editCampaignModal.throttleDelaySec}
                    onChange={e => setEditCampaignModal({ ...editCampaignModal, throttleDelaySec: parseInt(e.target.value) || 5 })}
                    className="input input-bordered input-sm w-full text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Busy Retry Limit</label>
                  <select 
                    value={editCampaignModal.retryLimit}
                    onChange={e => setEditCampaignModal({ ...editCampaignModal, retryLimit: parseInt(e.target.value) || 1 })}
                    className="select select-bordered select-sm w-full text-xs"
                  >
                    <option value={1}>1 Retry</option>
                    <option value={2}>2 Retries</option>
                    <option value={3}>3 Retries</option>
                  </select>
                </div>
              </div>

              {editCampaignModal.type !== 'sms' && (
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">DFPlayer Audio Track</label>
                  <select 
                    value={editCampaignModal.audioTrack || '0001'}
                    onChange={e => setEditCampaignModal({ ...editCampaignModal, audioTrack: e.target.value })}
                    className="select select-bordered select-sm w-full text-xs"
                  >
                    {audioTracks.map(t => (
                      <option key={t.id} value={t.trackNumber}>
                        Track [{t.trackNumber}] - {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editCampaignModal.type !== 'voice' && (
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">SMS Message</label>
                  <textarea 
                    value={editCampaignModal.smsMessage || ''}
                    onChange={e => setEditCampaignModal({ ...editCampaignModal, smsMessage: e.target.value })}
                    rows={2}
                    className="textarea textarea-bordered w-full text-xs"
                  />
                </div>
              )}

              {editCampaignModal.type === 'hybrid' && (
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Missed Call Fallback SMS</label>
                  <textarea 
                    value={editCampaignModal.fallbackSmsMessage || ''}
                    onChange={e => setEditCampaignModal({ ...editCampaignModal, fallbackSmsMessage: e.target.value })}
                    rows={2}
                    className="textarea textarea-bordered w-full text-xs"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setEditCampaignModal(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Campaign Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
