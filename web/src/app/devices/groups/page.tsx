'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { DeviceGroup, DeviceBridge } from '@/types/device';
import { 
  Network, 
  Layers, 
  Plus, 
  ArrowRightLeft, 
  Radio, 
  Trash2, 
  Sliders, 
  CheckCircle2, 
  Share2, 
  ArrowRight,
  GitBranch
} from 'lucide-react';

export default function DeviceGroupsPage() {
  const { hasPermission } = useAuth();
  const { devices, groups, bridges, createGroup, updateGroup, deleteGroup, createBridge, toggleBridge } = useData();

  // Create Group Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupStrategy, setGroupStrategy] = useState<DeviceGroup['strategy']>('round-robin');
  const [selectedMacs, setSelectedMacs] = useState<string[]>([]);

  // Edit Group Modal State
  const [editGroup, setEditGroup] = useState<DeviceGroup | null>(null);

  // Create Bridge Modal
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [bridgeName, setBridgeName] = useState('');
  const [sourceGroup, setSourceGroup] = useState(groups[0]?.id || '');
  const [targetGroup, setTargetGroup] = useState(groups[1]?.id || '');
  const [bridgeMode, setBridgeMode] = useState<DeviceBridge['bridgeMode']>('overflow');

  const toggleSelectMac = (mac: string) => {
    setSelectedMacs(prev => 
      prev.includes(mac) ? prev.filter(m => m !== mac) : [...prev, mac]
    );
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || selectedMacs.length === 0) return;

    createGroup({
      name: groupName,
      description: groupDesc || 'Custom merged modem cluster',
      deviceMacs: selectedMacs,
      strategy: groupStrategy
    });

    setIsGroupModalOpen(false);
    setGroupName('');
    setGroupDesc('');
    setSelectedMacs([]);
  };

  const toggleEditGroupMac = (mac: string) => {
    if (!editGroup) return;
    const exists = editGroup.deviceMacs.includes(mac);
    const updated = exists 
      ? editGroup.deviceMacs.filter(m => m !== mac) 
      : [...editGroup.deviceMacs, mac];
    setEditGroup({ ...editGroup, deviceMacs: updated });
  };

  const handleSaveEditGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup || editGroup.deviceMacs.length === 0) return;

    updateGroup(editGroup.id, {
      name: editGroup.name,
      description: editGroup.description,
      strategy: editGroup.strategy,
      deviceMacs: editGroup.deviceMacs
    });

    setEditGroup(null);
  };

  const handleCreateBridge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bridgeName || !sourceGroup || !targetGroup) return;

    createBridge({
      name: bridgeName,
      sourceGroupId: sourceGroup,
      targetGroupId: targetGroup,
      bridgeMode,
      status: 'enabled'
    });

    setIsBridgeModalOpen(false);
    setBridgeName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> Merged Groups & Cluster Bridges
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Pool multiple physical SIM800L modems into load-balanced clusters with automatic cross-cluster failover bridges
          </p>
        </div>

        {hasPermission('manager') && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsBridgeModalOpen(true)}
              className="btn btn-sm btn-outline gap-2 font-bold"
            >
              <ArrowRightLeft className="w-4 h-4" /> Create Bridge
            </button>
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="btn btn-sm btn-primary gap-2 font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Merge & Group Modems
            </button>
          </div>
        )}
      </div>

      {/* Merged Device Groups Grid */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-base-content/60 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Active Merged Clusters ({groups.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(grp => (
            <div 
              key={grp.id}
              className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                      {grp.name}
                    </h3>
                    <p className="text-xs text-base-content/60 mt-0.5">{grp.description}</p>
                  </div>
                  <span className="badge badge-primary badge-sm font-bold uppercase text-[10px]">
                    {grp.strategy}
                  </span>
                </div>

                {/* Member Devices */}
                <div className="space-y-1.5 my-3 bg-base-200/40 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-base-content/50 block mb-1">
                    Pooled Hardware Modems ({grp.deviceMacs.length})
                  </span>
                  {grp.deviceMacs.map(mac => {
                    const dev = devices.find(d => d.mac === mac);
                    return (
                      <div key={mac} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-base-100 border border-base-200">
                        <span className="font-bold text-base-content truncate max-w-[150px]">
                          {dev?.name || 'SIM800L Node'}
                        </span>
                        <span className="font-mono text-[11px] text-base-content/60">{mac}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-base-200 flex items-center justify-between text-xs">
                <span className="text-base-content/60">
                  Created {new Date(grp.createdAt).toLocaleDateString()}
                </span>
                {hasPermission('admin') && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditGroup(grp)}
                      className="btn btn-ghost btn-xs text-info font-bold"
                      title="Edit Group Settings"
                    >
                      <Sliders className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete/dissolve group "${grp.name}"?`)) {
                          deleteGroup(grp.id);
                        }
                      }}
                      className="btn btn-ghost btn-xs text-error font-bold"
                      title="Dissolve Group"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Dissolve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cluster Bridges Grid */}
      <div className="pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-base-content/60 mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-secondary" /> Inter-Cluster Bridges ({bridges.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bridges.map(bridge => {
            const src = groups.find(g => g.id === bridge.sourceGroupId);
            const tgt = groups.find(g => g.id === bridge.targetGroupId);

            return (
              <div key={bridge.id} className="card bg-base-100 border border-base-200 shadow-xs p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-sm text-base-content">{bridge.name}</h3>
                    <span className="badge badge-outline badge-xs font-bold uppercase mt-1">
                      Mode: {bridge.bridgeMode}
                    </span>
                  </div>
                  <div className="form-control">
                    <label className="label cursor-pointer p-0 gap-2">
                      <span className="text-xs font-semibold capitalize text-base-content/70">{bridge.status}</span>
                      <input 
                        type="checkbox" 
                        checked={bridge.status === 'enabled'} 
                        onChange={() => toggleBridge(bridge.id)}
                        className="toggle toggle-primary toggle-sm" 
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-base-200/50 p-3 rounded-xl text-xs my-2">
                  <div className="text-center flex-1">
                    <span className="text-[10px] text-base-content/50 block font-bold uppercase">Source Cluster</span>
                    <span className="font-bold text-primary truncate block">{src?.name || 'Group A'}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-base-content/40 mx-2" />
                  <div className="text-center flex-1">
                    <span className="text-[10px] text-base-content/50 block font-bold uppercase">Failover Target</span>
                    <span className="font-bold text-secondary truncate block">{tgt?.name || 'Group B'}</span>
                  </div>
                </div>

                <p className="text-[11px] text-base-content/50 mt-1">
                  When source cluster modems are 100% busy, pending calls automatically reroute across this bridge.
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Create Merged Group */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Merge Devices Into Cluster</h3>
            <p className="text-xs text-base-content/60 mb-4">Combine multiple SIM800L modems for auto load-balancing</p>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Group Name</label>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. North Sector Voice Cluster" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Cluster Description</label>
                <input 
                  type="text" 
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  placeholder="e.g. High priority emergency lines" 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Dispatch Strategy</label>
                <select 
                  value={groupStrategy} 
                  onChange={e => setGroupStrategy(e.target.value as any)}
                  className="select select-bordered select-sm w-full text-xs"
                >
                  <option value="round-robin">Round-Robin (Even Distribution)</option>
                  <option value="failover">Sequential Failover (Node 1 to Node 2)</option>
                  <option value="lowest-latency">Lowest-Latency (Strongest Signal RSSI)</option>
                  <option value="broadcast">Broadcast (Simultaneous ring on all modems)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Select Hardware Nodes</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-base-200 p-2 rounded-xl">
                  {devices.map(d => (
                    <label key={d.mac} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-base-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedMacs.includes(d.mac)} 
                        onChange={() => toggleSelectMac(d.mac)}
                        className="checkbox checkbox-xs checkbox-primary" 
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
                  onClick={() => setIsGroupModalOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={selectedMacs.length === 0}
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Merge ({selectedMacs.length}) Devices
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Bridge */}
      {isBridgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200">
            <h3 className="font-bold text-lg text-base-content mb-1">Create Inter-Cluster Bridge</h3>
            <p className="text-xs text-base-content/60 mb-4">Connect two device groups for mutual load-sharing and fallback</p>

            <form onSubmit={handleCreateBridge} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Bridge Name</label>
                <input 
                  type="text" 
                  value={bridgeName}
                  onChange={e => setBridgeName(e.target.value)}
                  placeholder="e.g. Primary to Backup Overflow" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-base-content/70 block mb-1">Source Cluster</label>
                  <select 
                    value={sourceGroup} 
                    onChange={e => setSourceGroup(e.target.value)}
                    className="select select-bordered select-sm w-full text-xs"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-base-content/70 block mb-1">Target Cluster</label>
                  <select 
                    value={targetGroup} 
                    onChange={e => setTargetGroup(e.target.value)}
                    className="select select-bordered select-sm w-full text-xs"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Bridge Mode</label>
                <select 
                  value={bridgeMode} 
                  onChange={e => setBridgeMode(e.target.value as any)}
                  className="select select-bordered select-sm w-full text-xs"
                >
                  <option value="overflow">Overflow (Route to target only when source is 100% busy)</option>
                  <option value="mirror">Mirror (Replicate voice alerts across both clusters)</option>
                  <option value="bi-directional">Bi-Directional (Shared peer pool)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsBridgeModalOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Activate Bridge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Group */}
      {editGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Edit Device Cluster Group</h3>
            <p className="text-xs text-base-content/60 mb-4">Modify load-balancing and bound hardware modems</p>

            <form onSubmit={handleSaveEditGroup} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Group Name</label>
                <input 
                  type="text" 
                  value={editGroup.name}
                  onChange={e => setEditGroup({ ...editGroup, name: e.target.value })}
                  required 
                  className="input input-bordered input-sm w-full text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Description</label>
                <input 
                  type="text" 
                  value={editGroup.description || ''}
                  onChange={e => setEditGroup({ ...editGroup, description: e.target.value })}
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Call Dispatch Strategy</label>
                <select 
                  value={editGroup.strategy}
                  onChange={e => setEditGroup({ ...editGroup, strategy: e.target.value as any })}
                  className="select select-bordered select-sm w-full text-xs"
                >
                  <option value="round-robin">Round Robin (Distribute evenly across modems)</option>
                  <option value="least-busy">Least Busy (Favor modems with fewer active calls)</option>
                  <option value="priority-order">Priority Sequential Order</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Cluster Modems ({editGroup.deviceMacs.length})</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-base-200 p-2 rounded-xl">
                  {devices.map(d => (
                    <label key={d.mac} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-base-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editGroup.deviceMacs.includes(d.mac)} 
                        onChange={() => toggleEditGroupMac(d.mac)}
                        className="checkbox checkbox-xs checkbox-primary" 
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
                  onClick={() => setEditGroup(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Group Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
