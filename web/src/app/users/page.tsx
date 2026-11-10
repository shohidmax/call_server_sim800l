'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { User, UserRole } from '@/types/user';
import ClickToCopy from '@/components/ClickToCopy';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  Trash2, 
  Edit3,
  Search, 
  Mail, 
  Cpu,
  Share2
} from 'lucide-react';

const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_01',
    name: 'Sarwar Jahan',
    email: 'admin@sim800l.local',
    role: 'admin',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC', '30:AE:A4:11:22:33'],
    createdAt: '2026-01-10T08:00:00Z',
    lastLogin: '2026-11-08T06:45:00Z'
  },
  {
    id: 'usr_mgr_02',
    name: 'Tariqul Islam',
    email: 'manager@sim800l.local',
    role: 'manager',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC', '24:0A:C4:AA:BB:CC'],
    createdAt: '2026-02-15T09:30:00Z',
    lastLogin: '2026-11-07T18:20:00Z'
  },
  {
    id: 'usr_mod_03',
    name: 'Amina Khatun',
    email: 'moderator@sim800l.local',
    role: 'moderator',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC'],
    createdAt: '2026-03-01T11:00:00Z',
    lastLogin: '2026-11-06T12:00:00Z'
  },
  {
    id: 'usr_view_04',
    name: 'Rafiqul Alam',
    email: 'viewer@sim800l.local',
    role: 'viewer',
    status: 'active',
    assignedDevices: ['44:1D:64:BD:22:EC'],
    createdAt: '2026-04-05T14:20:00Z',
    lastLogin: '2026-11-01T09:10:00Z'
  }
];

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const { devices } = useData();
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');

  // Add User Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('moderator');
  const [newAssigned, setNewAssigned] = useState<string[]>([]);

  // Edit User Modal
  const [editUser, setEditUser] = useState<User | null>(null);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    const newUser: User = {
      id: 'usr_' + Date.now(),
      name: newName,
      email: newEmail,
      role: newRole,
      status: 'active',
      assignedDevices: newAssigned,
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [newUser, ...prev]);
    setIsAddOpen(false);
    setNewName('');
    setNewEmail('');
    setNewAssigned([]);
  };

  const handleUpdateRole = (id: string, role: UserRole) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  };

  const handleToggleStatus = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u));
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setUsers(prev => prev.map(u => u.id === editUser.id ? editUser : u));
    setEditUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> User Management & Device Sharing
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Manage administrative personnel, roles (Admin, Manager, Moderator, Viewer), and delegated hardware access
          </p>
        </div>

        {hasPermission('admin') && (
          <button 
            onClick={() => setIsAddOpen(true)}
            className="btn btn-sm btn-primary gap-2 font-bold shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        )}
      </div>

      {/* Role Summary Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-base-100 p-3.5 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Super Admins</span>
          <span className="text-xl font-bold text-primary">
            {users.filter(u => u.role === 'admin').length}
          </span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Root hardware & user control</p>
        </div>
        <div className="bg-base-100 p-3.5 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Managers</span>
          <span className="text-xl font-bold text-secondary">
            {users.filter(u => u.role === 'manager').length}
          </span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Cluster operations & dialer</p>
        </div>
        <div className="bg-base-100 p-3.5 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Moderators</span>
          <span className="text-xl font-bold text-accent">
            {users.filter(u => u.role === 'moderator').length}
          </span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Call execution & SMS replies</p>
        </div>
        <div className="bg-base-100 p-3.5 rounded-xl border border-base-200">
          <span className="text-[10px] uppercase font-bold text-base-content/50 block">Viewers</span>
          <span className="text-xl font-bold text-neutral">
            {users.filter(u => u.role === 'viewer').length}
          </span>
          <p className="text-[10px] text-base-content/50 mt-0.5">Audit & telemetry viewer</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
          <Search className="w-4 h-4" />
        </span>
        <input 
          type="text" 
          placeholder="Filter users by name, email, or role..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input input-bordered input-sm w-full pl-9 text-xs"
        />
      </div>

      {/* Users Table */}
      <div className="card bg-base-100 border border-base-200 shadow-xs overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="border-b border-base-200 text-[11px] uppercase tracking-wider text-base-content/60">
              <th>User</th>
              <th>Assigned Role</th>
              <th>Status</th>
              <th>Assigned Modems</th>
              <th>Registered</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 text-xs">
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-base-200/40">
                <td>
                  <div className="font-bold text-base-content">{u.name}</div>
                  <ClickToCopy text={u.email} className="text-[11px] text-base-content/60" title="Click to copy email address" />
                </td>
                <td>
                  <select 
                    value={u.role}
                    onChange={e => handleUpdateRole(u.id, e.target.value as UserRole)}
                    disabled={!hasPermission('admin')}
                    className="select select-bordered select-xs font-bold uppercase text-[10px]"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="moderator">Moderator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td>
                  <span className={`badge badge-xs font-semibold uppercase text-[9px] py-1 px-2 ${
                    u.status === 'active' ? 'badge-success text-white' : 'badge-error text-white'
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.assignedDevices.map(mac => (
                      <ClickToCopy 
                        key={mac} 
                        text={mac} 
                        className="badge badge-outline badge-xs text-[9px]" 
                        title="Click to copy MAC address" 
                      />
                    ))}
                  </div>
                </td>
                <td className="text-[11px] text-base-content/60">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission('admin') && (
                      <>
                        <button 
                          onClick={() => setEditUser({ ...u })}
                          className="btn btn-xs btn-ghost text-info"
                          title="Edit User Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(u.id)}
                          className="btn btn-xs btn-ghost text-[10px]"
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="btn btn-xs btn-ghost text-error"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Add User */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Add Operator Account</h3>
            <p className="text-xs text-base-content/60 mb-4">Create access credentials and delegate SIM800L hardware</p>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Mahbubur Rahman" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="operator@company.com" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Assigned Role</label>
                <select 
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  <option value="manager">Manager (Fleet control & calling)</option>
                  <option value="moderator">Moderator (Voice calls & SMS handling)</option>
                  <option value="viewer">Viewer (Read-only status monitoring)</option>
                  <option value="admin">Administrator (Full root privileges)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Assign Initial Modems</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-base-200 p-2 rounded-xl">
                  {devices.map(d => (
                    <label key={d.mac} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-base-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newAssigned.includes(d.mac)} 
                        onChange={() => setNewAssigned(prev => prev.includes(d.mac) ? prev.filter(m => m !== d.mac) : [...prev, d.mac])}
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
                  onClick={() => setIsAddOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User (Admin Control) */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Edit User Profile & Permissions</h3>
            <p className="text-xs text-base-content/60 mb-4">Modify account metadata, security role, and assigned modems</p>

            <form onSubmit={handleSaveEditUser} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editUser.name}
                  onChange={e => setEditUser({ ...editUser, name: e.target.value })}
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={editUser.email}
                  onChange={e => setEditUser({ ...editUser, email: e.target.value })}
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-base-content/70 block mb-1">Assigned Role</label>
                  <select 
                    value={editUser.role}
                    onChange={e => setEditUser({ ...editUser, role: e.target.value as UserRole })}
                    className="select select-bordered select-sm w-full text-xs font-semibold"
                  >
                    <option value="admin">Administrator (Root)</option>
                    <option value="manager">Manager</option>
                    <option value="moderator">Moderator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-base-content/70 block mb-1">Account Status</label>
                  <select 
                    value={editUser.status}
                    onChange={e => setEditUser({ ...editUser, status: e.target.value as any })}
                    className="select select-bordered select-sm w-full text-xs font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Delegated Hardware Modems</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-base-200 p-2 rounded-xl">
                  {devices.map(d => (
                    <label key={d.mac} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-base-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editUser.assignedDevices.includes(d.mac)} 
                        onChange={() => setEditUser({
                          ...editUser,
                          assignedDevices: editUser.assignedDevices.includes(d.mac)
                            ? editUser.assignedDevices.filter(m => m !== d.mac)
                            : [...editUser.assignedDevices, d.mac]
                        })}
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
                  onClick={() => setEditUser(null)}
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
    </div>
  );
}

