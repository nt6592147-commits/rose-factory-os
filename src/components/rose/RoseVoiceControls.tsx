import { Mic, MicOff, PhoneOff, Send, Square } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { OrbState } from '../../types/rose.ts';

interface RoseVoiceControlsProps {
  orbState: OrbState;
  isVoiceActive: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isSendingText: boolean;
  onToggleVoiceSession: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onSendText: (text: string) => void;
}

export function RoseVoiceControls({
  orbState,
  isVoiceActive,
  isConnecting,
  isMuted,
  isSendingText,
  onToggleVoiceSession,
  onToggleMute,
  onInterrupt,
  onSendText,
}: RoseVoiceControlsProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSendingText) return;
    onSendText(trimmed);
    setDraft('');
  };

  const canInterrupt = orbState === 'SPEAKING';

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-2">
      <div className="rounded-2xl bg-[#090F1E]/95 border border-slate-800/90 p-2.5 shadow-2xl shadow-black/60">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Primary Voice Session Button */}
          {!isVoiceActive ? (
            <button
              type="button"
              onClick={onToggleVoiceSession}
              disabled={isConnecting}
              aria-label="Start voice session with ROSE"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-medium text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px]"
            >
              <Mic className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Start Voice'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={isMuted}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
                  isMuted
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-rose-500/20 text-rose-200 border border-rose-400/40 hover:bg-rose-500/30'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              {canInterrupt && (
                <button
                  type="button"
                  onClick={onInterrupt}
                  aria-label="Interrupt ROSE speech"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px]"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleVoiceSession}
                aria-label="End voice session"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-red-950/80 hover:text-red-200 border border-slate-700/80 text-slate-300 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px]"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End</span>
              </button>
            </div>
          )}

          {/* Text Input Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 min-w-[200px]">
            <label htmlFor="rose-text-input" className="sr-only">
              Message ROSE
            </label>
            <input
              id="rose-text-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                isVoiceActive
                  ? 'Type a note or ask ROSE directly...'
                  : 'Ask ROSE about production, machines, or anything on your mind...'
              }
              disabled={isSendingText}
              className="flex-1 bg-[#050812] border border-slate-800 focus:border-cyan-500/70 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 min-h-[42px]"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSendingText}
              aria-label="Send message to ROSE"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px]"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{isSendingText ? 'Thinking' : 'Send'}</span>
            </button>
          </form>
        </div>

        {/* Clear Privacy / Mic Active Indicator */}
        {isVoiceActive && (
          <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-slate-400">
            <span>
              {isMuted
                ? 'Microphone is muted — audio capture paused'
                : 'Microphone active — speak anytime to interrupt or converse'}
            </span>
            <span className="font-mono text-cyan-400">Gemini Live</span>
          </div>
        )}
      </div>
    </div>
  );
}
