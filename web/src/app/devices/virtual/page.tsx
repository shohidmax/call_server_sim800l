'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { VirtualDevice } from '@/types/device';
import ClickToCopy from '@/components/ClickToCopy';
import { 
  Cpu, 
  Layers, 
  Plus, 
  Trash2, 
  Radio, 
  CheckCircle2, 
  Activity, 
  Sparkles,
  Server,
  Clock,
  PhoneCall,
  MessageSquare,
  Copy,
  Check,
  X,
  Sliders,
  RotateCcw
} from 'lucide-react';

export default function VirtualDevicesPage() {
  const { hasPermission } = useAuth();
  const { 
    devices, 
    virtualDevices, 
    createVirtualDevice, 
    updateVirtualDevice, 
    deleteVirtualDevice, 
    triggerBroadcast, 
    audioTracks 
  } = useData();

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vName, setVName] = useState('');
  const [vType, setVType] = useState<VirtualDevice['type']>('aggregated-pool');
  const [vDesc, setVDesc] = useState('');
  const [boundMacs, setBoundMacs] = useState<string[]>([]);

  // Edit Modal State
  const [editVDev, setEditVDev] = useState<VirtualDevice | null>(null);

  // Quick Dispatch Call via Virtual Device Modal State
  const [activeVirtualDeviceForCall, setActiveVirtualDeviceForCall] = useState<VirtualDevice | null>(null);
  const [quickPhone, setQuickPhone] = useState('');
  const [quickAudio, setQuickAudio] = useState('0001');
  const [isCalling, setIsCalling] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const toggleBoundMac = (mac: string) => {
    setBoundMacs(prev => 
      prev.includes(mac) ? prev.filter(m => m !== mac) : [...prev, mac]
    );
  };

  const toggleEditBoundMac = (mac: string) => {
    if (!editVDev) return;
    const exists = editVDev.boundPhysicalMacs.includes(mac);
    const updated = exists 
      ? editVDev.boundPhysicalMacs.filter(m => m !== mac) 
      : [...editVDev.boundPhysicalMacs, mac];
    setEditVDev({ ...editVDev, boundPhysicalMacs: updated });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName) return;

    const randomSuffix = Math.floor(10 + Math.random() * 89);
    createVirtualDevice({
      name: vName,
      virtualMac: `V-MAC:FF:EE:DD:${randomSuffix}`,
      type: vType,
      boundPhysicalMacs: boundMacs,
      activeMac: boundMacs[0] || undefined,
      status: 'active',
      description: vDesc || 'Custom aggregated virtual GSM modem',
      totalCallDurationSeconds: 0,
      totalCallCount: 0,
      totalSmsCount: 0,
      lastCallDurationSeconds: 0,
      lastActive: new Date().toISOString()
    });

    setIsModalOpen(false);
    setVName('');
    setVDesc('');
    setBoundMacs([]);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVDev) return;

    updateVirtualDevice(editVDev.id, {
      name: editVDev.name,
      description: editVDev.description,
      type: editVDev.type,
      status: editVDev.status,
      boundPhysicalMacs: editVDev.boundPhysicalMacs,
      totalCallDurationSeconds: editVDev.totalCallDurationSeconds,
      totalCallCount: editVDev.totalCallCount,
      totalSmsCount: editVDev.totalSmsCount
    });

    setEditVDev(null);
  };

  const handleQuickCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVirtualDeviceForCall || !quickPhone) return;

    setIsCalling(true);
    await triggerBroadcast([quickPhone], {
      virtualId: activeVirtualDeviceForCall.virtualMac || activeVirtualDeviceForCall.id,
      audio: quickAudio
    });

    setIsCalling(false);
    setActiveVirtualDeviceForCall(null);
    setQuickPhone('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" /> Virtual GSM Modems & Dedicated Addresses
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Configure virtual endpoints, track cumulative talk time per virtual address, and bind physical SIM800L clusters
          </p>
        </div>

        {hasPermission('manager') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-sm btn-primary gap-2 font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Virtual Device
          </button>
        )}
      </div>

      {/* Virtual Devices List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {virtualDevices.map(vdev => (
          <div 
            key={vdev.id}
            className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
          >
            <div>
              {/* Top Bar */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-secondary/10 to-secondary/30 flex items-center justify-center text-secondary font-bold">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-base-content">{vdev.name}</h3>
                    <div className="mt-0.5">
                      <ClickToCopy 
                        text={vdev.virtualMac} 
                        className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded"
                        title="Click to copy Virtual Address" 
                      />
                    </div>
                  </div>
                </div>

                <span className="badge badge-success badge-sm font-bold uppercase text-[10px] text-white">
                  {vdev.status}
                </span>
              </div>

              <p className="text-xs text-base-content/70 mb-3">{vdev.description}</p>

              {/* Talk Time & Statistics Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-base-200/40 p-2.5 rounded-xl border border-base-200 mb-3">
                <div className="text-center border-r border-base-200">
                  <span className="text-[9px] uppercase font-bold text-base-content/50 block">Cumulative Talk</span>
                  <span className="text-sm font-mono font-black text-success block mt-0.5">
                    {formatDuration(vdev.totalCallDurationSeconds || 0)}
                  </span>
                  <span className="text-[9px] text-base-content/40">Total Talked</span>
                </div>
                <div className="text-center border-r border-base-200">
                  <span className="text-[9px] uppercase font-bold text-base-content/50 block">Last Call Time</span>
                  <span className="text-sm font-mono font-bold text-base-content block mt-0.5">
                    {formatDuration(vdev.lastCallDurationSeconds || 0)}
                  </span>
                  <span className="text-[9px] text-base-content/40">Latest session</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] uppercase font-bold text-base-content/50 block">Traffic Total</span>
                  <span className="text-sm font-mono font-bold text-primary block mt-0.5">
                    {vdev.totalCallCount || 0} calls
                  </span>
                  <span className="text-[9px] text-base-content/40">{vdev.totalSmsCount || 0} SMS</span>
                </div>
              </div>

              {/* Bound Physical Modems */}
              <div className="bg-base-200/50 p-3 rounded-xl space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-base-content/50 mb-1">
                  <span>Bound Physical Modems</span>
                  <span className="badge badge-xs badge-neutral capitalize">{vdev.type.replace('-', ' ')}</span>
                </div>

                {vdev.boundPhysicalMacs.length === 0 ? (
                  <p className="text-xs text-base-content/50 italic py-1">Virtual simulator mode (no physical hardware bound)</p>
                ) : (
                  vdev.boundPhysicalMacs.map(mac => {
                    const dev = devices.find(d => d.mac === mac);
                    const isActive = vdev.activeMac === mac;
                    return (
                      <div key={mac} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-base-100 border border-base-200">
                        <span className="font-medium text-base-content flex items-center gap-1.5">
                          {isActive && <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>}
                          {dev?.name || 'SIM800L Node'}
                        </span>
                        <ClickToCopy text={mac} className="text-[10px] text-base-content/50" title="Click to copy MAC address" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-base-200 flex items-center justify-between text-xs">
              <span className="text-[11px] text-base-content/50 font-mono">
                Active Line: {vdev.activeMac || 'Auto-Pool'}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveVirtualDeviceForCall(vdev)}
                  className="btn btn-xs btn-outline btn-primary gap-1 font-bold"
                  title="Make a call through this virtual device"
                >
                  <PhoneCall className="w-3 h-3" /> Test Call
                </button>

                {hasPermission('admin') && (
                  <>
                    <button 
                      onClick={() => setEditVDev(vdev)}
                      className="btn btn-ghost btn-xs text-info font-bold gap-1"
                      title="Edit Virtual Device settings"
                    >
                      <Sliders className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete virtual device "${vdev.name}"?`)) {
                          deleteVirtualDevice(vdev.id);
                        }
                      }}
                      className="btn btn-ghost btn-xs text-error font-bold gap-1"
                      title="Delete Virtual Device"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Virtual Device */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Create Custom Virtual Device</h3>
            <p className="text-xs text-base-content/60 mb-4">Define a virtual gateway with failover & bonding rules</p>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Virtual Device Name</label>
                <input 
                  type="text" 
                  value={vName}
                  onChange={e => setVName(e.target.value)}
                  placeholder="e.g. VIP Priority Call Gateway" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Virtual Architecture Type</label>
                <select 
                  value={vType} 
                  onChange={e => setVType(e.target.value as any)}
                  className="select select-bordered select-sm w-full text-xs font-medium"
                >
                  <option value="aggregated-pool">Aggregated Pool (Bonded SIM lines)</option>
                  <option value="failover-pair">Active / Standby Failover Pair</option>
                  <option value="simulated-modem">Software GSM Simulator (Virtual Line)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Description</label>
                <input 
                  type="text" 
                  value={vDesc}
                  onChange={e => setVDesc(e.target.value)}
                  placeholder="e.g. Dedicated virtual line for high priority alerts" 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Bind Physical SIM800L Nodes</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-base-200 p-2 rounded-xl">
                  {devices.map(d => (
                    <label key={d.mac} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-base-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={boundMacs.includes(d.mac)} 
                        onChange={() => toggleBoundMac(d.mac)}
                        className="checkbox checkbox-xs checkbox-secondary" 
                      />
                      <span className="font-semibold text-base-content truncate">{d.name}</span>
                      <span className="font-mono text-[10px] text-base-content/50 ml-auto">{d.mac}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Deploy Virtual Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Edit Virtual Device */}
      {editVDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-base-200">
              <div>
                <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-info" /> Admin: Edit Virtual Device
                </h3>
                <p className="text-[11px] font-mono text-primary font-bold">{editVDev.virtualMac}</p>
              </div>
              <button 
                onClick={() => setEditVDev(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Virtual Device Name</label>
                <input 
                  type="text" 
                  value={editVDev.name}
                  onChange={e => setEditVDev({ ...editVDev, name: e.target.value })}
                  required
                  className="input input-bordered input-sm w-full text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Architecture Type</label>
                  <select 
                    value={editVDev.type}
                    onChange={e => setEditVDev({ ...editVDev, type: e.target.value as any })}
                    className="select select-bordered select-sm w-full text-xs"
                  >
                    <option value="aggregated-pool">Aggregated Pool</option>
                    <option value="failover-pair">Failover Pair</option>
                    <option value="simulated-modem">Simulator</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-base-content/70 block mb-1">Status</label>
                  <select 
                    value={editVDev.status}
                    onChange={e => setEditVDev({ ...editVDev, status: e.target.value as any })}
                    className="select select-bordered select-sm w-full text-xs font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="degraded">Degraded</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Description</label>
                <input 
                  type="text" 
                  value={editVDev.description || ''}
                  onChange={e => setEditVDev({ ...editVDev, description: e.target.value })}
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              {/* Manage Bound Physical Modems */}
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Bonded SIM800L Nodes</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-base-200 p-2 rounded-xl">
                  {devices.map(d => (
                    <label key={d.mac} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-base-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editVDev.boundPhysicalMacs.includes(d.mac)} 
                        onChange={() => toggleEditBoundMac(d.mac)}
                        className="checkbox checkbox-xs checkbox-secondary" 
                      />
                      <span className="font-semibold text-base-content truncate">{d.name}</span>
                      <span className="font-mono text-[10px] text-base-content/50 ml-auto">{d.mac}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Talk Duration Counter Reset */}
              <div className="p-2.5 rounded-xl bg-base-200/50 border border-base-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-base-content block">Cumulative Talk Time:</span>
                  <span className="font-mono text-success font-black text-xs">
                    {formatDuration(editVDev.totalCallDurationSeconds || 0)} ({editVDev.totalCallCount || 0} calls)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditVDev({ ...editVDev, totalCallDurationSeconds: 0, totalCallCount: 0 })}
                  className="btn btn-xs btn-outline btn-warning gap-1 text-[10px]"
                  title="Reset counter to 0s"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Stats
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditVDev(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Test Call via Virtual Device */}
      {activeVirtualDeviceForCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-base-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-base-200">
              <div>
                <h3 className="font-bold text-base text-base-content flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-primary" /> Test Call via Virtual Line
                </h3>
                <p className="text-[11px] font-mono text-primary font-bold">
                  {activeVirtualDeviceForCall.name} ({activeVirtualDeviceForCall.virtualMac})
                </p>
              </div>
              <button 
                onClick={() => setActiveVirtualDeviceForCall(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCall} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Recipient Mobile Number</label>
                <input 
                  type="text" 
                  value={quickPhone}
                  onChange={e => setQuickPhone(e.target.value)}
                  placeholder="+88017XXXXXXXX"
                  required
                  className="input input-bordered input-sm w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Audio Prompt Track</label>
                <select 
                  value={quickAudio}
                  onChange={e => setQuickAudio(e.target.value)}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  {audioTracks.map(t => (
                    <option key={t.id} value={t.trackNumber}>
                      Track [{t.trackNumber}] - {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2 rounded-lg bg-base-200/60 text-[10px] text-base-content/60">
                Talk time for this call will be recorded under virtual address <span className="font-mono font-bold text-base-content">{activeVirtualDeviceForCall.virtualMac}</span>.
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setActiveVirtualDeviceForCall(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isCalling}
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  {isCalling ? 'Dialing...' : 'Dispatch Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
