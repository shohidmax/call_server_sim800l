'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { BlockedNumber } from '@/types/call';
import { 
  PhoneOff, 
  Plus, 
  Trash2, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  Sliders,
  X
} from 'lucide-react';

export default function BlockedNumbersPage() {
  const { hasPermission, currentUser } = useAuth();
  const { blockedNumbers, addBlockedNumber, updateBlockedNumber, toggleBlockedNumber, removeBlockedNumber } = useData();

  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [rule, setRule] = useState<BlockedNumber['autoRejectRule']>('hangup');

  // Edit Modal State
  const [editBlocked, setEditBlocked] = useState<BlockedNumber | null>(null);

  const filtered = blockedNumbers.filter(b => 
    b.phoneNumber.includes(search) || 
    b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.reason.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    addBlockedNumber({
      phoneNumber: phone.trim(),
      label: label || 'Unlabeled',
      reason: reason || 'Unauthorized inbound caller',
      blockedBy: currentUser?.email || 'admin@sim800l.local',
      autoRejectRule: rule,
      isActive: true
    });

    setIsAddOpen(false);
    setPhone('');
    setLabel('');
    setReason('');
  };

  const handleSaveEditBlocked = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBlocked) return;

    updateBlockedNumber(editBlocked.id, {
      label: editBlocked.label,
      reason: editBlocked.reason,
      autoRejectRule: editBlocked.autoRejectRule
    });

    setEditBlocked(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <PhoneOff className="w-6 h-6 text-error" /> Blocked Numbers & Auto-Reject Rules
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Prevent spam, nuisance calls, and unauthorized numbers from occupying your physical cellular channels
          </p>
        </div>

        {hasPermission('moderator') && (
          <button 
            onClick={() => setIsAddOpen(true)}
            className="btn btn-sm btn-error text-white gap-2 font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Blocked Number
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
          <Search className="w-4 h-4" />
        </span>
        <input 
          type="text" 
          placeholder="Filter blacklist by number, label, or reason..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input input-bordered input-sm w-full pl-9 text-xs"
        />
      </div>

      {/* Blocked Numbers Table */}
      <div className="card bg-base-100 border border-base-200 shadow-xs overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="border-b border-base-200 text-[11px] uppercase tracking-wider text-base-content/60">
              <th>Blocked Phone Number</th>
              <th>Label / Identity</th>
              <th>Rejection Rule</th>
              <th>Reason</th>
              <th>Blocked By</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-base-content/40">
                  No blocked numbers in blacklist
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} className="hover:bg-base-200/40">
                  <td className="font-mono font-bold text-base-content text-sm">
                    {item.phoneNumber}
                  </td>
                  <td className="font-semibold text-base-content">
                    {item.label}
                  </td>
                  <td>
                    <span className="badge badge-outline badge-xs font-mono font-semibold uppercase text-[10px]">
                      {item.autoRejectRule}
                    </span>
                  </td>
                  <td className="text-base-content/70 max-w-xs truncate">
                    {item.reason}
                  </td>
                  <td className="text-[11px] text-base-content/60">
                    {item.blockedBy}
                  </td>
                  <td>
                    <label className="cursor-pointer label p-0 gap-2">
                      <input 
                        type="checkbox" 
                        checked={item.isActive} 
                        onChange={() => toggleBlockedNumber(item.id)}
                        className="toggle toggle-error toggle-xs" 
                      />
                      <span className="text-[10px] font-bold uppercase">{item.isActive ? 'Active' : 'Muted'}</span>
                    </label>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setEditBlocked(item)}
                        className="btn btn-ghost btn-xs text-info hover:bg-info/10"
                        title="Edit Blacklist Rule"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Remove ${item.phoneNumber} from blacklist?`)) {
                            removeBlockedNumber(item.id);
                          }
                        }}
                        className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                        title="Unblock Number"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Blocked Number */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Add Number to Blocklist</h3>
            <p className="text-xs text-base-content/60 mb-4">Automatically terminate or reject inbound calls from this number</p>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Phone Number (Required)</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+8801999999999" 
                  required 
                  className="input input-bordered input-sm w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Caller Label / Identity</label>
                <input 
                  type="text" 
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Robocaller / Telemarketing Spammer" 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Auto-Reject Action</label>
                <select 
                  value={rule} 
                  onChange={e => setRule(e.target.value as any)}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  <option value="hangup">Immediate ATH Hang Up (Drop Call)</option>
                  <option value="busy-tone">Simulate Line Busy Tone</option>
                  <option value="forward-voicemail">Forward to Silent Audio Loop</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Reason / Note</label>
                <textarea 
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Why is this number being blocked?" 
                  rows={3}
                  className="textarea textarea-bordered w-full text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-error text-white flex-1 font-bold text-xs"
                >
                  Block Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Edit Blocked Number */}
      {editBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-base-200">
              <div>
                <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-info" /> Admin: Edit Blacklist Rule
                </h3>
                <p className="text-[11px] font-mono text-error font-bold">{editBlocked.phoneNumber}</p>
              </div>
              <button 
                onClick={() => setEditBlocked(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBlocked} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Caller Label / Identity</label>
                <input 
                  type="text" 
                  value={editBlocked.label}
                  onChange={e => setEditBlocked({ ...editBlocked, label: e.target.value })}
                  required
                  className="input input-bordered input-sm w-full text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Auto-Reject Action</label>
                <select 
                  value={editBlocked.autoRejectRule}
                  onChange={e => setEditBlocked({ ...editBlocked, autoRejectRule: e.target.value as any })}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  <option value="hangup">Immediate ATH Remote Hangup (Drop Line)</option>
                  <option value="busy-tone">Generate Local Busy Tone (Network Busy)</option>
                  <option value="forward-voicemail">Silent Diversion to Voicemail</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Reason / Notes</label>
                <textarea 
                  value={editBlocked.reason}
                  onChange={e => setEditBlocked({ ...editBlocked, reason: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditBlocked(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Rule Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

