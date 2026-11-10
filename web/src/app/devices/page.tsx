'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Device, DeviceShare } from '@/types/device';
import ClickToCopy from '@/components/ClickToCopy';
import { 
  Server, 
  Plus, 
  Search, 
  Share2, 
  Radio, 
  Signal, 
  Battery, 
  Sliders, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  Phone,
  MessageSquare,
  ShieldCheck,
  Power,
  History,
  Calendar,
  User,
  ArrowRight
} from 'lucide-react';

export default function DevicesPage() {
  const { hasPermission, currentUser } = useAuth();
  const { devices, addDevice, updateDevice, deleteDevice, shareDevice, getDeviceEvents } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Quick History Modal State
  const [quickHistoryDev, setQuickHistoryDev] = useState<Device | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMac, setNewMac] = useState('');
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Farm Main Cluster');
  const [newSimNumber, setNewSimNumber] = useState('');
  const [newOperator, setNewOperator] = useState('Grameenphone');

  // Sharing Modal
  const [shareTargetDev, setShareTargetDev] = useState<Device | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [permDial, setPermDial] = useState(true);
  const [permSms, setPermSms] = useState(true);
  const [permReboot, setPermReboot] = useState(false);

  // Edit Modal
  const [editDev, setEditDev] = useState<Device | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');

  // Groups list for filter
  const allGroups = Array.from(new Set(devices.map(d => d.group)));

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.mac.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.sim_number.includes(searchTerm);
    const matchesGroup = selectedGroup === 'all' || d.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleAddDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMac) return;
    addDevice({
      mac: newMac.trim().toUpperCase(),
      name: newName || 'ESP32 SIM800L Node',
      group: newGroup,
      sim_number: newSimNumber || 'Unknown',
      sim_operator: newOperator
    });
    setIsAddModalOpen(false);
    setNewMac('');
    setNewName('');
    setNewSimNumber('');
  };

  const handleOpenShare = (dev: Device) => {
    setShareTargetDev(dev);
    setShareEmail('');
  };

  const handleSaveShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTargetDev || !shareEmail) return;

    const share: DeviceShare = {
      userId: 'usr_' + Date.now(),
      userEmail: shareEmail,
      permissions: {
        canDial: permDial,
        canSms: permSms,
        canView: true,
        canReboot: permReboot
      },
      sharedAt: new Date().toISOString()
    };
    shareDevice(shareTargetDev.mac, share);
    setShareTargetDev(null);
  };

  const handleOpenEdit = (dev: Device) => {
    setEditDev(dev);
    setEditName(dev.name);
    setEditGroup(dev.group);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDev) return;
    updateDevice(editDev.mac, { name: editName, group: editGroup });
    setEditDev(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" /> Hardware Fleet Management
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Register, configure, share, and monitor ESP32 SIM800L hardware gateways
          </p>
        </div>

        <div className="flex gap-2">
          {hasPermission('manager') && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-sm btn-primary gap-2 font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Device
            </button>
          )}
          <Link href="/devices/groups" className="btn btn-sm btn-outline gap-2 font-bold">
            Manage Groups & Bridges
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-base-100 p-3 rounded-2xl border border-base-200 shadow-xs">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Search by MAC, name, or phone number..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input input-bordered input-sm w-full pl-9 text-xs"
          />
        </div>

        <div className="flex gap-2">
          <select 
            value={selectedGroup} 
            onChange={e => setSelectedGroup(e.target.value)}
            className="select select-bordered select-sm text-xs font-semibold"
          >
            <option value="all">All Groups ({devices.length})</option>
            {allGroups.map(grp => (
              <option key={grp} value={grp}>{grp}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map(dev => (
          <div 
            key={dev.mac}
            className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/10 to-primary/20 flex items-center justify-center text-primary font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-base-content leading-tight">{dev.name}</h3>
                    <div className="mt-0.5">
                      <ClickToCopy text={dev.mac} className="text-[11px] text-base-content/60" title="Click to copy MAC address" />
                    </div>
                  </div>
                </div>

                <span className={`badge badge-sm font-bold uppercase text-[10px] py-1 px-2.5 gap-1 ${
                  dev.status === 'online' 
                    ? 'badge-success text-white' 
                    : dev.status === 'busy' 
                    ? 'badge-warning text-white' 
                    : 'badge-error text-white'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dev.status === 'online' ? 'bg-white animate-pulse' : 'bg-white'}`}></span>
                  {dev.status}
                </span>
              </div>

              {/* Online/Offline Status Banner with Last Offline Date & Time */}
              {dev.status === 'offline' ? (
                <div className="bg-error/10 border border-error/20 p-2.5 rounded-xl text-xs mb-3 flex flex-wrap items-center justify-between text-error font-medium gap-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                    <span>Device Offline</span>
                  </div>
                  <div className="font-mono text-[10px] text-error/90">
                    Last Offline: {dev.lastOffline ? new Date(dev.lastOffline).toLocaleString() : (dev.lastSeen ? new Date(dev.lastSeen).toLocaleString() : 'Recently')}
                  </div>
                </div>
              ) : dev.status === 'busy' ? (
                <div className="bg-warning/10 border border-warning/20 p-2.5 rounded-xl text-xs mb-3 flex items-center justify-between text-warning font-medium">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-warning animate-ping"></span>
                    <span>Active Call Busy</span>
                  </div>
                  <div className="font-mono text-[10px]">Dialing Line Occupied</div>
                </div>
              ) : (
                <div className="bg-success/10 border border-success/20 p-2.5 rounded-xl text-xs mb-3 flex items-center justify-between text-success font-medium">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                    <span>Online & Ready</span>
                  </div>
                  <div className="font-mono text-[10px] text-success/80">
                    Last Seen: {new Date(dev.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              )}

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 gap-2 bg-base-200/40 p-3 rounded-xl text-xs mb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Operator</span>
                  <span className="font-semibold text-base-content truncate block">{dev.sim_operator}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">Signal RSSI</span>
                  <span className="font-semibold text-base-content flex items-center gap-1">
                    <Signal className="w-3.5 h-3.5 text-success" /> {dev.sim_signal} ({dev.wifi_rssi} dBm)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">SIM Line</span>
                  <ClickToCopy text={dev.sim_number} className="text-[11px] font-semibold text-base-content truncate block" title="Click to copy SIM phone number" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block">IP Address</span>
                  <ClickToCopy text={dev.ip} className="text-[11px] font-semibold text-base-content truncate block" title="Click to copy IP address" />
                </div>
              </div>

              {/* Group & Shared Pill */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="badge badge-outline badge-xs font-semibold">{dev.group}</span>
                {dev.sharedWith.length > 0 && (
                  <span className="badge badge-primary badge-xs font-semibold gap-1">
                    <Share2 className="w-2.5 h-2.5" /> Shared ({dev.sharedWith.length})
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-base-200 flex flex-wrap items-center justify-between gap-1.5">
              <button 
                onClick={() => setQuickHistoryDev(dev)}
                className="btn btn-xs btn-outline btn-neutral font-bold gap-1 flex-1 text-[11px]"
                title="View what calls, actions and changes occurred on this device"
              >
                <History className="w-3.5 h-3.5 text-primary" /> Details & History
              </button>

              <Link 
                href={`/devices/${encodeURIComponent(dev.mac)}`}
                className="btn btn-xs btn-primary font-bold gap-1 flex-1 text-[11px]"
              >
                <Sliders className="w-3.5 h-3.5" /> Controls
              </Link>

              {hasPermission('manager') && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleOpenShare(dev)}
                    title="Share Device Permissions"
                    className="btn btn-xs btn-ghost btn-square"
                  >
                    <Share2 className="w-3.5 h-3.5 text-base-content/70" />
                  </button>
                  <button 
                    onClick={() => handleOpenEdit(dev)}
                    title="Edit Name & Group"
                    className="btn btn-xs btn-ghost btn-square"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-base-content/70" />
                  </button>
                  {hasPermission('admin') && (
                    <button 
                      onClick={() => deleteDevice(dev.mac)}
                      title="Delete Device"
                      className="btn btn-xs btn-ghost btn-square text-error"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Add New SIM800L Device</h3>
            <p className="text-xs text-base-content/60 mb-4">Register an ESP32 hardware gateway by physical MAC</p>

            <form onSubmit={handleAddDevice} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">MAC Address (Required)</label>
                <input 
                  type="text" 
                  value={newMac} 
                  onChange={e => setNewMac(e.target.value)}
                  placeholder="e.g. 24:0A:C4:AA:BB:CC" 
                  required 
                  className="input input-bordered input-sm w-full font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Friendly Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. North Gate Alert Node" 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-base-content/70 block mb-1">Cluster Group</label>
                  <input 
                    type="text" 
                    value={newGroup} 
                    onChange={e => setNewGroup(e.target.value)}
                    placeholder="Farm Main Cluster" 
                    className="input input-bordered input-sm w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-base-content/70 block mb-1">Cellular Operator</label>
                  <select 
                    value={newOperator} 
                    onChange={e => setNewOperator(e.target.value)}
                    className="select select-bordered select-sm w-full text-xs"
                  >
                    <option value="Grameenphone">Grameenphone</option>
                    <option value="Banglalink">Banglalink</option>
                    <option value="Robi Axiata">Robi Axiata</option>
                    <option value="Teletalk">Teletalk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">SIM Phone Number</label>
                <input 
                  type="text" 
                  value={newSimNumber} 
                  onChange={e => setNewSimNumber(e.target.value)}
                  placeholder="+8801700000000" 
                  className="input input-bordered input-sm w-full text-xs font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Device Modal */}
      {shareTargetDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200">
            <h3 className="font-bold text-lg text-base-content mb-1">Share Hardware Gateway</h3>
            <p className="text-xs text-base-content/60 mb-4">
              Delegate calling & messaging access for <span className="font-bold text-primary">{shareTargetDev.name}</span>
            </p>

            <form onSubmit={handleSaveShare} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Share with User Email</label>
                <input 
                  type="email" 
                  value={shareEmail} 
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="operator@company.com" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div className="space-y-2 bg-base-200/50 p-3 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 block mb-1">
                  Granted Privileges
                </span>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permDial} 
                    onChange={e => setPermDial(e.target.checked)} 
                    className="checkbox checkbox-sm checkbox-primary" 
                  />
                  <span>Can trigger voice calls & audio playback</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permSms} 
                    onChange={e => setPermSms(e.target.checked)} 
                    className="checkbox checkbox-sm checkbox-primary" 
                  />
                  <span>Can send outbound SMS via SIM800L</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permReboot} 
                    onChange={e => setPermReboot(e.target.checked)} 
                    className="checkbox checkbox-sm checkbox-primary" 
                  />
                  <span>Can execute hardware reset / flight mode</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShareTargetDev(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Grant Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {editDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200">
            <h3 className="font-bold text-lg text-base-content mb-1">Edit Device Profile</h3>
            <p className="text-xs font-mono text-base-content/60 mb-4">{editDev.mac}</p>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Friendly Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Group / Zone</label>
                <input 
                  type="text" 
                  value={editGroup} 
                  onChange={e => setEditGroup(e.target.value)}
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setEditDev(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Update Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Quick History Modal */}
      {quickHistoryDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-base-200 animate-in fade-in max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between pb-3 border-b border-base-200 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                      {quickHistoryDev.name}
                      <span className={`badge badge-xs font-bold uppercase gap-1 ${
                        quickHistoryDev.status === 'online'
                          ? 'badge-success text-white'
                          : quickHistoryDev.status === 'busy'
                          ? 'badge-warning text-white'
                          : 'badge-error text-white'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${quickHistoryDev.status === 'online' ? 'bg-white animate-pulse' : 'bg-white'}`}></span>
                        {quickHistoryDev.status}
                      </span>
                    </h3>
                    <p className="text-xs font-mono text-base-content/60">
                      MAC: {quickHistoryDev.mac} • SIM: {quickHistoryDev.sim_number} ({quickHistoryDev.sim_operator})
                    </p>
                    {quickHistoryDev.status === 'offline' && (
                      <p className="text-[11px] font-mono text-error font-medium mt-0.5">
                        Last Offline: {quickHistoryDev.lastOffline ? new Date(quickHistoryDev.lastOffline).toLocaleString() : (quickHistoryDev.lastSeen ? new Date(quickHistoryDev.lastSeen).toLocaleString() : 'Recently')}
                      </p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setQuickHistoryDev(null)} 
                  className="btn btn-sm btn-circle btn-ghost"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Event Stream */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {getDeviceEvents(quickHistoryDev.mac).length === 0 ? (
                  <p className="text-center py-10 text-xs text-base-content/40 italic">
                    No action or call history logged for this device yet.
                  </p>
                ) : (
                  getDeviceEvents(quickHistoryDev.mac).map(evt => (
                    <div 
                      key={evt.id} 
                      className="p-3 bg-base-200/40 rounded-xl border border-base-200 text-xs flex flex-col gap-1 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-xs uppercase font-bold text-[9px] ${
                            evt.severity === 'success' ? 'badge-success text-white' :
                            evt.severity === 'warning' ? 'badge-warning text-white' : 'badge-primary text-white'
                          }`}>
                            {evt.type.replace('_', ' ')}
                          </span>
                          <span className="font-bold text-base-content">{evt.actionTitle}</span>
                        </div>
                        <span className="text-[10px] text-base-content/50 font-mono">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-base-content/80 text-[11px] leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="text-[10px] text-base-content/50 flex items-center justify-between pt-1 border-t border-base-200/60 mt-1">
                        <span>By: <strong className="text-base-content">{evt.actorName}</strong> {evt.actorRole && `(${evt.actorRole.toUpperCase()})`}</span>
                        {evt.metadata?.phoneNumber && (
                          <span className="font-mono font-semibold text-primary">Tel: {evt.metadata.phoneNumber}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-base-200 flex items-center justify-between">
              <span className="text-xs text-base-content/50">
                {getDeviceEvents(quickHistoryDev.mac).length} total logged events
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setQuickHistoryDev(null)} 
                  className="btn btn-sm btn-ghost text-xs"
                >
                  Close
                </button>
                <Link 
                  href={`/devices/${encodeURIComponent(quickHistoryDev.mac)}`}
                  className="btn btn-sm btn-primary text-xs font-bold gap-1"
                >
                  Full History & Controls <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

