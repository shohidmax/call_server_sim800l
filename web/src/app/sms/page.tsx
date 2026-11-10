'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { SMSMessage } from '@/types/sms';
import { 
  MessageSquare, 
  Send, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  CheckCheck, 
  Clock, 
  Radio, 
  Sparkles,
  Trash2,
  Calendar,
  X,
  Download,
  FileText,
  Globe,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  PhoneCall,
  Smartphone
} from 'lucide-react';
import { exportSmsPdf } from '@/utils/pdfExport';
import ClickToCopy from '@/components/ClickToCopy';

export default function SmsPage() {
  const { hasPermission } = useAuth();
  const { 
    smsMessages, 
    devices, 
    triggerSms, 
    deleteSms, 
    deleteSmsThread, 
    clearAllSms,
    bulkSmsConfig,
    fetchBulkSmsBalance,
    sendBulkSmsBd,
    updateBulkSmsConfig
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [gatewayFilter, setGatewayFilter] = useState<'all' | 'sim800l' | 'bulksmsbd'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Gateway mode in composer: 'bulksmsbd' (Bulk Cloud) or 'sim800l' (Hardware Modem)
  const [gatewayMode, setGatewayMode] = useState<'bulksmsbd' | 'sim800l'>('bulksmsbd');

  // Composer fields
  const [selectedMac, setSelectedMac] = useState(devices[0]?.mac || '');
  const [singleRecipient, setSingleRecipient] = useState('');
  const [bulkNumbersText, setBulkNumbersText] = useState('');
  const [senderId, setSenderId] = useState(bulkSmsConfig.senderId || '8809617618888');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success?: boolean;
    code?: number;
    text?: string;
  } | null>(null);

  // Settings Modal State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editApiKey, setEditApiKey] = useState(bulkSmsConfig.apiKey || 'MS6MfGTEVrHaCJUQ5vAU');
  const [editSenderId, setEditSenderId] = useState(bulkSmsConfig.senderId || '8809617618888');
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (bulkSmsConfig.senderId) {
      setSenderId(bulkSmsConfig.senderId);
      setEditSenderId(bulkSmsConfig.senderId);
    }
    if (bulkSmsConfig.apiKey) {
      setEditApiKey(bulkSmsConfig.apiKey);
    }
  }, [bulkSmsConfig.senderId, bulkSmsConfig.apiKey]);

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

  // Helper for decoding SIM800L Bengali UCS2 hex strings
  const decodeUCS2 = (str: string) => {
    if (!str || typeof str !== 'string' || str.length % 4 !== 0 || !/^[0-9A-Fa-f]+$/.test(str)) {
      return str;
    }
    let result = '';
    for (let i = 0; i < str.length; i += 4) {
      result += String.fromCharCode(parseInt(str.substr(i, 4), 16));
    }
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result)) return str;
    return result;
  };

  // Parse bulk numbers and clean them
  const parsedBulkNumbers = useMemo(() => {
    if (!bulkNumbersText.trim()) return [];
    const items = bulkNumbersText.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    const cleaned = items.map(n => {
      let num = n.replace(/[^\d+]/g, '');
      if (num.startsWith('+')) num = num.substring(1);
      if (num.startsWith('0')) num = '88' + num;
      else if (num.length === 10 && num.startsWith('1')) num = '880' + num;
      return num;
    }).filter(n => n.length >= 11);
    // remove duplicates while preserving order
    return Array.from(new Set(cleaned));
  }, [bulkNumbersText]);

  const filtered = useMemo(() => {
    return smsMessages.filter(sms => {
      const matchesDir = directionFilter === 'all' || sms.direction === directionFilter;
      const matchesGateway = gatewayFilter === 'all' || 
        (gatewayFilter === 'bulksmsbd' && sms.gateway === 'bulksmsbd') ||
        (gatewayFilter === 'sim800l' && sms.gateway !== 'bulksmsbd');
      
      const decodedMessage = decodeUCS2(sms.message);
      const matchesSearch = sms.sender.includes(searchTerm) || decodedMessage.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesDir || !matchesGateway || !matchesSearch) return false;

      // Date Range Matching
      const dateVal = sms.timestamp || sms.receivedAt;
      if (dateVal) {
        const smsTime = new Date(dateVal).getTime();
        if (startDate) {
          const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
          if (smsTime < startTimestamp) return false;
        }
        if (endDate) {
          const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
          if (smsTime > endTimestamp) return false;
        }
      }

      return true;
    });
  }, [smsMessages, directionFilter, gatewayFilter, searchTerm, startDate, endDate]);

  const totalSms = smsMessages.length;
  const inboundCount = smsMessages.filter(s => s.direction === 'in').length;
  const outboundCount = smsMessages.filter(s => s.direction === 'out').length;
  const bulkSmsCount = smsMessages.filter(s => s.gateway === 'bulksmsbd').length;

  // CSV Export for filtered SMS
  const exportSmsCSV = () => {
    const headers = ["ID", "Gateway", "Direction", "Sender/Recipient", "Sender ID/MAC", "Message", "Decoded Message", "Status", "Timestamp"];
    const rows = filtered.map(s => [
      `"${s._id}"`,
      `"${s.gateway === 'bulksmsbd' ? 'BulkSMSBD Cloud' : 'SIM800L Modem'}"`,
      `"${s.direction === 'in' ? 'Inbound' : 'Outbound'}"`,
      `"${s.sender}"`,
      `"${s.senderId || s.mac || ''}"`,
      `"${(s.message || '').replace(/"/g, '""')}"`,
      `"${decodeUCS2(s.message || '').replace(/"/g, '""')}"`,
      `"${s.status || 'delivered'}"`,
      `"${new Date(s.timestamp || s.receivedAt || Date.now()).toISOString()}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sms_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // PDF Export for filtered SMS
  const exportSmsPDF = () => {
    exportSmsPdf(
      {
        title: 'Cellular & Bulk SMS Audit Report',
        subtitle: 'Dual Channel SIM800L & BulkSMSBD.COM Gateway Records',
        dateRange: { from: startDate, to: endDate },
        generatedBy: 'Administrator',
        summaryMetrics: [
          { label: 'Total Messages', value: totalSms, color: '#0f172a' },
          { label: 'Inbound Received', value: inboundCount, color: '#0284c7' },
          { label: 'Outbound Dispatched', value: outboundCount, color: '#8b5cf6' },
          { label: 'BulkSMSBD Cloud', value: bulkSmsCount, color: '#059669' }
        ]
      },
      filtered,
      decodeUCS2
    );
  };

  // Dispatch Handlers
  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendResult(null);

    if (gatewayMode === 'bulksmsbd') {
      if (parsedBulkNumbers.length === 0) {
        setSendResult({ success: false, text: 'Please enter at least one valid recipient mobile number (e.g. 017XXXXXXXX)' });
        return;
      }
      if (!messageText.trim()) {
        setSendResult({ success: false, text: 'SMS body cannot be blank' });
        return;
      }

      setSending(true);
      try {
        const res = await sendBulkSmsBd(parsedBulkNumbers, messageText, senderId);
        if (res.success) {
          setSendResult({
            success: true,
            code: res.response_code,
            text: `Successfully submitted ${res.recipient_count || parsedBulkNumbers.length} message(s) to BulkSMSBD gateway! (ID: ${res.message_id || 'N/A'})`
          });
          setMessageText('');
          setBulkNumbersText('');
        } else {
          setSendResult({
            success: false,
            code: res.response_code,
            text: `BulkSMSBD Error [${res.response_code || 'Unknown'}]: ${res.meaning || res.error_message || 'Submission failed'}`
          });
        }
      } catch (err: any) {
        setSendResult({ success: false, text: err.message || 'Failed to dispatch Bulk SMS' });
      } finally {
        setSending(false);
      }
    } else {
      // SIM800L Modem Mode
      if (!singleRecipient.trim() || !messageText.trim()) {
        setSendResult({ success: false, text: 'Recipient and message cannot be empty' });
        return;
      }
      setSending(true);
      try {
        await triggerSms(selectedMac, singleRecipient, messageText);
        setSendResult({
          success: true,
          text: `SMS dispatched via SIM800L modem (${selectedMac})!`
        });
        setMessageText('');
        setSingleRecipient('');
      } catch (e: any) {
        setSendResult({ success: false, text: e.message || 'Failed to dispatch SMS over serial modem' });
      } finally {
        setSending(false);
      }
    }
  };

  // Handle Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingBalance(true);
    setTestResult(null);
    try {
      const ok = await updateBulkSmsConfig(editApiKey, editSenderId);
      if (ok) {
        setTestResult({ success: true, message: 'Settings saved and gateway connected successfully!' });
        setTimeout(() => setIsConfigOpen(false), 1200);
      } else {
        setTestResult({ success: false, message: 'Failed to update gateway settings on server.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Update failed' });
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // Test Balance in Modal
  const handleTestBalance = async () => {
    setIsCheckingBalance(true);
    setTestResult(null);
    try {
      const res = await fetchBulkSmsBalance(editApiKey);
      if (res.success) {
        setTestResult({ success: true, message: `Connected! Account Credit Balance: ৳ ${res.balance || '0.00'}` });
      } else {
        setTestResult({ 
          success: false, 
          message: `Gateway Error [${res.response_code || 'Error'}]: ${res.meaning || res.error || 'Could not verify balance'}` 
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setIsCheckingBalance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Cellular & Bulk SMS Command Center
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Unified SMS transmission with dual-gateway dispatch: SIM800L Serial Modems + BulkSMSBD.COM Cloud API
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="btn btn-outline btn-sm gap-2 text-xs"
          >
            <Settings className="w-4 h-4 text-primary" /> Gateway Settings
          </button>
        </div>
      </div>

      {/* KPI Stats (4 Cards including BulkSMSBD Gateway) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Total Messages</span>
          <span className="text-2xl font-black text-base-content">{totalSms}</span>
          <span className="text-[10px] text-base-content/50 block mt-1">Audit log records</span>
        </div>

        <div className="bg-base-100 p-4 rounded-xl border border-base-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Inbound Received</span>
          <span className="text-2xl font-black text-primary">{inboundCount}</span>
          <span className="text-[10px] text-primary block mt-1">Carrier balance & subscriber replies</span>
        </div>

        <div className="bg-base-100 p-4 rounded-xl border border-base-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Outbound Dispatched</span>
          <span className="text-2xl font-black text-secondary">{outboundCount}</span>
          <span className="text-[10px] text-secondary block mt-1">SIM800L + Cloud Dispatches</span>
        </div>

        {/* BulkSMSBD Cloud Gateway Status & Credit Card */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-base-100 to-base-100 p-4 rounded-xl border border-emerald-500/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> BulkSMSBD.COM
            </span>
            <button 
              onClick={() => fetchBulkSmsBalance()}
              title="Refresh Balance"
              className="btn btn-ghost btn-xs btn-circle text-emerald-600 dark:text-emerald-400"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-base-content">
              {bulkSmsConfig.balance !== null ? `৳ ${bulkSmsConfig.balance}` : '৳ 0.00'}
            </span>
            <span className={`badge badge-xs font-mono font-bold ${
              bulkSmsConfig.balance !== null ? 'badge-success' : 'badge-warning'
            }`}>
              {bulkSmsConfig.statusCode === 202 ? 'Active' : bulkSmsConfig.statusMessage || 'API Ready'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-base-content/60 font-mono">
            <span>Sender: {bulkSmsConfig.senderId || 'Default'}</span>
            <span className="truncate max-w-[120px]" title={bulkSmsConfig.apiKey}>
              Key: {bulkSmsConfig.apiKey ? bulkSmsConfig.apiKey.substring(0, 5) + '...' : 'Unset'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Composer + SMS Messages Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Card */}
        <div className="card bg-base-100 border border-base-200 shadow-xs p-6 h-fit space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Outbound SMS Dispatcher
            </h3>
            <span className={`badge badge-xs font-mono font-bold ${
              gatewayMode === 'bulksmsbd' ? 'badge-success' : 'badge-neutral'
            }`}>
              {gatewayMode === 'bulksmsbd' ? 'Bulk SMS Cloud' : 'Hardware Line'}
            </span>
          </div>

          {/* Gateway Selector Tabs */}
          <div className="grid grid-cols-2 p-1 bg-base-200/60 rounded-xl gap-1 text-xs">
            <button
              type="button"
              onClick={() => setGatewayMode('bulksmsbd')}
              className={`py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                gatewayMode === 'bulksmsbd' 
                  ? 'bg-base-100 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                  : 'text-base-content/60 hover:text-base-content'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> BulkSMSBD Cloud
            </button>
            <button
              type="button"
              onClick={() => setGatewayMode('sim800l')}
              className={`py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                gatewayMode === 'sim800l' 
                  ? 'bg-base-100 text-primary shadow-xs' 
                  : 'text-base-content/60 hover:text-base-content'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> SIM800L Modem
            </button>
          </div>

          <form onSubmit={handleSendSms} className="space-y-3.5">
            {/* Conditional Form Fields based on Gateway Mode */}
            {gatewayMode === 'bulksmsbd' ? (
              <>
                {/* Sender ID Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-base-content/60">
                      Approved Sender ID
                    </label>
                    <span className="text-[10px] text-base-content/40 font-mono">
                      (Numeric or Brand)
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={senderId}
                    onChange={e => setSenderId(e.target.value)}
                    placeholder="8809617618888 or SenderName" 
                    required
                    className="input input-bordered input-sm w-full font-mono text-xs"
                  />
                </div>

                {/* Bulk Recipient Numbers */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-base-content/60">
                      Recipients (Single or Bulk)
                    </label>
                    <span className={`badge badge-xs font-mono font-bold ${
                      parsedBulkNumbers.length > 0 ? 'badge-primary' : 'badge-ghost'
                    }`}>
                      {parsedBulkNumbers.length} number{parsedBulkNumbers.length === 1 ? '' : 's'} detected
                    </span>
                  </div>
                  <textarea 
                    value={bulkNumbersText}
                    onChange={e => setBulkNumbersText(e.target.value)}
                    rows={3} 
                    placeholder="Enter phone numbers separated by commas or new lines:&#10;017XXXXXXXX&#10;018XXXXXXXX, 019XXXXXXXX" 
                    required
                    className="textarea textarea-bordered w-full font-mono text-xs"
                  />
                  <div className="flex justify-between items-center text-[10px] text-base-content/50 mt-0.5">
                    <span>Supports copy-paste from Excel / CSV</span>
                    <button
                      type="button"
                      onClick={() => setBulkNumbersText('01731626274, 01912345678, 01898765432')}
                      className="link link-hover text-primary"
                    >
                      Fill sample
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hardware SIM800L Modem Line */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                    Transmitting SIM800L Modem
                  </label>
                  <select 
                    value={selectedMac}
                    onChange={e => setSelectedMac(e.target.value)}
                    className="select select-bordered select-sm w-full text-xs font-mono"
                  >
                    {devices.map(d => (
                      <option key={d.mac} value={d.mac}>
                        {d.name} ({d.mac})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Single Recipient */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                    Recipient Mobile Number
                  </label>
                  <input 
                    type="text" 
                    value={singleRecipient}
                    onChange={e => setSingleRecipient(e.target.value)}
                    placeholder="017XXXXXXXX or +8801XXXXXXXXX" 
                    required
                    className="input input-bordered input-sm w-full font-mono text-xs"
                  />
                </div>
              </>
            )}

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold text-base-content/60">
                  SMS Body (Bengali or English)
                </label>
                <span className="text-[10px] text-base-content/50">
                  {messageText.length} chars (
                  {Math.ceil(messageText.length / (/[\u0980-\u09FF]/.test(messageText) ? 70 : 160)) || 1} SMS part
                  )
                </span>
              </div>
              <textarea 
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={4} 
                placeholder="Type your SMS message here in English or বাংলা..." 
                required
                className="textarea textarea-bordered w-full text-xs leading-relaxed"
              />
            </div>

            {/* Feedback / Error Box */}
            {sendResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                sendResult.success 
                  ? 'bg-success/10 text-success border border-success/30' 
                  : 'bg-error/10 text-error border border-error/30'
              }`}>
                {sendResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 font-semibold leading-relaxed">
                  {sendResult.text}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={sending}
              className={`btn btn-sm w-full font-bold gap-2 text-xs shadow-xs ${
                gatewayMode === 'bulksmsbd' 
                  ? 'btn-success text-white' 
                  : 'btn-primary'
              }`}
            >
              <Send className="w-3.5 h-3.5" /> 
              {sending 
                ? 'Submitting...' 
                : gatewayMode === 'bulksmsbd' 
                  ? `Blast via BulkSMSBD (${parsedBulkNumbers.length || 0} Recipients)` 
                  : 'Dispatch via SIM800L Modem'
              }
            </button>
          </form>
        </div>

        {/* SMS Feed (Audit Log) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search, Gateway, Direction, and Date Filter Bar */}
          <div className="bg-base-100 p-4 rounded-2xl border border-base-200 shadow-xs space-y-3">
            {/* Row 1: Search, Direction Filters & Export */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  placeholder="Search SMS by number or content..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="input input-bordered input-sm w-full pl-9 text-xs"
                />
              </div>

              {/* Gateway Filter */}
              <div className="flex items-center gap-1 bg-base-200/50 p-1 rounded-xl">
                <button 
                  onClick={() => setGatewayFilter('all')}
                  className={`btn btn-xs ${gatewayFilter === 'all' ? 'btn-neutral' : 'btn-ghost'}`}
                >
                  All Channels
                </button>
                <button 
                  onClick={() => setGatewayFilter('bulksmsbd')}
                  className={`btn btn-xs ${gatewayFilter === 'bulksmsbd' ? 'btn-success text-white' : 'btn-ghost text-emerald-600'}`}
                >
                  BulkSMSBD
                </button>
                <button 
                  onClick={() => setGatewayFilter('sim800l')}
                  className={`btn btn-xs ${gatewayFilter === 'sim800l' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  SIM800L
                </button>
              </div>

              {/* Direction Filter */}
              <div className="flex items-center gap-1 bg-base-200/50 p-1 rounded-xl">
                <button 
                  onClick={() => setDirectionFilter('all')}
                  className={`btn btn-xs ${directionFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setDirectionFilter('in')}
                  className={`btn btn-xs ${directionFilter === 'in' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  In
                </button>
                <button 
                  onClick={() => setDirectionFilter('out')}
                  className={`btn btn-xs ${directionFilter === 'out' ? 'btn-secondary' : 'btn-ghost'}`}
                >
                  Out
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={exportSmsCSV}
                  className="btn btn-ghost btn-sm text-xs gap-1.5"
                  title="Export Filtered CSV"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button 
                  onClick={exportSmsPDF}
                  className="btn btn-ghost btn-sm text-xs gap-1.5 text-primary"
                  title="Export Filtered PDF Report"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>

            {/* Row 2: Date Filters & Quick Presets */}
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
                    <X className="w-3 h-3" /> Clear
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
                  7 Days
                </button>
                <button 
                  onClick={() => setQuickRange('30days')} 
                  className="btn btn-ghost btn-xs"
                >
                  30 Days
                </button>
                <button 
                  onClick={() => setQuickRange('all')} 
                  className={`btn btn-xs ${!startDate && !endDate ? 'btn-neutral' : 'btn-ghost'}`}
                >
                  All Time
                </button>

                <span className="badge badge-outline badge-sm ml-2 font-mono text-[10px]">
                  Showing {filtered.length} of {smsMessages.length}
                </span>
              </div>
            </div>
          </div>

          {/* SMS List */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="card bg-base-100 border border-base-200 p-8 text-center text-base-content/40">
                No SMS records match the filter
              </div>
            ) : (
              filtered.slice(0, 40).map(sms => {
                const isIn = sms.direction === 'in';
                const isBulk = sms.gateway === 'bulksmsbd';
                const decodedMsg = decodeUCS2(sms.message);

                return (
                  <div 
                    key={sms._id}
                    className="card bg-base-100 border border-base-200 shadow-xs hover:border-primary/40 transition-all p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isIn 
                            ? 'bg-primary/10 text-primary' 
                            : isBulk 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-secondary/10 text-secondary'
                        }`}>
                          {isIn ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : isBulk ? (
                            <Globe className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div>
                          <ClickToCopy 
                            text={decodeUCS2(sms.sender)} 
                            className="font-mono font-bold text-xs text-base-content" 
                            title="Click to copy phone number" 
                          />
                          <span className={`badge badge-xs ml-2 uppercase text-[9px] font-bold ${
                            isIn ? 'badge-primary' : isBulk ? 'badge-success text-white' : 'badge-secondary'
                          }`}>
                            {isIn ? 'Incoming' : isBulk ? 'BulkSMS Cloud' : 'SIM800L Modem'}
                          </span>
                          {sms.senderId && (
                            <span className="badge badge-xs badge-ghost ml-1 font-mono text-[9px]">
                              Sender: {sms.senderId}
                            </span>
                          )}
                          {sms.mac && (
                            <span className="badge badge-xs badge-ghost ml-1 font-mono text-[9px]">
                              {sms.mac}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-base-content/50">
                          {new Date(sms.receivedAt || sms.timestamp || '').toLocaleString()}
                        </span>
                        {hasPermission('admin') && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this SMS record?')) {
                                deleteSms(sms._id);
                              }
                            }}
                            className="btn btn-ghost btn-xs text-error p-1 h-auto min-h-0 hover:bg-error/10"
                            title="Delete SMS record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-base-content/80 whitespace-pre-wrap leading-relaxed pl-8 border-l-2 border-base-200 mt-2">
                      {decodedMsg}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Gateway Settings Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="card bg-base-100 border border-base-300 w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsConfigOpen(false)}
              className="btn btn-ghost btn-xs btn-circle absolute top-4 right-4"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-base-content">BulkSMSBD.COM Credentials</h3>
                <p className="text-[11px] text-base-content/60">Configure your HTTP API Key & Approved Sender ID</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                  API Key
                </label>
                <input 
                  type="text" 
                  value={editApiKey}
                  onChange={e => setEditApiKey(e.target.value)}
                  placeholder="e.g. MS6MfGTEVrHaCJUQ5vAU" 
                  required
                  className="input input-bordered input-sm w-full font-mono text-xs"
                />
                <span className="text-[10px] text-base-content/50 block mt-1">
                  Available in BulkSMSBD.COM Dashboard &gt; Developers &gt; Your Api Key
                </span>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                  Default Sender ID
                </label>
                <input 
                  type="text" 
                  value={editSenderId}
                  onChange={e => setEditSenderId(e.target.value)}
                  placeholder="e.g. 8809617618888 or Brand Name" 
                  required
                  className="input input-bordered input-sm w-full font-mono text-xs"
                />
                <span className="text-[10px] text-base-content/50 block mt-1">
                  Must be registered and approved in BulkSMSBD.COM Sender ID menu
                </span>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2 ${
                  testResult.success 
                    ? 'bg-success/10 text-success border border-success/30' 
                    : 'bg-error/10 text-error border border-error/30'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestBalance}
                  disabled={isCheckingBalance}
                  className="btn btn-outline btn-sm flex-1 text-xs gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingBalance ? 'animate-spin' : ''}`} /> 
                  Test Balance
                </button>
                <button
                  type="submit"
                  disabled={isCheckingBalance}
                  className="btn btn-primary btn-sm flex-1 text-xs font-bold"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
