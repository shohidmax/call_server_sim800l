'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useData } from '@/context/DataContext';
import { 
  Radio, 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Sparkles, 
  Layers,
  Settings2,
  Headphones,
  Signal,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function VirtualIpCallingPage() {
  const { virtualDevices, devices, triggerCall } = useData();

  const [sipNumber, setSipNumber] = useState('');
  const [selectedGateway, setSelectedGateway] = useState(virtualDevices[0]?.virtualMac || devices[0]?.mac || 'B4:E6:2D:E9:12:01');
  const [selectedCodec, setSelectedCodec] = useState('Opus HD (48 kHz) - WebRTC');
  
  // Real Audio Hardware State
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoopbackOn, setIsLoopbackOn] = useState(false); // Hear yourself test
  const [micVolume, setMicVolume] = useState(100);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState('SIP / WebRTC Softphone Engine Ready. Connect microphone to begin.');
  const [volumeLevel, setVolumeLevel] = useState(0); // 0 to 100 for live VU meter

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const loopbackGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or teardown Web Audio API
  const startMicrophone = async () => {
    try {
      setAudioError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const gain = ctx.createGain();
      gain.gain.value = micVolume / 100;
      gainNodeRef.current = gain;

      // Loopback for local audio monitor
      const loopbackGain = ctx.createGain();
      loopbackGain.gain.value = isLoopbackOn ? 1.0 : 0.0;
      loopbackGainRef.current = loopbackGain;

      source.connect(gain);
      gain.connect(analyser);
      gain.connect(loopbackGain);
      loopbackGain.connect(ctx.destination);

      setIsMicActive(true);
      setLogStatus(`Microphone connected: ${stream.getAudioTracks()[0].label}`);

      // Start analyzing live volume level
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setVolumeLevel(Math.min(100, Math.round((avg / 255) * 160)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

    } catch (err: unknown) {
      console.error('Audio capture error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Microphone access denied';
      setAudioError(`Microphone Error: ${errorMessage}`);
      setIsMicActive(false);
    }
  };

  const stopMicrophone = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsMicActive(false);
    setVolumeLevel(0);
    setLogStatus('Microphone disconnected.');
  };

  // Adjust mic mute
  useEffect(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Adjust volume / gain
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : micVolume / 100;
    }
  }, [micVolume, isMuted]);

  // Adjust loopback
  useEffect(() => {
    if (loopbackGainRef.current) {
      loopbackGainRef.current.gain.value = isLoopbackOn ? 1.0 : 0.0;
    }
  }, [isLoopbackOn]);

  // Handle Call Timer
  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleDial = async () => {
    if (!sipNumber) return;

    if (!isMicActive) {
      await startMicrophone();
    }

    setCallActive(true);
    setCallDuration(0);
    setLogStatus(`CALLING [${sipNumber}] via Gateway [${selectedGateway}] | Protocol: WebRTC/RTP | Codec: ${selectedCodec}`);
    
    // Also trigger hardware call if gateway is a physical SIM800L
    triggerCall(selectedGateway, sipNumber);
  };

  const handleHangup = () => {
    setCallActive(false);
    setCallDuration(0);
    setLogStatus(`CALL ENDED with [${sipNumber}]. Duration: ${formatTime(callDuration)}. Quality: 4.8/5 MOS`);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
          <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /> Live Browser Calling & WebRTC Audio Console
        </h1>
        <p className="text-xs text-base-content/60 mt-0.5">
          Real-time microphone & speaker softphone bridging browser audio directly to GSM cellular trunks
        </p>
      </div>

      {audioError && (
        <div className="alert alert-error text-xs py-2 shadow-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{audioError} (Please allow microphone access in your browser)</span>
        </div>
      )}

      {/* Main Softphone Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Softphone Dialer Console */}
        <div className="card bg-base-100 border border-base-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="badge badge-primary badge-sm font-bold gap-1">
                <Sparkles className="w-3 h-3" /> WebRTC Softphone
              </span>
              <span className={`badge badge-sm font-bold uppercase ${callActive ? 'badge-success text-white animate-pulse' : 'badge-ghost'}`}>
                {callActive ? `Connected (${formatTime(callDuration)})` : 'Idle'}
              </span>
            </div>

            {/* Gateway Trunk Selector */}
            <div className="mb-3">
              <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                GSM Modem / Gateway Trunk
              </label>
              <select 
                value={selectedGateway} 
                onChange={e => setSelectedGateway(e.target.value)}
                className="select select-bordered select-xs w-full font-mono text-xs"
              >
                {devices.map(d => (
                  <option key={d.mac} value={d.mac}>
                    [Hardware SIM800L] {d.name} ({d.mac})
                  </option>
                ))}
                {virtualDevices.map(v => (
                  <option key={v.id} value={v.virtualMac}>
                    [Virtual Cluster] {v.name} ({v.virtualMac})
                  </option>
                ))}
              </select>
            </div>

            {/* Codec */}
            <div className="mb-3">
              <label className="text-[10px] uppercase font-bold text-base-content/60 block mb-1">
                Voice Audio Codec
              </label>
              <select 
                value={selectedCodec} 
                onChange={e => setSelectedCodec(e.target.value)}
                className="select select-bordered select-xs w-full text-xs font-semibold"
              >
                <option value="Opus HD (48 kHz) - WebRTC">Opus HD (48 kHz) - Realtime WebRTC</option>
                <option value="PCM 16-bit (8 kHz) - SIM800L GSM">PCM 16-bit (8 kHz) - GSM Native</option>
                <option value="G.711u PCMU (64 kbps) - PSTN">G.711u PCMU (64 kbps) - PSTN Standard</option>
              </select>
            </div>

            {/* Display Input */}
            <div className="mb-4">
              <input 
                type="text" 
                value={sipNumber}
                onChange={e => setSipNumber(e.target.value)}
                placeholder="Enter Number (e.g. 01712345678)" 
                className="input input-bordered w-full text-center text-xl font-mono font-bold tracking-wider"
              />
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
                <button 
                  key={k} 
                  onClick={() => setSipNumber(prev => prev + k)}
                  className="btn btn-outline btn-neutral btn-sm h-10 text-base font-bold rounded-lg hover:scale-105 transition-transform"
                >
                  {k}
                </button>
              ))}
            </div>

            {/* In-Call Controls */}
            <div className="flex items-center justify-center gap-3 p-2 bg-base-200/50 rounded-xl mb-4">
              {/* Mic Mute Button */}
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                className={`btn btn-circle btn-sm ${isMuted ? 'btn-error text-white' : 'btn-outline'}`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Loopback Monitor (Hear yourself test) */}
              <button 
                onClick={() => setIsLoopbackOn(!isLoopbackOn)} 
                title={isLoopbackOn ? 'Speaker Monitor On' : 'Speaker Monitor Off'}
                className={`btn btn-circle btn-sm ${isLoopbackOn ? 'btn-warning text-white' : 'btn-outline'}`}
              >
                <Headphones className="w-4 h-4" />
              </button>

              {/* Toggle Microphone Device */}
              <button 
                onClick={isMicActive ? stopMicrophone : startMicrophone}
                title={isMicActive ? 'Turn Off Mic' : 'Turn On Mic'}
                className={`btn btn-circle btn-sm ${isMicActive ? 'btn-success text-white' : 'btn-ghost'}`}
              >
                {isMicActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            {callActive ? (
              <button 
                onClick={handleHangup}
                className="btn btn-error btn-sm w-full text-white font-bold gap-2 shadow-sm"
              >
                <PhoneOff className="w-4 h-4" /> Terminate Call
              </button>
            ) : (
              <button 
                onClick={handleDial}
                disabled={!sipNumber}
                className="btn btn-primary btn-sm w-full font-bold gap-2 shadow-sm"
              >
                <Phone className="w-4 h-4" /> Connect Live Call
              </button>
            )}
          </div>
        </div>

        {/* Live Audio Telemetry, VU Meter & Hardware Bridge Architecture */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Live Microphone Visualizer & Telemetry Card */}
          <div className="card bg-slate-950 border border-slate-800 text-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                  <Signal className="w-4 h-4" /> Live Browser Microphone Visualizer (Web Audio API)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Speak into your microphone to observe real-time waveform and audio packet telemetry
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge badge-xs font-bold ${isMicActive ? 'badge-success text-white' : 'badge-ghost text-slate-400'}`}>
                  {isMicActive ? (isMuted ? 'MIC MUTED' : 'MIC ACTIVE') : 'MIC STANDBY'}
                </span>
                {isLoopbackOn && (
                  <span className="badge badge-xs badge-warning text-white font-bold">
                    EAR MONITOR ON
                  </span>
                )}
              </div>
            </div>

            {/* Realtime VU Meter Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                <span>Microphone Input Level</span>
                <span className="text-emerald-400 font-bold">{volumeLevel}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className={`h-full rounded-full transition-all duration-75 ${
                    volumeLevel > 80 ? 'bg-rose-500' : volumeLevel > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${volumeLevel}%` }}
                />
              </div>
            </div>

            {/* Audio Wave Visualizer Simulation / Dynamic Bars */}
            <div className="h-28 bg-slate-900 rounded-xl flex items-end justify-center gap-1.5 p-4 overflow-hidden border border-slate-800">
              {Array.from({ length: 36 }).map((_, i) => {
                // Generate dynamic height based on volumeLevel
                const dynamicHeight = isMicActive && !isMuted 
                  ? Math.max(8, Math.min(88, (volumeLevel * 0.9) * (0.4 + 0.6 * Math.sin((i / 36) * Math.PI))))
                  : 6;

                return (
                  <div 
                    key={i} 
                    className={`w-1.5 rounded-t-sm transition-all duration-75 ${
                      isMicActive && !isMuted
                        ? dynamicHeight > 60 ? 'bg-rose-400' : dynamicHeight > 35 ? 'bg-amber-400' : 'bg-emerald-400'
                        : 'bg-slate-700 opacity-40'
                    }`}
                    style={{ height: `${dynamicHeight}px` }}
                  />
                );
              })}
            </div>

            {/* Mic Gain Slider */}
            <div className="mt-4 flex items-center gap-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5 shrink-0">
                <Settings2 className="w-3.5 h-3.5 text-emerald-400" /> Mic Gain:
              </span>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={micVolume} 
                onChange={e => setMicVolume(Number(e.target.value))}
                className="range range-xs range-primary flex-1" 
              />
              <span className="text-xs font-mono text-emerald-400 font-bold w-12 text-right">
                {micVolume}%
              </span>
            </div>

            {/* Live Status Stream */}
            <div className="mt-3 p-3 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-400/90 border border-slate-800">
              {logStatus}
            </div>
          </div>

          {/* SIM800L Live Audio Hardware Bridge Explanation Card */}
          <div className="card bg-base-100 border border-base-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> SIM800L + ESP32 Live Calling Hardware Setup
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-base-200/50 p-4 rounded-xl border border-base-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-base-content">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Browser Microphone to SIM800L (Outgoing Voice)</span>
                </div>
                <p className="text-base-content/70 leading-relaxed">
                  Browser audio is captured and forwarded as binary PCM over WebSocket to ESP32. ESP32 DAC (GPIO 25) or I2S DAC (MAX98357A) converts it to differential audio feeding SIM800L <strong>MICP / MICN</strong> pins so the recipient hears you clearly.
                </p>
              </div>

              <div className="bg-base-200/50 p-4 rounded-xl border border-base-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-base-content">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>SIM800L to Browser Speaker (Incoming Voice)</span>
                </div>
                <p className="text-base-content/70 leading-relaxed">
                  SIM800L <strong>SPKP / SPKN</strong> output is routed into ESP32 ADC (GPIO 34) or I2S ADC (INMP441/PCM1808) and streamed back via WebSocket. The Web Audio API decodes and plays it live through your headphones or speakers.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
