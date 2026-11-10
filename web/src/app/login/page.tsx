'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Cpu, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { UserRole } from '@/types/user';

export default function LoginPage() {
  const router = useRouter();
  const { login, switchRole } = useAuth();
  const [email, setEmail] = useState('admin@sim800l.local');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const ok = await login(email, password);
      if (ok) {
        router.push('/');
      } else {
        setError('Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoRole = (role: UserRole, demoEmail: string) => {
    switchRole(role);
    setEmail(demoEmail);
    setPassword('password123');
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-200">
        <div className="card-body p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-primary-content shadow-lg shadow-primary/30 mb-3">
              <Cpu className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-base-content">Welcome Back</h2>
            <p className="text-xs text-base-content/60 mt-1">Sign in to control your SIM800L ESP32 Fleet</p>
          </div>

          {/* Quick Demo Logins */}
          <div className="mb-6 bg-base-200/60 p-3 rounded-xl border border-base-200">
            <p className="text-[10px] font-bold uppercase text-base-content/50 mb-2 tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Instant 1-Click Demo Login
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button 
                type="button" 
                onClick={() => selectDemoRole('admin', 'admin@sim800l.local')}
                className="btn btn-xs btn-outline btn-primary text-[10px] font-bold justify-start gap-1"
              >
                👑 Super Admin
              </button>
              <button 
                type="button" 
                onClick={() => selectDemoRole('manager', 'manager@sim800l.local')}
                className="btn btn-xs btn-outline btn-neutral text-[10px] font-bold justify-start gap-1"
              >
                💼 Ops Manager
              </button>
              <button 
                type="button" 
                onClick={() => selectDemoRole('moderator', 'moderator@sim800l.local')}
                className="btn btn-xs btn-outline btn-neutral text-[10px] font-bold justify-start gap-1"
              >
                🎧 Call Moderator
              </button>
              <button 
                type="button" 
                onClick={() => selectDemoRole('viewer', 'viewer@sim800l.local')}
                className="btn btn-xs btn-outline btn-neutral text-[10px] font-bold justify-start gap-1"
              >
                👁️ Audit Viewer
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error text-xs py-2 mb-4 font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="admin@sim800l.local"
                  className="input input-bordered input-sm w-full pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center py-1">
                <label className="label-text text-xs font-bold text-base-content/70">Password</label>
                <Link href="/forgot-password" className="text-[11px] text-primary hover:underline font-semibold">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
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
                {loading ? 'Authenticating...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="text-center mt-6 text-xs text-base-content/60">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary font-bold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

