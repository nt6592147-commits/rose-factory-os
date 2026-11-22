import { Volume2, X } from 'lucide-react';
import type {
  DefaultInputMode,
  OrbQuality,
  RoseSettingsConfig,
  RoseVoiceId,
} from '../../types/rose.ts';
import { VOICE_PRESETS } from '../../utils/roseAudioMath.ts';

interface RoseSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: RoseSettingsConfig;
  onUpdateSettings: (patch: Partial<RoseSettingsConfig>) => void;
  onTestVoice: () => void;
  isTestingVoice: boolean;
  onClearHistory: () => void;
}

export function RoseSettings({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onTestVoice,
  isTestingVoice,
  onClearHistory,
}: RoseSettingsProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rose-settings-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-[#090F1E] border border-slate-800 shadow-2xl rose-scroll">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 sticky top-0 bg-[#090F1E] z-10">
          <div>
            <h2 id="rose-settings-title" className="text-base font-semibold text-white">
              ROSE Assistant Settings
            </h2>
            <p className="text-xs text-slate-400">
              Voice persona, holographic orb rendering, and memory preferences
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Voice Configuration */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="rose-voice-select" className="text-sm font-medium text-slate-200">
                Voice Persona
              </label>
              <button
                type="button"
                onClick={onTestVoice}
                disabled={isTestingVoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isTestingVoice ? 'Speaking...' : 'Test Voice'}</span>
              </button>
            </div>
            <select
              id="rose-voice-select"
              value={settings.voiceId}
              onChange={(e) => onUpdateSettings({ voiceId: e.target.value as RoseVoiceId })}
              className="w-full rounded-xl bg-[#050812] border border-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-500/70 focus:outline-none"
            >
              {VOICE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              {VOICE_PRESETS.find((p) => p.id === settings.voiceId)?.character}
            </p>
          </section>

          {/* Voice Speed & Assistant Volume */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="rose-speed-range" className="text-slate-300 font-medium">
                  Voice Speed
                </label>
                <span className="font-mono text-cyan-300">{settings.voiceSpeed.toFixed(2)}x</span>
              </div>
              <input
                id="rose-speed-range"
                type="range"
                min={0.85}
                max={1.15}
                step={0.05}
                value={settings.voiceSpeed}
                onChange={(e) => onUpdateSettings({ voiceSpeed: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="rose-volume-range" className="text-slate-300 font-medium">
                  Assistant Volume
                </label>
                <span className="font-mono text-cyan-300">
                  {Math.round(settings.assistantVolume * 100)}%
                </span>
              </div>
              <input
                id="rose-volume-range"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.assistantVolume}
                onChange={(e) => onUpdateSettings({ assistantVolume: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </section>

          {/* Orb Visual Effects & Animation Intensity */}
          <section className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="space-y-2">
              <label htmlFor="rose-orb-quality" className="text-sm font-medium text-slate-200 block">
                Orb Visual Quality
              </label>
              <select
                id="rose-orb-quality"
                value={settings.orbQuality}
                onChange={(e) => onUpdateSettings({ orbQuality: e.target.value as OrbQuality })}
                className="w-full rounded-xl bg-[#050812] border border-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-500/70 focus:outline-none"
              >
                <option value="high">High 3D — Full Volumetric Core & 180 Particles</option>
                <option value="balanced">Balanced 3D — Optimized Laptop & Mobile</option>
                <option value="lightweight">2D Lightweight Fallback</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="rose-anim-intensity" className="text-slate-300 font-medium">
                  Animation Intensity
                </label>
                <span className="font-mono text-cyan-300">
                  {Math.round(settings.animationIntensity * 100)}%
                </span>
              </div>
              <input
                id="rose-anim-intensity"
                type="range"
                min={0.4}
                max={1.4}
                step={0.1}
                value={settings.animationIntensity}
                onChange={(e) => onUpdateSettings({ animationIntensity: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </section>

          {/* Mode & Behavioral Toggles */}
          <section className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-200">Default Interaction Mode</div>
                <div className="text-xs text-slate-400">Preferred primary control emphasis</div>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#050812] border border-slate-800">
                {(['voice', 'text'] as DefaultInputMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateSettings({ defaultInputMode: mode })}
                    className={`px-3 py-1 rounded-md text-xs font-medium capitalize cursor-pointer transition-colors ${
                      settings.defaultInputMode === mode
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <SettingToggle
              label="Proactive Factory Observations"
              description="Allow ROSE to surface real anomalies from Factory Memory OS."
              checked={settings.proactiveNotifications}
              onChange={(checked) => onUpdateSettings({ proactiveNotifications: checked })}
            />

            <SettingToggle
              label="Auto-Speak Text Replies"
              description="Speak typed replies aloud using ROSE's Gemini voice."
              checked={settings.autoSpeakTextReplies}
              onChange={(checked) => onUpdateSettings({ autoSpeakTextReplies: checked })}
            />

            <SettingToggle
              label="Active Conversation Memory"
              description="Retain conversational context and summaries for the current workspace."
              checked={settings.saveConversationMemory}
              onChange={(checked) => onUpdateSettings({ saveConversationMemory: checked })}
            />
          </section>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClearHistory}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-950/80 hover:text-red-200 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Clear Conversation History
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-400">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-cyan-400 rounded cursor-pointer shrink-0"
      />
    </label>
  );
}
