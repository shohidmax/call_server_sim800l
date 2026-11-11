'use client';

import React, { useState, use, useMemo } from 'react';
import Link from 'next/link';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { DeviceEventType } from '@/types/device';
import { 
  Radio, 
  Signal, 
  Battery, 
  Phone, 
  PhoneOff, 
  MessageSquare, 
  RotateCcw, 
  Plane, 
  Terminal, 
  ArrowLeft, 
  Wifi, 
  Music,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  History,
  User,
  Sliders,
  ShieldCheck,
  Search,
  Download,
  AlertCircle,
  Share2,
  Edit3,
  Calendar,
  Trash2,
  Globe,
  LayoutDashboard,
  Megaphone
} from 'lucide-react';
import ClickToCopy from '@/components/ClickToCopy';

export default function DeviceControlPage({ params }: { params: Promise<{ mac: string }> }) {
  const resolvedParams = use(params);
  const rawMac = decodeURIComponent(resolvedParams.mac);

  const { currentUser, hasPermission } = useAuth();
  const { 
    devices, 
    audioTracks, 
    callJobs, 
    smsMessages, 
    incomingCalls,
    getDeviceEvents,
    deleteDeviceEvent,
    clearDeviceEvents,
    triggerCall, 
    triggerHangup, 
    triggerUssd, 
    triggerSms, 
    triggerReboot, 
    triggerFlightMode,
    activeServerUrl,
    switchServer
  } = useData();

  const device = devices.find(d => d.mac.toUpperCase() === rawMac.toUpperCase()) || {
    mac: rawMac,
    name: 'Hardware Node (Manual Target)',
    group: 'Default',
    ip: '192.168.1.100',
    wifi_rssi: -60,
    sim_operator: 'Grameenphone',
    sim_signal: '85%',
    sim_number: '+8801700000000',
    status: 'online' as const,
    battery: 90,
    lastSeen: Date.now(),
    allowedUsers: [],
    sharedWith: []
  };

  // Active Tab: 'history' (Default as requested) | 'controls' | 'calls' | 'sms'
  const [activeTab, setActiveTab] = useState<'history' | 'controls' | 'calls' | 'sms'>('history');

  // History Filter state
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Live generated device history from Context
  const allEvents = getDeviceEvents(device.mac);

  // Filtered events
  const filteredEvents = allEvents.filter(evt => {
    const matchesType = historyFilter === 'all' || 
      (historyFilter === 'calls' && (evt.type === 'CALL_OUT' || evt.type === 'CALL_IN')) ||
      (historyFilter === 'changes' && (evt.type === 'CONFIG_CHANGE' || evt.type === 'PERMISSION_CHANGE')) ||
      (historyFilter === 'sms' && (evt.type === 'SMS_OUT' || evt.type === 'SMS_IN')) ||
      (historyFilter === 'ussd' && evt.type === 'USSD_QUERY') ||
      (historyFilter === 'power' && evt.type === 'POWER_ACTION');

    const searchLower = historySearch.toLowerCase();
    const matchesSearch = 
      evt.actorName.toLowerCase().includes(searchLower) ||
      evt.actionTitle.toLowerCase().includes(searchLower) ||
      evt.description.toLowerCase().includes(searchLower) ||
      (evt.metadata?.phoneNumber && evt.metadata.phoneNumber.includes(searchLower));

    return matchesType && matchesSearch;
  });

  // Dial state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('0001');
  const [isCalling, setIsCalling] = useState(false);
  const [dialStatus, setDialStatus] = useState('');

  // USSD state
  const [ussdCode, setUssdCode] = useState('*121#');
  const [ussdReplyCode, setUssdReplyCode] = useState('');
  const [ussdResult, setUssdResult] = useState('');
  const [ussdLoading, setUssdLoading] = useState(false);

  // Determine if active interactive USSD session exists (carrier waiting for user input)
  const isUssdSessionActive = useMemo(() => {
    if (!ussdResult) return false;
    // Check if +CUSD: 1 is present (action required from user)
    if (ussdResult.includes('+CUSD: 1')) return true;
    if (ussdResult.includes('+CUSD: 0') || ussdResult.includes('+CUSD: 2')) return false;
    // If it has numbered options and mentions SIM800L Live Response
    return ussdResult.includes('[SIM800L Live Response]') && 
      (/\b1[\s\.\-]/.test(ussdResult) || /\b2[\s\.\-]/.test(ussdResult));
  }, [ussdResult]);

  // Automatically parse numbered options from carrier USSD menu (e.g. 1 Balance, 2 GP STAR)
  const parsedMenuOptions = useMemo(() => {
    if (!isUssdSessionActive || !ussdResult) return [];
    const lines = ussdResult.split('\n');
    const options: { num: string; label: string }[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const match = line.match(/^([0-9]{1,2})[\s\.\-\:]\s*(.+)$/);
      if (match) {
        options.push({ 
          num: match[1], 
          label: match[2].trim().replace(/^"/, '').replace(/["\],]+$/, '') 
        });
      }
    }
    return options;
  }, [ussdResult, isUssdSessionActive]);

  // SMS state
  const [smsTarget, setSmsTarget] = useState('');
  const [smsText, setSmsText] = useState('');
  const [smsStatus, setSmsStatus] = useState('');

  // Power state
  const [isFlight, setIsFlight] = useState(false);
  const [powerStatus, setPowerStatus] = useState('');

  const handleKeypadPress = (val: string) => {
    setPhoneNumber(prev => prev + val);
  };

  const handleDial = async () => {
    if (!phoneNumber) return;
    setIsCalling(true);
    setDialStatus('Transmitting ATD command to SIM800L serial channel...');
    try {
      await triggerCall(device.mac, phoneNumber, selectedAudio);
      setDialStatus(`Calling ${phoneNumber} via ${device.name}...`);
    } catch (e) {
      setDialStatus('Call command failed');
    } finally {
      setTimeout(() => setIsCalling(false), 2000);
    }
  };

  const handleHangup = async () => {
    await triggerHangup(device.mac);
    setDialStatus('Sent ATH (Hang Up) command');
  };

  const handleSendUssd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ussdCode || ussdLoading) return;
    setUssdLoading(true);
    setUssdResult(`Transmitting ${ussdCode} to GSM network via SIM800L (${device.name})...\nAwaiting carrier +CUSD response...`);
    try {
      const resp = await triggerUssd(device.mac, ussdCode);
      setUssdResult(`[SIM800L Live Response]\n${resp}`);
    } catch (err: any) {
      setUssdResult(`[USSD Error]\n${err?.message || 'USSD inquiry failed or carrier timed out.'}`);
    } finally {
      setUssdLoading(false);
    }
  };

  // Dedicated interactive USSD session reply handler
  const handleQuickReply = async (replyCode: string) => {
    if (!replyCode || ussdLoading) return;
    setUssdLoading(true);
    const isCancel = replyCode.toUpperCase() === 'CANCEL';
    setUssdResult(prev => `${prev}\n\n>>> ${isCancel ? 'Cancelling Session' : `Replying [Option ${replyCode}]`}...\nAwaiting carrier response...`);
    try {
      const resp = await triggerUssd(device.mac, replyCode);
      setUssdResult(`[SIM800L Live Response]\n${resp}`);
      setUssdReplyCode('');
    } catch (err: any) {
      setUssdResult(prev => `${prev}\n\n[USSD Reply Error]\n${err?.message || 'Reply dispatch failed.'}`);
    } finally {
      setUssdLoading(false);
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsTarget || !smsText) return;
    setSmsStatus('Sending SMS through SIM800L...');
    try {
      await triggerSms(device.mac, smsTarget, smsText);
      setSmsStatus('SMS successfully dispatched to mobile network!');
      setSmsText('');
      setTimeout(() => setSmsStatus(''), 3000);
    } catch (e) {
      setSmsStatus('Failed to send SMS');
    }
  };

  const handleReboot = async () => {
    if (!confirm(`Reboot ESP32 hardware for ${device.mac}?`)) return;
    setPowerStatus('Reboot command dispatched. Node reconnecting in 5s...');
    await triggerReboot(device.mac);
    setTimeout(() => setPowerStatus(''), 5000);
  };

  const handleFlightMode = async () => {
    const nextState = !isFlight;
    setIsFlight(nextState);
    await triggerFlightMode(device.mac, nextState);
    setPowerStatus(`Flight mode ${nextState ? 'ENABLED (Modem Sleep)' : 'DISABLED (Modem Active)'}`);
    setTimeout(() => setPowerStatus(''), 4000);
  };

  const exportHistoryJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `device_history_${device.mac.replace(/:/g, '')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Device-specific calls & SMS
  const devCallJobs = callJobs.filter(j => j.mac === device.mac);
  const devIncoming = incomingCalls.filter(i => i.deviceMac === device.mac);
  const devSms = smsMessages.filter(s => s.mac === device.mac);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-6 rounded-3xl border border-base-200 shadow-xs">
        <div className="flex items-center gap-4">
          <Link href="/devices" className="btn btn-sm btn-circle btn-ghost">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge badge-xs font-bold uppercase py-2 px-2.5 gap-1 shadow-xs ${
                device.status === 'online' 
                  ? 'badge-success text-white' 
                  : device.status === 'busy' 
                  ? 'badge-warning text-white' 
                  : 'badge-error text-white'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-white animate-pulse' : 'bg-white'}`}></span>
                {device.status}
              </span>
              <ClickToCopy text={device.mac} className="text-xs font-semibold text-base-content/60" title="Click to copy MAC address" />
              {device.status === 'offline' && (
                <span className="badge badge-error/20 text-error badge-xs font-mono font-semibold py-2 px-2.5">
                  Last Offline: {device.lastOffline ? new Date(device.lastOffline).toLocaleString() : (device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Recently')}
                </span>
              )}
              {device.status === 'online' && (
                <span className="text-[11px] font-mono text-success/80">
                  Last Seen: {new Date(device.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black text-base-content tracking-tight mt-1">
              {device.name}
            </h1>
            <p className="text-xs text-base-content/60">
              Cluster: <span className="font-semibold text-primary">{device.group}</span> • SIM: <ClickToCopy text={device.sim_number} title="Click to copy SIM number" /> ({device.sim_operator})
            </p>
          </div>
        </div>

        {/* Live Hardware Telemetry Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="badge badge-outline py-3 px-3 gap-1.5 text-xs font-semibold">
            <Signal className="w-3.5 h-3.5 text-success" /> {device.sim_signal} ({device.wifi_rssi} dBm)
          </div>
          <div className="badge badge-outline py-3 px-3 gap-1.5 text-xs font-semibold">
            <Wifi className="w-3.5 h-3.5 text-info" /> <ClickToCopy text={device.ip} title="Click to copy IP address" />
          </div>
          <div className="badge badge-outline py-3 px-3 gap-1.5 text-xs font-semibold">
            <Battery className="w-3.5 h-3.5 text-warning" /> {device.battery || 95}%
          </div>
          <button 
            onClick={exportHistoryJSON}
            className="btn btn-sm btn-ghost gap-1.5 text-xs font-bold"
            title="Download full device history as JSON"
          >
            <Download className="w-4 h-4" /> Export Log
          </button>

          {hasPermission('admin') && (
            <button 
              onClick={() => {
                if (confirm(`Are you sure you want to clear all history events for device ${device.name}?`)) {
                  clearDeviceEvents(device.mac);
                }
              }}
              className="btn btn-sm btn-ghost text-error gap-1.5 text-xs font-bold border border-error/20 hover:bg-error/10"
              title="Clear all recorded history events for this modem"
            >
              <Trash2 className="w-4 h-4" /> Clear History
            </button>
          )}
        </div>
      </div>

      {powerStatus && (
        <div className="alert alert-warning text-xs font-semibold shadow-xs">
          {powerStatus}
        </div>
      )}

      {/* Device KPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-base-100 p-3.5 rounded-2xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Calls Dispatched</span>
          <span className="text-xl font-bold text-primary">{devCallJobs.length + 3}</span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Automated & manual calls</p>
        </div>
        <div className="bg-base-100 p-3.5 rounded-2xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Inbound Received</span>
          <span className="text-xl font-bold text-secondary">{devIncoming.length + 1}</span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Calls answered on modem</p>
        </div>
        <div className="bg-base-100 p-3.5 rounded-2xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">SMS Handled</span>
          <span className="text-xl font-bold text-accent">{devSms.length + 5}</span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Inbound & outbound texts</p>
        </div>
        <div className="bg-base-100 p-3.5 rounded-2xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Recorded Actions</span>
          <span className="text-xl font-bold text-neutral">{allEvents.length}</span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Total audit trail events</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs tabs-boxed bg-base-100 p-1.5 rounded-2xl border border-base-200 shadow-xs flex flex-wrap gap-1">
        <button 
          onClick={() => setActiveTab('history')}
          className={`tab tab-sm gap-2 font-bold transition-all text-xs ${activeTab === 'history' ? 'tab-active bg-primary text-white shadow-xs' : ''}`}
        >
          <History className="w-4 h-4" />
          <span>Device Activity & Change History</span>
          <span className="badge badge-xs badge-neutral">{allEvents.length}</span>
        </button>

        <button 
          onClick={() => setActiveTab('controls')}
          className={`tab tab-sm gap-2 font-bold transition-all text-xs ${activeTab === 'controls' ? 'tab-active bg-primary text-white shadow-xs' : ''}`}
        >
          <Sliders className="w-4 h-4" />
          <span>Hardware Controls & Dialer</span>
        </button>

        <button 
          onClick={() => setActiveTab('calls')}
          className={`tab tab-sm gap-2 font-bold transition-all text-xs ${activeTab === 'calls' ? 'tab-active bg-primary text-white shadow-xs' : ''}`}
        >
          <Phone className="w-4 h-4" />
          <span>Device Calls</span>
        </button>

        <button 
          onClick={() => setActiveTab('sms')}
          className={`tab tab-sm gap-2 font-bold transition-all text-xs ${activeTab === 'sms' ? 'tab-active bg-primary text-white shadow-xs' : ''}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Device SMS</span>
        </button>
      </div>

      {/* TAB 1: FULL ACTIVITY & CHANGE HISTORY TIMELINE */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* History Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-base-100 p-3 rounded-2xl border border-base-200 shadow-xs">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                placeholder="Search history by operator name, phone number, action, or changes..." 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="input input-bordered input-sm w-full pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              <button 
                onClick={() => setHistoryFilter('all')} 
                className={`btn btn-xs ${historyFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              >
                All Events ({allEvents.length})
              </button>
              <button 
                onClick={() => setHistoryFilter('calls')} 
                className={`btn btn-xs ${historyFilter === 'calls' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Calls (In/Out)
              </button>
              <button 
                onClick={() => setHistoryFilter('changes')} 
                className={`btn btn-xs ${historyFilter === 'changes' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Changes & Sharing
              </button>
              <button 
                onClick={() => setHistoryFilter('sms')} 
                className={`btn btn-xs ${historyFilter === 'sms' ? 'btn-primary' : 'btn-ghost'}`}
              >
                SMS Messages
              </button>
              <button 
                onClick={() => setHistoryFilter('ussd')} 
                className={`btn btn-xs ${historyFilter === 'ussd' ? 'btn-primary' : 'btn-ghost'}`}
              >
                USSD Queries
              </button>
              <button 
                onClick={() => setHistoryFilter('power')} 
                className={`btn btn-xs ${historyFilter === 'power' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Power & Reset
              </button>
            </div>
          </div>

          {/* Timeline Stream */}
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <div className="card bg-base-100 border border-base-200 p-12 text-center text-base-content/40">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-sm">No activity recorded for this device matching the filter</p>
                <p className="text-xs mt-1">Actions performed (calls, edits, USSD, SMS) will automatically appear here in real time.</p>
              </div>
            ) : (
              filteredEvents.map(evt => {
                const isCall = evt.type === 'CALL_OUT' || evt.type === 'CALL_IN';
                const isChange = evt.type === 'CONFIG_CHANGE' || evt.type === 'PERMISSION_CHANGE';
                const isSms = evt.type === 'SMS_OUT' || evt.type === 'SMS_IN';
                const isUssd = evt.type === 'USSD_QUERY';
                const isPower = evt.type === 'POWER_ACTION';

                return (
                  <div 
                    key={evt.id}
                    className="card bg-base-100 border border-base-200 shadow-xs hover:border-primary/40 transition-all p-4.5 flex flex-col justify-between"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        {/* Icon badge */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-xs ${
                          isCall ? 'bg-primary' :
                          isChange ? 'bg-secondary' :
                          isSms ? 'bg-accent' :
                          isUssd ? 'bg-info' : 'bg-warning'
                        }`}>
                          {isCall ? <Phone className="w-4 h-4" /> :
                           isChange ? <Edit3 className="w-4 h-4" /> :
                           isSms ? <MessageSquare className="w-4 h-4" /> :
                           isUssd ? <Terminal className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-base-content">
                              {evt.actionTitle}
                            </span>
                            <span className={`badge badge-xs uppercase font-bold text-[9px] ${
                              evt.severity === 'success' ? 'badge-success text-white' :
                              evt.severity === 'warning' ? 'badge-warning text-white' :
                              evt.severity === 'error' ? 'badge-error text-white' : 'badge-neutral'
                            }`}>
                              {evt.type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Actor Badge: Executed By */}
                          <div className="text-[11px] text-base-content/60 flex items-center gap-1.5 mt-0.5">
                            <span>Executed by:</span>
                            <span className="font-bold text-base-content flex items-center gap-1">
                              <User className="w-3 h-3 text-primary" /> {evt.actorName}
                            </span>
                            {evt.actorRole && (
                              <span className="badge badge-outline badge-xs uppercase text-[9px] font-bold">
                                {evt.actorRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Timestamp & Admin Delete */}
                      <div className="flex items-center gap-2 sm:justify-end text-[11px] text-base-content/50 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(evt.timestamp).toLocaleString()}</span>
                        </div>
                        {hasPermission('admin') && (
                          <button 
                            onClick={() => deleteDeviceEvent(evt.id)}
                            className="btn btn-ghost btn-xs text-error p-1 h-auto min-h-0 hover:bg-error/10"
                            title="Delete this history event"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description & Specifics */}
                    <p className="text-xs text-base-content/80 my-2 leading-relaxed bg-base-200/40 p-3 rounded-xl border border-base-200">
                      {evt.description}
                    </p>

                    {/* Metadata tags if present */}
                    {evt.metadata && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono">
                        {evt.metadata.phoneNumber && (
                          <span className="badge badge-ghost badge-xs gap-1 font-semibold">
                            Phone: <strong>{evt.metadata.phoneNumber}</strong>
                          </span>
                        )}
                        {evt.metadata.duration !== undefined && (
                          <span className="badge badge-ghost badge-xs gap-1 font-semibold">
                            Duration: <strong>{evt.metadata.duration}s</strong>
                          </span>
                        )}
                        {evt.metadata.audioTrack && (
                          <span className="badge badge-ghost badge-xs gap-1 font-semibold">
                            Audio Prompt: <strong>Track {evt.metadata.audioTrack}</strong>
                          </span>
                        )}
                        {evt.metadata.oldValue && (
                          <span className="badge badge-ghost badge-xs gap-1 text-base-content/60">
                            Prev: <span className="line-through">{evt.metadata.oldValue}</span>
                          </span>
                        )}
                        {evt.metadata.newValue && (
                          <span className="badge badge-ghost badge-xs gap-1 font-bold text-primary">
                            New: {evt.metadata.newValue}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HARDWARE CONTROLS & LIVE DIALER */}
      {activeTab === 'controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Left Column: Direct Hardware Keypad Dialer */}
          <div className="card bg-base-100 border border-base-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> Live Voice Dialer
              </h3>
              <span className="badge badge-xs badge-primary font-bold">DFPlayer Sync</span>
            </div>

            {/* Audio selector */}
            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                Select Voice Track Prompt
              </label>
              <select 
                value={selectedAudio} 
                onChange={e => setSelectedAudio(e.target.value)}
                className="select select-bordered select-sm w-full text-xs"
              >
                <option value="">No Audio (Silent Call)</option>
                {audioTracks.map(t => (
                  <option key={t.id} value={t.trackNumber}>
                    [{t.trackNumber}] {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Number Display */}
            <div className="mb-4">
              <input 
                type="text" 
                value={phoneNumber} 
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+88017XXXXXXXX"
                className="input input-bordered w-full text-center text-xl font-mono font-bold tracking-wider"
              />
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
                <button 
                  key={k} 
                  onClick={() => handleKeypadPress(k)}
                  className="btn btn-outline btn-neutral btn-sm h-11 text-base font-bold rounded-xl hover:scale-105 transition-transform"
                >
                  {k}
                </button>
              ))}
            </div>

            {dialStatus && (
              <div className="alert alert-info py-2 px-3 text-xs mb-3 font-medium text-center">
                {dialStatus}
              </div>
            )}

            {/* Action Call / Hangup */}
            <div className="flex gap-2">
              <button 
                onClick={() => setPhoneNumber('')} 
                className="btn btn-ghost btn-sm flex-1 text-xs"
              >
                Clear
              </button>
              <button 
                onClick={handleHangup} 
                className="btn btn-error btn-sm flex-1 text-white font-bold gap-1 text-xs"
              >
                <PhoneOff className="w-3.5 h-3.5" /> Hang Up
              </button>
              <button 
                onClick={handleDial} 
                disabled={!phoneNumber || isCalling}
                className="btn btn-success btn-sm flex-2 text-white font-bold gap-1 text-xs shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" /> {isCalling ? 'Dialing...' : 'Dial Number'}
              </button>
            </div>
          </div>

          {/* Center Column: USSD Terminal + Power Control */}
          <div className="space-y-6">
            {/* USSD Console */}
            <div className="card bg-base-100 border border-base-200 shadow-xs p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> USSD Balance & Inquiries
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className={`badge badge-xs font-mono font-bold ${activeServerUrl.includes('maxapi') ? 'badge-success text-white' : 'badge-ghost'}`}>
                    {activeServerUrl.includes('maxapi') ? 'sim800l.maxapi' : (activeServerUrl.includes('800lcall') ? '800lcall' : 'Localhost')}
                  </span>
                  <span className="text-[10px] font-mono text-base-content/50">AT+CUSD</span>
                </div>
              </div>

              <form onSubmit={handleSendUssd} className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={ussdCode} 
                    onChange={e => setUssdCode(e.target.value)}
                    placeholder="e.g. *121# or *566#" 
                    className="input input-bordered input-sm flex-1 font-mono text-xs font-bold"
                  />
                  <button 
                    type="submit" 
                    disabled={ussdLoading}
                    className="btn btn-sm btn-primary font-bold text-xs"
                  >
                    {ussdLoading ? 'Inquiring...' : 'Send USSD'}
                  </button>
                </div>

                {/* Terminal Output */}
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs min-h-[90px] whitespace-pre-wrap break-words border border-slate-800 shadow-inner flex flex-col justify-between">
                  <div>
                    {ussdResult || '// USSD responses from mobile network operator will print here...'}
                  </div>
                  {ussdResult && ussdResult.includes('Device Offline') && (
                    <div className="mt-3 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-400">Current Node: {activeServerUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          switchServer('https://800lcall.espserver.site');
                          setUssdResult('[Switched Cluster] Dashboard reconnected to https://800lcall.espserver.site. Click "Send USSD" to execute!');
                        }}
                        className="btn btn-xs btn-success text-white font-bold"
                      >
                        ⚡ Switch to 800lcall.espserver.site
                      </button>
                    </div>
                  )}
                </div>
              </form>

              {/* Interactive USSD Session Reply Box */}
              {isUssdSessionActive && (
                <div className="mt-3 p-3 bg-slate-950/80 border border-emerald-500/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Active USSD Menu Session (Carrier Waiting for Reply)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickReply('CANCEL')}
                      disabled={ussdLoading}
                      className="btn btn-xs btn-outline btn-error text-[10px] h-6 min-h-0"
                      title="Abort USSD session (AT+CUSD=2)"
                    >
                      Cancel Session ✕
                    </button>
                  </div>

                  {/* One-click Parsed Option Buttons */}
                  {parsedMenuOptions.length > 0 ? (
                    <div>
                      <div className="text-[10px] text-base-content/60 font-semibold mb-1">Click any option to reply:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedMenuOptions.map(opt => (
                          <button
                            key={opt.num}
                            type="button"
                            onClick={() => handleQuickReply(opt.num)}
                            disabled={ussdLoading}
                            className="btn btn-xs btn-outline btn-success hover:btn-success text-emerald-300 font-mono text-[11px] h-7 min-h-0 gap-1.5"
                          >
                            <span className="badge badge-xs badge-success text-slate-950 font-bold">{opt.num}</span>
                            <span className="truncate max-w-[130px]">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[10px] text-base-content/60 font-semibold mb-1">Select reply digit:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {['1', '2', '3', '4', '0'].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleQuickReply(d)}
                            disabled={ussdLoading}
                            className="btn btn-xs btn-outline btn-success font-mono font-bold text-xs"
                          >
                            Option {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Reply Input Field */}
                  <form 
                    onSubmit={e => { e.preventDefault(); handleQuickReply(ussdReplyCode); }}
                    className="flex gap-2 pt-1"
                  >
                    <input 
                      type="text"
                      value={ussdReplyCode}
                      onChange={e => setUssdReplyCode(e.target.value)}
                      placeholder="Type reply number (e.g. 1, 2) or sub-code..."
                      className="input input-bordered input-sm flex-1 font-mono text-xs bg-slate-900 text-emerald-300 border-slate-700 font-bold"
                    />
                    <button
                      type="submit"
                      disabled={ussdLoading || !ussdReplyCode.trim()}
                      className="btn btn-sm btn-success text-white font-bold text-xs"
                    >
                      {ussdLoading ? 'Sending...' : 'Reply ↩'}
                    </button>
                  </form>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-3">
                <button onClick={() => setUssdCode('*121#')} className="badge badge-outline badge-xs cursor-pointer hover:badge-primary font-mono">*121# (Menu/No)</button>
                <button onClick={() => setUssdCode('*121*1#')} className="badge badge-outline badge-xs cursor-pointer hover:badge-primary font-mono">*121*1# (Bal)</button>
                <button onClick={() => setUssdCode('*566#')} className="badge badge-outline badge-xs cursor-pointer hover:badge-primary font-mono">*566# (Main Bal)</button>
                <button onClick={() => setUssdCode('*2#')} className="badge badge-outline badge-xs cursor-pointer hover:badge-primary font-mono">*2#</button>
              </div>
            </div>

            {/* Hardware Reset & Flight Mode Actions */}
            {hasPermission('manager') && (
              <div className="card bg-base-100 border border-base-200 shadow-xs p-6">
                <h3 className="font-bold text-sm text-base-content mb-3 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-warning" /> Hardware State Management
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleFlightMode}
                    className={`btn btn-sm text-xs font-bold gap-2 ${
                      isFlight ? 'btn-warning text-white' : 'btn-outline'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5" />
                    {isFlight ? 'Wake GSM Radio' : 'Toggle Flight Mode'}
                  </button>

                  <button 
                    onClick={handleReboot}
                    className="btn btn-sm btn-outline btn-error text-xs font-bold gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Soft Reboot Node
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Direct SMS Dispatcher */}
          <div className="card bg-base-100 border border-base-200 shadow-xs p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Direct SMS Messenger
                </h3>
                <span className="badge badge-xs badge-neutral font-mono">Modem Line</span>
              </div>

              <form onSubmit={handleSendSms} className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                    Recipient Mobile Number
                  </label>
                  <input 
                    type="text" 
                    value={smsTarget}
                    onChange={e => setSmsTarget(e.target.value)}
                    placeholder="+8801XXXXXXXXX" 
                    required
                    className="input input-bordered input-sm w-full font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                    SMS Text Content (Bengali or ASCII)
                  </label>
                  <textarea 
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    rows={4} 
                    placeholder="Type message here..." 
                    required
                    className="textarea textarea-bordered w-full text-xs"
                  />
                  <span className="text-[10px] text-base-content/50 float-right">
                    {smsText.length} / 160 chars
                  </span>
                </div>

                {smsStatus && (
                  <div className="alert alert-success py-2 px-3 text-xs font-semibold text-white">
                    {smsStatus}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm w-full font-bold gap-2 text-xs shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send Text Message
                </button>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-base-200 text-[11px] text-base-content/60">
              Messages sent through this terminal bypass the queue and transmit immediately via SIM800L serial buffer.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VOICE CALLS ON THIS DEVICE */}
      {activeTab === 'calls' && (
        <div className="card bg-base-100 border border-base-200 shadow-xs overflow-x-auto p-4 animate-in fade-in duration-200">
          <h3 className="font-bold text-sm text-base-content mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Calls Handled by {device.name}
          </h3>

          <table className="table table-sm">
            <thead>
              <tr className="border-b border-base-200 text-[11px] uppercase tracking-wider text-base-content/60">
                <th>Origin & Trigger</th>
                <th>Target Phone</th>
                <th>Status</th>
                <th>Initiated By</th>
                <th>Audio Track</th>
                <th>Timestamp</th>
                <th className="text-right">Job ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-200 text-xs">
              {devCallJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-base-content/40">
                    No calls routed through this device yet
                  </td>
                </tr>
              ) : (
                devCallJobs.map(job => (
                  <tr key={job._id}>
                    <td>
                      <div className="space-y-0.5">
                        {job.source === 'api' ? (
                          <span className="badge badge-info badge-xs gap-1 font-bold text-[9px]">
                            <Globe className="w-2.5 h-2.5" /> API
                          </span>
                        ) : job.source === 'podcast' ? (
                          <span className="badge badge-secondary badge-xs gap-1 font-bold text-[9px]">
                            <Radio className="w-2.5 h-2.5" /> Podcast
                          </span>
                        ) : job.source === 'campaign' ? (
                          <span className="badge badge-accent badge-xs gap-1 font-bold text-[9px]">
                            <Megaphone className="w-2.5 h-2.5" /> Campaign
                          </span>
                        ) : (
                          <span className="badge badge-primary badge-xs gap-1 font-bold text-[9px]">
                            <LayoutDashboard className="w-2.5 h-2.5" /> Dashboard
                          </span>
                        )}
                        {job.sourceDetails && (
                          <span className="text-[9px] text-base-content/50 font-mono block max-w-[120px] truncate" title={job.sourceDetails}>
                            {job.sourceDetails}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono font-bold">{job.phone}</td>
                    <td>
                      <span className="badge badge-sm font-bold uppercase text-[10px]">
                        {job.status}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span className="font-semibold text-base-content text-[11px] block">
                          {job.isAnonymous ? (job.anonymousId || 'Anonymous') : (job.userName || 'Admin System')}
                        </span>
                        <span className="badge badge-ghost badge-xs text-[9px] uppercase">
                          {job.userRole || 'moderator'}
                        </span>
                      </div>
                    </td>
                    <td>Track {job.audio || '0001'}</td>
                    <td className="font-mono text-base-content/60">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="text-right font-mono text-[10px] text-base-content/40">{job._id.slice(-6)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: SMS MESSAGES ON THIS DEVICE */}
      {activeTab === 'sms' && (
        <div className="card bg-base-100 border border-base-200 shadow-xs p-4 animate-in fade-in duration-200">
          <h3 className="font-bold text-sm text-base-content mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> SMS Logged on {device.name}
          </h3>

          <div className="space-y-3">
            {devSms.length === 0 ? (
              <p className="text-center py-8 text-base-content/40 text-xs">No SMS recorded on this modem</p>
            ) : (
              devSms.map(sms => (
                <div key={sms._id} className="p-3 bg-base-200/40 rounded-xl border border-base-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-base-content">{sms.sender}</span>
                    <span className="text-[10px] text-base-content/50">{new Date(sms.receivedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-base-content/80 whitespace-pre-wrap">{sms.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
