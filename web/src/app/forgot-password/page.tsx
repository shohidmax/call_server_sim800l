'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Cpu, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await forgotPassword(email);
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-200">
        <div className="card-body p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-primary-content shadow-lg shadow-primary/30 mb-3">
              <Cpu className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-base-content">Reset Password</h2>
            <p className="text-xs text-base-content/60 mt-1">We will send a recovery token to your registered email</p>
          </div>

          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-base-content">Recovery Link Sent!</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                If an account exists for <span className="font-semibold text-base-content">{email}</span>, you will receive password reset instructions shortly.
              </p>
              <div className="pt-2">
                <Link href="/login" className="btn btn-outline btn-sm w-full gap-2">
                  <ArrowLeft className="w-4 h-4" /> Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label py-1">
                  <span className="label-text text-xs font-bold text-base-content/70">Account Email</span>
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

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-primary btn-sm w-full font-bold shadow-md shadow-primary/20"
                >
                  {loading ? 'Sending Instructions...' : 'Send Recovery Link'}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-base-content/60 hover:text-primary font-semibold flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

