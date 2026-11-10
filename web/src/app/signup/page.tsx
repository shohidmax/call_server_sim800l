'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Cpu, Lock, Mail, User as UserIcon, ArrowRight, Shield } from 'lucide-react';
import { UserRole } from '@/types/user';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('manager');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const ok = await signup(name, email, password, role);
      if (ok) {
        router.push('/');
      } else {
        setError('Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-200">
        <div className="card-body p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-primary-content shadow-lg shadow-primary/30 mb-3">
              <Cpu className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-base-content">Create Account</h2>
            <p className="text-xs text-base-content/60 mt-1">Join the SIM800L ESP32 Voice & SMS Operations Cloud</p>
          </div>

          {error && (
            <div className="alert alert-error text-xs py-2 mb-4 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-bold text-base-content/70">Full Name</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Sarwar Jahan"
                  className="input input-bordered input-sm w-full pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-bold text-base-content/70">Email Address</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="input input-bordered input-sm w-full pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-bold text-base-content/70">Requested Role</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <Shield className="w-4 h-4" />
                </span>
                <select 
                  value={role} 
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="select select-bordered select-sm w-full pl-9 text-xs font-semibold"
                >
                  <option value="manager">Manager (Fleet control & calling)</option>
                  <option value="moderator">Moderator (Voice calls & SMS handling)</option>
                  <option value="viewer">Viewer (Read-only status monitoring)</option>
                  <option value="admin">Administrator (Full root privileges)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-bold text-base-content/70">Password</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  className="input input-bordered input-sm w-full pl-9 text-xs"
                />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary btn-sm w-full gap-2 font-bold shadow-md shadow-primary/20"
              >
                {loading ? 'Creating...' : 'Register Account'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="text-center mt-6 text-xs text-base-content/60">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

