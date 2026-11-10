'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  Activity,
  Trash2
} from 'lucide-react';
import { UserBehaviorLog } from '@/types/user';

export default function UserLogsPage() {
  const { hasPermission } = useAuth();
  const { behaviorLogs, deleteBehaviorLog, clearBehaviorLogs } = useData();
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Built-in seed logs if empty
  const displayLogs: UserBehaviorLog[] = behaviorLogs.length > 0 ? behaviorLogs : [
    {
      id: 'log_01',
      userId: 'usr_admin_01',
      userName: 'Sarwar Jahan',
      userRole: 'admin',
      action: 'LOGIN',
      targetResource: 'Web Console',
      details: 'Administrator session authenticated from 127.0.0.1',
      ipAddress: '127.0.0.1',
      timestamp: '2026-11-08T06:45:00Z',
      status: 'success'
    },
    {
      id: 'log_02',
      userId: 'usr_mgr_02',
      userName: 'Tariqul Islam',
      userRole: 'manager',
      action: 'DIAL_CALL',
      targetResource: '01731626274',
      details: 'Dispatched voice call with DFPlayer prompt track 0001',
      ipAddress: '192.168.1.50',
      timestamp: '2026-11-07T14:22:10Z',
      status: 'success'
    },
    {
      id: 'log_03',
      userId: 'usr_mgr_02',
      userName: 'Tariqul Islam',
      userRole: 'manager',
      action: 'USSD_QUERY',
      targetResource: '44:1D:64:BD:22:EC',
      details: 'Executed AT+CUSD for balance query *121#',
      ipAddress: '192.168.1.50',
      timestamp: '2026-11-07T14:20:00Z',
      status: 'success'
    },
    {
      id: 'log_04',
      userId: 'usr_mod_03',
      userName: 'Amina Khatun',
      userRole: 'moderator',
      action: 'SEND_SMS',
      targetResource: '+8801944556677',
      details: 'Sent outbound alert SMS text to subscriber',
      ipAddress: '192.168.1.88',
      timestamp: '2026-11-06T12:05:00Z',
      status: 'success'
    },
    {
      id: 'log_05',
      userId: 'usr_admin_01',
      userName: 'Sarwar Jahan',
      userRole: 'admin',
      action: 'CREATE_GROUP',
      targetResource: 'Farm Main Cluster',
      details: 'Created load-balanced modem cluster with 2 hardware nodes',
      ipAddress: '127.0.0.1',
      timestamp: '2026-11-05T08:00:00Z',
      status: 'success'
    }
  ];

  const filtered = displayLogs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (log.targetResource && log.targetResource.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" /> User Behavior & Security Audit Trail
        </h1>
        <p className="text-xs text-base-content/60 mt-0.5">
          Immutable forensic log of operator actions, voice calls, SMS transmissions, and hardware resets
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-base-100 p-3 rounded-2xl border border-base-200 shadow-xs">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Search audit trail by operator, target resource, or keyword..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input input-bordered input-sm w-full pl-9 text-xs"
          />
        </div>

        <div className="flex gap-2">
          <select 
            value={filterAction} 
            onChange={e => setFilterAction(e.target.value)}
            className="select select-bordered select-sm text-xs font-semibold"
          >
            <option value="all">All Actions ({displayLogs.length})</option>
            <option value="LOGIN">LOGIN</option>
            <option value="DIAL_CALL">DIAL_CALL</option>
            <option value="HANGUP">HANGUP</option>
            <option value="SEND_SMS">SEND_SMS</option>
            <option value="ADD_DEVICE">ADD_DEVICE</option>
            <option value="REBOOT_DEVICE">REBOOT_DEVICE</option>
            <option value="USSD_QUERY">USSD_QUERY</option>
            <option value="CREATE_GROUP">CREATE_GROUP</option>
            <option value="ADMIN_ACTION">ADMIN_ACTION</option>
          </select>

          {hasPermission('admin') && displayLogs.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all security audit trail logs? This action is permanent.')) {
                  clearBehaviorLogs();
                }
              }}
              className="btn btn-sm btn-ghost text-error text-xs gap-1 border border-error/20"
              title="Clear all forensic logs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card bg-base-100 border border-base-200 shadow-xs overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="border-b border-base-200 text-[11px] uppercase tracking-wider text-base-content/60">
              <th>Timestamp</th>
              <th>Operator</th>
              <th>Role</th>
              <th>Action</th>
              <th>Target Resource</th>
              <th>Audit Description</th>
              <th>IP Address</th>
              <th>Status</th>
              {hasPermission('admin') && <th className="text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 text-xs">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-base-200/40">
                <td className="font-mono text-[11px] text-base-content/60 whitespace-nowrap">
                  {new Date(item.timestamp).toLocaleString()}
                </td>
                <td className="font-bold text-base-content whitespace-nowrap">
                  {item.userName}
                </td>
                <td>
                  <span className="badge badge-outline badge-xs font-bold uppercase text-[9px]">
                    {item.userRole}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-sm font-bold text-[10px] uppercase font-mono ${
                    item.action === 'DIAL_CALL' ? 'badge-primary text-white' :
                    item.action === 'SEND_SMS' ? 'badge-secondary text-white' :
                    item.action === 'REBOOT_DEVICE' ? 'badge-warning text-white' :
                    item.action === 'LOGIN' ? 'badge-info text-white' : 'badge-neutral'
                  }`}>
                    {item.action}
                  </span>
                </td>
                <td className="font-mono font-semibold text-[11px] text-base-content">
                  {item.targetResource || '—'}
                </td>
                <td className="text-base-content/80 max-w-xs truncate">
                  {item.details}
                </td>
                <td className="font-mono text-[11px] text-base-content/50">
                  {item.ipAddress}
                </td>
                <td>
                  <span className={`badge badge-xs uppercase font-bold text-[9px] ${
                    item.status === 'success' ? 'badge-success text-white' : 'badge-error text-white'
                  }`}>
                    {item.status}
                  </span>
                </td>
                {hasPermission('admin') && (
                  <td className="text-right">
                    <button
                      onClick={() => deleteBehaviorLog(item.id)}
                      className="btn btn-xs btn-ghost text-error"
                      title="Delete log record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

