'use client';

import React, { useState, useMemo } from 'react';
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
  FileText
} from 'lucide-react';
import { exportSmsPdf } from '@/utils/pdfExport';
import ClickToCopy from '@/components/ClickToCopy';

export default function SmsPage() {
  const { hasPermission } = useAuth();
  const { smsMessages, devices, triggerSms, deleteSms, deleteSmsThread, clearAllSms } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Composer
  const [selectedMac, setSelectedMac] = useState(devices[0]?.mac || '');
  const [recipient, setRecipient] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState('');

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

  const filtered = useMemo(() => {
    return smsMessages.filter(sms => {
      const matchesDir = directionFilter === 'all' || sms.direction === directionFilter;
      const decodedMessage = decodeUCS2(sms.message);
      const matchesSearch = sms.sender.includes(searchTerm) || decodedMessage.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesDir || !matchesSearch) return false;

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
  }, [smsMessages, directionFilter, searchTerm, startDate, endDate]);

  const totalSms = smsMessages.length;
  const inboundCount = filtered.filter(s => s.direction === 'in').length;
  const outboundCount = filtered.filter(s => s.direction === 'out').length;

  // CSV Export for filtered SMS
  const exportSmsCSV = () => {
    const headers = ["ID", "Direction", "Sender/Recipient", "Device MAC", "Message", "Decoded Message", "Timestamp"];
    const rows = filtered.map(s => [
      `"${s._id}"`,
      `"${s.direction === 'in' ? 'Inbound' : 'Outbound'}"`,
      `"${s.sender}"`,
      `"${s.mac || ''}"`,
      `"${(s.message || '').replace(/"/g, '""')}"`,
      `"${decodeUCS2(s.message || '').replace(/"/g, '""')}"`,
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
        title: 'Cellular SMS Message History & Audit Report',
        subtitle: 'SIM800L Transceiver Record with Bengali UCS2 Unicode Decoding',
        dateRange: { from: startDate, to: endDate },
        generatedBy: 'Administrator',
        summaryMetrics: [
          { label: 'Total Messages', value: totalSms, color: '#0f172a' },
          { label: 'Inbound Received', value: inboundCount, color: '#0284c7' },
          { label: 'Outbound Dispatched', value: outboundCount, color: '#8b5cf6' },
          { label: 'Filtered Count', value: filtered.length, color: '#16a34a' }
        ]
      },
      filtered,
      decodeUCS2
    );
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !messageText) return;

    setSending(true);
    setSendFeedback('Dispatching SMS over SIM800L serial channel...');
    try {
      await triggerSms(selectedMac, recipient, messageText);
      setSendFeedback('SMS successfully dispatched!');
      setMessageText('');
      setTimeout(() => setSendFeedback(''), 3000);
    } catch (e) {
      setSendFeedback('Failed to dispatch SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" /> Cellular SMS Management Center
        </h1>
        <p className="text-xs text-base-content/60 mt-0.5">
          Live feed of received SMS texts (with UCS2 Bengali decoding) and outbound modem transmitter
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Total Messages</span>
          <span className="text-2xl font-black text-base-content">{totalSms}</span>
          <span className="text-[10px] text-base-content/50 block mt-1">Processed texts</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Inbound Received</span>
          <span className="text-2xl font-black text-primary">{inboundCount}</span>
          <span className="text-[10px] text-primary block mt-1">Carrier balance & subscriber texts</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Outbound Dispatched</span>
          <span className="text-2xl font-black text-secondary">{outboundCount}</span>
          <span className="text-[10px] text-secondary block mt-1">Delivered via SIM800L modems</span>
        </div>
      </div>

      {/* Main Grid: Composer + SMS Messages Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="card bg-base-100 border border-base-200 shadow-xs p-6 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Send Outbound SMS
            </h3>
            <span className="badge badge-xs badge-neutral font-mono">Modem Line</span>
          </div>

          <form onSubmit={handleSendSms} className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                Transmitting Gateway Modem
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

            <div>
              <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                Recipient Mobile Number
              </label>
              <input 
                type="text" 
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="+8801XXXXXXXXX" 
                required
                className="input input-bordered input-sm w-full font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                Text Message (Bengali & English)
              </label>
              <textarea 
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={4} 
                placeholder="Write message to send..." 
                required
                className="textarea textarea-bordered w-full text-xs"
              />
              <span className="text-[10px] text-base-content/50 float-right">
                {messageText.length} / 160 characters
              </span>
            </div>

            {sendFeedback && (
              <div className="alert alert-info py-2 px-3 text-xs font-semibold">
                {sendFeedback}
              </div>
            )}

            <button 
              type="submit" 
              disabled={sending}
              className="btn btn-primary btn-sm w-full font-bold gap-2 text-xs shadow-xs"
            >
              <Send className="w-3.5 h-3.5" /> {sending ? 'Transmitting...' : 'Dispatch SMS'}
            </button>
          </form>
        </div>

        {/* SMS Feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Date Filter Bar */}
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

              <div className="flex flex-wrap items-center gap-1.5">
                <button 
                  onClick={() => setDirectionFilter('all')}
                  className={`btn btn-xs ${directionFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  All ({smsMessages.length})
                </button>
                <button 
                  onClick={() => setDirectionFilter('in')}
                  className={`btn btn-xs ${directionFilter === 'in' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  Inbound ({inboundCount})
                </button>
                <button 
                  onClick={() => setDirectionFilter('out')}
                  className={`btn btn-xs ${directionFilter === 'out' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  Outbound ({outboundCount})
                </button>

                <button 
                  onClick={exportSmsCSV}
                  disabled={filtered.length === 0}
                  className="btn btn-xs btn-ghost gap-1 border border-base-200"
                  title="Export filtered SMS messages as CSV"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button 
                  onClick={exportSmsPDF}
                  disabled={filtered.length === 0}
                  className="btn btn-xs btn-ghost text-error gap-1 border border-error/20 hover:bg-error/10"
                  title="Export filtered SMS messages as printable vector PDF"
                >
                  <FileText className="w-3 h-3" />
                  <span className="hidden sm:inline">Export PDF</span>
                </button>

                {hasPermission('admin') && (
                  <button
                    onClick={() => {
                      if (confirm('CRITICAL ACTION: Are you sure you want to permanently delete ALL SMS messages?')) {
                        clearAllSms();
                      }
                    }}
                    disabled={smsMessages.length === 0}
                    className="btn btn-xs btn-ghost text-error border border-error/20"
                    title="Wipe entire SMS inbox"
                  >
                    <Trash2 className="w-3 h-3" /> Clear All SMS
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
              filtered.slice(0, 30).map(sms => {
                const isIn = sms.direction === 'in';
                const decodedMsg = decodeUCS2(sms.message);

                return (
                  <div 
                    key={sms._id}
                    className="card bg-base-100 border border-base-200 shadow-xs hover:border-primary/40 transition-all p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isIn ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                        }`}>
                          {isIn ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <ClickToCopy 
                            text={decodeUCS2(sms.sender)} 
                            className="font-mono font-bold text-xs text-base-content" 
                            title="Click to copy phone number" 
                          />
                          <span className={`badge badge-xs ml-2 uppercase text-[9px] font-bold ${
                            isIn ? 'badge-primary' : 'badge-secondary'
                          }`}>
                            {isIn ? 'Incoming' : 'Outgoing'}
                          </span>
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
    </div>
  );
}

