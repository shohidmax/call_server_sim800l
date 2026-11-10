'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { Phone, X, Music, Radio, Server } from 'lucide-react';

export default function QuickDialModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { devices, audioTracks, triggerCall } = useData();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedMac, setSelectedMac] = useState(devices[0]?.mac || '');
  const [selectedAudio, setSelectedAudio] = useState('0001');
  const [isCalling, setIsCalling] = useState(false);
  const [callMessage, setCallMessage] = useState('');

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    setPhoneNumber(prev => prev + val);
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleDial = async () => {
    if (!phoneNumber) return;
    setIsCalling(true);
    setCallMessage('Sending dial command to ESP32 node...');
    try {
      await triggerCall(selectedMac, phoneNumber, selectedAudio);
      setCallMessage(`Calling ${phoneNumber} via ${selectedMac} with Audio [${selectedAudio}]...`);
      setTimeout(() => {
        setIsCalling(false);
        onClose();
        setPhoneNumber('');
        setCallMessage('');
      }, 1500);
    } catch (e) {
      setCallMessage('Failed to trigger call');
      setIsCalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-base-100 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-base-200 relative">
        <button 
          onClick={onClose} 
          className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-base-content/60"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-base-content">Quick Voice Dial</h3>
            <p className="text-xs text-base-content/60">Direct hardware call trigger</p>
          </div>
        </div>

        {/* Device selector */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">Target GSM Gateway</label>
            <select 
              value={selectedMac} 
              onChange={e => setSelectedMac(e.target.value)}
              className="select select-bordered select-sm w-full text-xs font-mono"
            >
              {devices.map(d => (
                <option key={d.mac} value={d.mac}>
                  {d.name} ({d.mac}) - {d.sim_operator}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">DFPlayer Audio Prompt</label>
            <select 
              value={selectedAudio} 
              onChange={e => setSelectedAudio(e.target.value)}
              className="select select-bordered select-sm w-full text-xs"
            >
              <option value="">No Audio (Standard Voice Call)</option>
              {audioTracks.map(t => (
                <option key={t.id} value={t.trackNumber}>
                  [{t.trackNumber}] {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Phone Display Input */}
        <div className="mb-4">
          <input 
            type="text" 
            value={phoneNumber} 
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+8801700000000"
            className="input input-bordered w-full text-center text-xl font-mono font-bold tracking-wider"
          />
        </div>

        {/* Interactive Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
            <button 
              key={key} 
              onClick={() => handleKeypadPress(key)}
              className="btn btn-outline btn-neutral btn-sm h-10 text-base font-bold rounded-xl hover:scale-105 transition-transform"
            >
              {key}
            </button>
          ))}
        </div>

        {callMessage && (
          <div className="alert alert-info py-2 px-3 text-xs mb-3 font-medium text-center">
            {callMessage}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={handleBackspace} 
            className="btn btn-ghost btn-sm flex-1 text-xs"
          >
            Clear
          </button>
          <button 
            type="button" 
            onClick={handleDial}
            disabled={!phoneNumber || isCalling} 
            className="btn btn-success btn-sm flex-2 text-white font-bold gap-2"
          >
            <Phone className="w-4 h-4" />
            {isCalling ? 'Dialing...' : 'Dial Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
