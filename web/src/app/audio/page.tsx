'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { AudioTrack } from '@/types/call';
import { 
  Music, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Upload, 
  Folder, 
  FileAudio, 
  CheckCircle2, 
  Search,
  Radio,
  Sliders,
  X
} from 'lucide-react';

export default function AudioManagementPage() {
  const { hasPermission } = useAuth();
  const { audioTracks, uploadAudioTrack, updateAudioTrack, deleteAudioTrack } = useData();

  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Upload Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [trackNumber, setTrackNumber] = useState('0004');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<AudioTrack['category']>('alarm');

  // Edit Modal State
  const [editTrack, setEditTrack] = useState<AudioTrack | null>(null);

  const filtered = audioTracks.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    t.trackNumber.includes(search) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const handlePlayToggle = (id: string) => {
    setPlayingId(prev => prev === id ? null : id);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !trackNumber) return;

    uploadAudioTrack({
      trackNumber: trackNumber.padStart(4, '0'),
      title,
      description: desc || 'Custom synthesized audio prompt',
      fileSize: '1.4 MB',
      duration: '00:32',
      category
    });

    setIsUploadOpen(false);
    setTitle('');
    setDesc('');
  };

  const handleSaveEditTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTrack) return;

    updateAudioTrack(editTrack.id, {
      title: editTrack.title,
      description: editTrack.description,
      category: editTrack.category
    });

    setEditTrack(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
            <Music className="w-6 h-6 text-primary" /> Audio Library & DFPlayer Mini Sync
          </h1>
          <p className="text-xs text-base-content/60 mt-0.5">
            Manage voice prompt audio files stored on the ESP32 DFPlayer Mini MicroSD card (`/mp3/0001.mp3`)
          </p>
        </div>

        {hasPermission('manager') && (
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="btn btn-sm btn-primary gap-2 font-bold shadow-sm"
          >
            <Upload className="w-4 h-4" /> Upload / Register Track
          </button>
        )}
      </div>

      {/* SD Card Info Banner */}
      <div className="card bg-gradient-to-r from-base-100 to-base-200/50 border border-base-200 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-base-content">SD Card Hardware Path: <span className="font-mono text-primary">/mp3/XXXX.mp3</span></h4>
            <p className="text-[11px] text-base-content/60">FAT32 formatted. Tracks must follow 4-digit prefix formatting for DFPlayer serial driver recognition.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="badge badge-success badge-sm font-bold text-white">FAT32 OK</span>
          <span className="text-base-content/60">{audioTracks.length} Active Tracks</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
          <Search className="w-4 h-4" />
        </span>
        <input 
          type="text" 
          placeholder="Search audio prompts by track number, title, or category..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input input-bordered input-sm w-full pl-9 text-xs"
        />
      </div>

      {/* Audio Tracks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(track => {
          const isPlaying = playingId === track.id;

          return (
            <div key={track.id} className="card bg-base-100 border border-base-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="badge badge-primary badge-sm font-mono font-bold text-xs">
                    Track #{track.trackNumber}
                  </span>
                  <span className="badge badge-outline badge-xs uppercase font-bold text-[9px]">
                    {track.category}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-base-content leading-snug mb-1">
                  {track.title}
                </h3>
                <p className="text-xs text-base-content/60 line-clamp-2 mb-3">
                  {track.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-base-content/50 font-mono bg-base-200/40 p-2.5 rounded-xl mb-3">
                  <span>Duration: <strong className="text-base-content">{track.duration}</strong></span>
                  <span>Size: {track.fileSize}</span>
                </div>
              </div>

              {/* Player control button */}
              <div className="pt-2 border-t border-base-200 flex items-center justify-between">
                <button 
                  onClick={() => handlePlayToggle(track.id)}
                  className={`btn btn-xs gap-1.5 font-bold ${isPlaying ? 'btn-error text-white' : 'btn-outline btn-primary'}`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Stop Preview
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Play Voice Prompt
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-base-content/40">
                    {new Date(track.uploadedAt).toLocaleDateString()}
                  </span>

                  {hasPermission('admin') && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button 
                        onClick={() => setEditTrack(track)}
                        className="btn btn-ghost btn-xs text-info p-1 h-auto min-h-0 hover:bg-info/10"
                        title="Edit Track Metadata"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete audio track "${track.title}"?`)) {
                            deleteAudioTrack(track.id);
                          }
                        }}
                        className="btn btn-ghost btn-xs text-error p-1 h-auto min-h-0 hover:bg-error/10"
                        title="Delete Track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Upload Audio */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <h3 className="font-bold text-lg text-base-content mb-1">Register New DFPlayer Audio Track</h3>
            <p className="text-xs text-base-content/60 mb-4">Upload or configure voice prompt file for automated broadcasts</p>

            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Track Number (4 digits)</label>
                <input 
                  type="text" 
                  value={trackNumber}
                  onChange={e => setTrackNumber(e.target.value)}
                  placeholder="0004" 
                  required 
                  maxLength={4}
                  className="input input-bordered input-sm w-full font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Track Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Flood Sensor Warning Voice Prompt" 
                  required 
                  className="input input-bordered input-sm w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value as any)}
                  className="select select-bordered select-sm w-full text-xs font-semibold"
                >
                  <option value="alarm">Alarm / Intrusion</option>
                  <option value="emergency">Emergency / SOS</option>
                  <option value="notification">Notification / Advisory</option>
                  <option value="marketing">Announcement</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-base-content/70 block mb-1">Description</label>
                <textarea 
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Description of prompt contents..." 
                  rows={2}
                  className="textarea textarea-bordered w-full text-xs"
                />
              </div>

              <div className="border border-dashed border-base-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary">
                <FileAudio className="w-6 h-6 text-primary mx-auto mb-1" />
                <span className="text-xs font-semibold text-base-content block">Drop .mp3 or .wav audio file here</span>
                <span className="text-[10px] text-base-content/50">Mono / Stereo, 44.1 kHz, Max 10MB</span>
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsUploadOpen(false)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Register Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Edit Audio Track */}
      {editTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-base-200">
              <div>
                <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-info" /> Admin: Edit Audio Track
                </h3>
                <p className="text-[11px] font-mono text-primary font-bold">Track [{editTrack.trackNumber}]</p>
              </div>
              <button 
                onClick={() => setEditTrack(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTrack} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Track Title</label>
                <input 
                  type="text" 
                  value={editTrack.title}
                  onChange={e => setEditTrack({ ...editTrack, title: e.target.value })}
                  required
                  className="input input-bordered input-sm w-full text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Category</label>
                <select 
                  value={editTrack.category}
                  onChange={e => setEditTrack({ ...editTrack, category: e.target.value as any })}
                  className="select select-bordered select-sm w-full text-xs"
                >
                  <option value="alarm">Alarm & Emergency</option>
                  <option value="marketing">Marketing & Promotional</option>
                  <option value="notification">Informational Notice</option>
                  <option value="emergency">Critical Alert</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-base-content/70 block mb-1">Description</label>
                <textarea 
                  value={editTrack.description}
                  onChange={e => setEditTrack({ ...editTrack, description: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditTrack(null)}
                  className="btn btn-sm btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary flex-1 font-bold text-xs"
                >
                  Save Track Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

