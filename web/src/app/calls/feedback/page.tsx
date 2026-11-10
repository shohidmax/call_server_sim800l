'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { CallFeedback } from '@/types/call';
import { 
  ShieldAlert, 
  Plus, 
  Star, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  Search, 
  AlertTriangle,
  Sliders,
  Trash2
} from 'lucide-react';

export default function CallFeedbackPage() {
  const { hasPermission, currentUser } = useAuth();
  const { complaints, submitComplaint, updateComplaintStatus, deleteComplaint, callJobs } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Submit Modal
  const [isOpen, setIsOpen] = useState(false);
  const [callId, setCallId] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [category, setCategory] = useState<CallFeedback['category']>('audio-crackling');
  const [comment, setComment] = useState('');

  const filtered = complaints.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch = c.phoneNumber.includes(searchTerm) || c.comment.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !comment) return;

    submitComplaint({
      callId: callId || 'N/A',
      phoneNumber: phone,
      rating,
      category,
      comment,
      submittedBy: currentUser?.name || 'Operator',
      status: 'open'
    });

    setIsOpen(false);
    setPhone('');
    setComment('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-warning" /> Call Quality Feedback & Complaint Center
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Log, track, and investigate audio anomalies, dropped calls, or hardware DFPlayer sync issues
          </p>
        </div>

        <button 
          onClick={() => setIsOpen(true)}
          className="btn btn-sm btn-warning text-white gap-2 font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" /> File Incident Ticket
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Total Tickets</span>
          <span className="text-2xl font-black text-base-content">{complaints.length}</span>
          <span className="text-[10px] text-base-content/50 block mt-1">Logged feedback items</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Open Issues</span>
          <span className="text-2xl font-black text-warning">
            {complaints.filter(c => c.status === 'open').length}
          </span>
          <span className="text-[10px] text-warning block mt-1">Awaiting review</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Investigating</span>
          <span className="text-2xl font-black text-info">
            {complaints.filter(c => c.status === 'investigating').length}
          </span>
          <span className="text-[10px] text-info block mt-1">Hardware diagnostics in progress</span>
        </div>
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Resolved</span>
          <span className="text-2xl font-black text-success">
            {complaints.filter(c => c.status === 'resolved').length}
          </span>
          <span className="text-[10px] text-success block mt-1">Resolved incidents</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3 bg-base-100 p-3 rounded-2xl border border-base-200 shadow-xs">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Search tickets by phone number or keywords..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input input-bordered input-sm w-full pl-9 text-xs"
          />
        </div>

        <div className="flex gap-2">
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="select select-bordered select-sm text-xs font-semibold"
          >
            <option value="all">All Ticket Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Complaints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(cmp => (
          <div key={cmp.id} className="card bg-base-100 border border-base-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-mono font-bold text-base text-base-content">
                    {cmp.phoneNumber}
                  </h3>
                  <span className="badge badge-outline badge-xs capitalize font-bold text-[10px] mt-0.5">
                    {cmp.category.replace('-', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3.5 h-3.5 ${i < cmp.rating ? 'text-amber-400 fill-amber-400' : 'text-base-300'}`} 
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-base-content/80 my-3 leading-relaxed bg-base-200/40 p-3 rounded-xl">
                &ldquo;{cmp.comment}&rdquo;
              </p>

              <div className="text-[11px] text-base-content/50 flex items-center justify-between">
                <span>By: <span className="font-bold text-base-content">{cmp.submittedBy}</span></span>
                <span>{new Date(cmp.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-base-200 flex items-center justify-between">
              <span className="text-[10px] font-mono text-base-content/40">Job ID: {cmp.callId.slice(-6)}</span>
              
              <div className="flex items-center gap-1.5">
                <select 
                  value={cmp.status}
                  onChange={e => updateComplaintStatus(cmp.id, e.target.value as any)}
                  className={`select select-bordered select-xs font-bold uppercase text-[9px] ${
                    cmp.status === 'open' ? 'text-warning' : cmp.status === 'investigating' ? 'text-info' : 'text-success'
                  }`}
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>

                {hasPermission('admin') && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this complaint ticket?')) {
                        deleteComplaint(cmp.id);
                      }
                    }}
                    className="btn btn-ghost btn-xs text-error p-1 h-auto min-h-0 hover:bg-error/10"
                    title="Delete Ticket"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Submit Complaint */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Report Call Issue / Feedback</h3>
            <p className="text-xs text-base-content/60 mb-4">Submit incident report to the hardware engineering team</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Target Phone Number</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+88017XXXXXXXX" 
                  required 
                  className="input input-bordered input-sm w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Issue Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value as any)}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  <option value="audio-crackling">Audio Distortion / Crackling</option>
                  <option value="call-dropped">Premature Call Drop</option>
                  <option value="no-audio">Silent Call (DFPlayer No Audio)</option>
                  <option value="delayed-answer">Delayed Answer / Timeout</option>
                  <option value="other">Other Telephony Incident</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Call Quality Rating (1 = Poor, 5 = Excellent)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      type="button" 
                      key={star} 
                      onClick={() => setRating(star as any)}
                      className={`btn btn-sm flex-1 text-xs font-bold ${rating >= star ? 'btn-warning text-white' : 'btn-outline'}`}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Description & Feedback</label>
                <textarea 
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Detail what happened during the call..." 
                  rows={3} 
                  required
                  className="textarea textarea-bordered w-full text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-warning text-white flex-1 font-bold text-xs"
                >
                  File Complaint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

