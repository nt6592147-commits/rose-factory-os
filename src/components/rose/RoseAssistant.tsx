import { PanelRight, Radio, Settings, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoseAudioService } from '../../services/rose/roseAudioService.ts';
import { RoseLiveService } from '../../services/rose/roseLiveService.ts';
import type {
  ConversationMemoryState,
  FactoryOverviewSnapshot,
  OrbState,
  ProactiveInsight,
  RoseSettingsConfig,
  ToolExecutionRecord,
  TranscriptMessage,
  UserProfile,
} from '../../types/rose.ts';
import {
  resolveOrbState,
  shouldTriggerBargeIn,
} from '../../utils/roseAudioMath.ts';
import { RoseConversation } from './RoseConversation.tsx';
import { RoseOrb } from './RoseOrb.tsx';
import { RoseSettings } from './RoseSettings.tsx';
import { RoseVisualizer } from './RoseVisualizer.tsx';
import { RoseVoiceControls } from './RoseVoiceControls.tsx';

const SETTINGS_STORAGE_KEY = 'rose_assistant_preferences_v1';

const DEFAULT_SETTINGS: RoseSettingsConfig = {
  voiceId: 'Kore',
  voiceSpeed: 1.0,
  assistantVolume: 0.9,
  orbQuality: 'high',
  animationIntensity: 1.0,
  proactiveNotifications: true,
  autoSpeakTextReplies: false,
  saveConversationMemory: true,
  defaultInputMode: 'voice',
};

function loadInitialSettings(): RoseSettingsConfig {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<RoseSettingsConfig>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const STATE_DESCRIPTIONS: Record<OrbState, string> = {
  IDLE: 'Standing by for your voice or message',
  LISTENING: 'Listening attentively',
  THINKING: 'Synthesizing Factory Memory OS records',
  SPEAKING: 'Speaking',
  DISCONNECTED: 'Live voice link disconnected — reconnect or use text',
  ERROR: 'Attention needed — check connection or settings',
};

export function RoseAssistant() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const tokenRef = useRef<string>('');

  const [overview, setOverview] = useState<FactoryOverviewSnapshot | null>(null);
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [memory, setMemory] = useState<ConversationMemoryState | null>(null);

  const [settings, setSettings] = useState<RoseSettingsConfig>(loadInitialSettings);
  const settingsRef = useRef<RoseSettingsConfig>(settings);
  useEffect(() => {
    settingsRef.current = settings;
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }, [settings]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [liveStatus, setLiveStatus] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  >('disconnected');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);

  const isSpeakingRef = useRef(false);
  const isMutedRef = useRef(false);
  const loudFramesRef = useRef(0);
  const pendingToolsRef = useRef<ToolExecutionRecord[]>([]);

  const audioServiceRef = useRef<RoseAudioService | null>(null);
  const liveServiceRef = useRef<RoseLiveService | null>(null);

  // Synchronize refs & audio controls
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    audioServiceRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    audioServiceRef.current?.setVolume(settings.assistantVolume);
    audioServiceRef.current?.setPlaybackRate(settings.voiceSpeed);
  }, [settings.assistantVolume, settings.voiceSpeed]);

  // Append or update partial live transcript lines
  const upsertPartialMessage = useCallback(
    (role: 'user' | 'rose', delta: string, source: 'voice' | 'text') => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && last.isPartial) {
          const updated: TranscriptMessage = {
            ...last,
            text: last.text + delta,
            toolCalls:
              role === 'rose' && pendingToolsRef.current.length > 0
                ? [...(last.toolCalls ?? []), ...pendingToolsRef.current]
                : last.toolCalls,
          };
          if (role === 'rose') pendingToolsRef.current = [];
          return [...prev.slice(0, -1), updated];
        }
        const attachedTools = role === 'rose' ? [...pendingToolsRef.current] : undefined;
        if (role === 'rose') pendingToolsRef.current = [];
        return [
          ...prev,
          {
            id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role,
            text: delta,
            timestamp: new Date().toISOString(),
            source,
            isPartial: true,
            toolCalls: attachedTools,
          },
        ];
      });
    },
    []
  );

  const finalizePartialMessages = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.isPartial ? { ...m, isPartial: false } : m))
    );
  }, []);

  // Initialize Audio & Live WebSocket services once
  useEffect(() => {
    const audio = new RoseAudioService({
      onMicAudioChunk: (base64Pcm16k, rms) => {
        setInputLevel(rms);
        const bargeIn = shouldTriggerBargeIn({
          isRoseSpeaking: isSpeakingRef.current,
          isMicMuted: isMutedRef.current,
          inputRms: rms,
          consecutiveLoudFrames: loudFramesRef.current,
        });
        loudFramesRef.current = bargeIn.nextLoudFrames;
        if (bargeIn.interrupt) {
          audio.stopPlayback();
          finalizePartialMessages();
        }
        if (base64Pcm16k) {
          liveServiceRef.current?.sendAudioChunk(base64Pcm16k);
        }
      },
      onOutputLevel: (rms) => {
        setOutputLevel(rms);
      },
      onPlaybackActiveChange: (active) => {
        setIsSpeaking(active);
        if (active) setIsThinking(false);
      },
    });

    const live = new RoseLiveService({
      onStatusChange: (status) => {
        setLiveStatus(status);
        if (status === 'disconnected') {
          setIsThinking(false);
        }
      },
      onAudioChunk: (base64Pcm24k) => {
        setErrorBanner(null);
        audio.enqueuePcm24k(base64Pcm24k).catch(() => {});
      },
      onInterrupted: () => {
        audio.stopPlayback();
        finalizePartialMessages();
      },
      onTurnComplete: () => {
        setIsThinking(false);
        finalizePartialMessages();
      },
      onInputTranscript: (delta) => {
        upsertPartialMessage('user', delta, 'voice');
      },
      onOutputTranscript: (delta) => {
        setIsThinking(false);
        upsertPartialMessage('rose', delta, 'voice');
      },
      onToolCall: (record) => {
        setIsThinking(true);
        pendingToolsRef.current.push({
          ...record,
          timestamp: new Date().toISOString(),
        });
      },
      onMemoryUpdated: (nextMemory) => {
        setMemory(nextMemory);
      },
      onError: (_code, msg) => {
        setErrorBanner(msg);
        setIsThinking(false);
        audio.stopMicrophone();
        audio.stopPlayback();
        setIsVoiceActive(false);
      },
    });

    audioServiceRef.current = audio;
    liveServiceRef.current = live;

    return () => {
      live.disconnect();
      audio.dispose();
      audioServiceRef.current = null;
      liveServiceRef.current = null;
    };
  }, [finalizePartialMessages, upsertPartialMessage]);

  const authenticateUser = useCallback(async (userId: string) => {
    setErrorBanner(null);
    // Disconnect active voice session before switching company/user context
    liveServiceRef.current?.disconnect();
    audioServiceRef.current?.stopMicrophone();
    audioServiceRef.current?.stopPlayback();
    setIsVoiceActive(false);
    setIsThinking(false);
    setMessages([]);
    pendingToolsRef.current = [];

    const sessionRes = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!sessionRes.ok) {
      throw new Error('Unable to establish Factory Memory OS session.');
    }
    const sessionData = (await sessionRes.json()) as {
      token: string;
      user: UserProfile;
    };
    tokenRef.current = sessionData.token;
    setCurrentUser(sessionData.user);

    const overviewRes = await fetch('/api/rose/overview', {
      headers: { Authorization: `Bearer ${sessionData.token}` },
    });
    if (overviewRes.ok) {
      const ovData = (await overviewRes.json()) as {
        overview: FactoryOverviewSnapshot | null;
        insights: ProactiveInsight[];
        memory: ConversationMemoryState;
      };
      setOverview(ovData.overview);
      setInsights(ovData.insights);
      setMemory(ovData.memory);
    }
  }, []);

  // Initial load: fetch profiles & sign in first Plant Director profile
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/profiles');
        if (!res.ok) throw new Error('Failed to load workspace profiles.');
        const data = (await res.json()) as { profiles: UserProfile[] };
        if (!active) return;
        setProfiles(data.profiles);
        const defaultUser = data.profiles[0]?.userId ?? 'usr_elena_aether';
        await authenticateUser(defaultUser);
      } catch (err) {
        if (!active) return;
        setErrorBanner(
          err instanceof Error ? err.message : 'Unable to connect to Factory Memory OS.'
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [authenticateUser]);

  const handleToggleVoiceSession = async () => {
    const audio = audioServiceRef.current;
    const live = liveServiceRef.current;
    if (!audio || !live) return;

    if (isVoiceActive || liveStatus === 'connecting' || liveStatus === 'reconnecting') {
      live.disconnect();
      audio.stopMicrophone();
      audio.stopPlayback();
      setIsVoiceActive(false);
      setIsMuted(false);
      setIsThinking(false);
      setInputLevel(0);
      return;
    }

    if (!tokenRef.current) {
      setErrorBanner('Session not initialized. Please wait or refresh.');
      return;
    }

    setErrorBanner(null);
    try {
      await audio.ensureOutputContext();
      await audio.startMicrophone();
      setIsVoiceActive(true);
      setIsMuted(false);
      live.connect({
        token: tokenRef.current,
        voiceId: settings.voiceId,
        voiceSpeed: settings.voiceSpeed,
        proactiveNotifications: settings.proactiveNotifications,
        saveMemory: settings.saveConversationMemory,
      });
    } catch (err) {
      audio.stopMicrophone();
      setIsVoiceActive(false);
      setErrorBanner(
        err instanceof Error
          ? err.message
          : 'Microphone permission denied. You can continue using text conversation below.'
      );
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleInterrupt = () => {
    audioServiceRef.current?.stopPlayback();
    finalizePartialMessages();
  };

  const handleSendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setErrorBanner(null);

    // If Live voice session is currently connected, route text directly into the live session
    if (isVoiceActive && liveStatus === 'connected') {
      const sent = liveServiceRef.current?.sendTextTurn(trimmed);
      if (sent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            text: trimmed,
            timestamp: new Date().toISOString(),
            source: 'text',
          },
        ]);
        setIsThinking(true);
        return;
      }
    }

    if (!tokenRef.current) {
      setErrorBanner('Session token unavailable.');
      return;
    }

    const userMsg: TranscriptMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
      source: 'text',
    };
    const historySnapshot = [...messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setIsSendingText(true);
    setIsThinking(true);

    try {
      const res = await fetch('/api/rose/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          message: trimmed,
          history: historySnapshot.slice(0, -1),
          saveMemory: settings.saveConversationMemory,
          proactiveNotifications: settings.proactiveNotifications,
          voiceSpeed: settings.voiceSpeed,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        toolCalls?: ToolExecutionRecord[];
        memory?: ConversationMemoryState;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data.message || 'ROSE could not process that request.');
      }

      const replyText = data.reply ?? '';
      setMessages((prev) => [
        ...prev,
        {
          id: `rose-${Date.now()}`,
          role: 'rose',
          text: replyText,
          timestamp: new Date().toISOString(),
          source: 'text',
          toolCalls: data.toolCalls,
        },
      ]);
      if (data.memory) {
        setMemory(data.memory);
      }

      if (settingsRef.current.autoSpeakTextReplies && replyText) {
        void speakTextViaTts(replyText);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error communicating with ROSE.';
      setErrorBanner(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system',
          text: msg,
          timestamp: new Date().toISOString(),
          source: 'text',
        },
      ]);
    } finally {
      setIsSendingText(false);
      setIsThinking(false);
    }
  };

  const speakTextViaTts = async (text: string) => {
    if (!tokenRef.current || !audioServiceRef.current) return;
    try {
      const res = await fetch('/api/rose/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          text: text.slice(0, 1200),
          voiceId: settingsRef.current.voiceId,
        }),
      });
      const data = (await res.json()) as { audioBase64?: string; message?: string };
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.message || 'Voice synthesis failed.');
      }
      await audioServiceRef.current.playWavBase64(data.audioBase64);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to play synthesized voice audio.'
      );
    }
  };

  const handleTestVoice = async () => {
    if (isTestingVoice) return;
    setIsTestingVoice(true);
    setErrorBanner(null);
    try {
      await speakTextViaTts(
        `Hey. I'm Rose. Everything across ${currentUser?.companyName ?? 'your facility'} is calibrated and ready whenever you are.`
      );
    } finally {
      setIsTestingVoice(false);
    }
  };

  const handleClearMemory = async () => {
    setMessages([]);
    if (!tokenRef.current) return;
    const res = await fetch('/api/rose/memory/clear', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { memory: ConversationMemoryState };
      setMemory(data.memory);
    }
  };

  const orbState: OrbState = useMemo(
    () =>
      resolveOrbState({
        hasError: Boolean(errorBanner),
        isConnected: !isVoiceActive || liveStatus === 'connected',
        isVoiceActive,
        isMuted,
        isThinking,
        isSpeaking,
      }),
    [errorBanner, isVoiceActive, liveStatus, isMuted, isThinking, isSpeaking]
  );

  const activeAudioLevel =
    orbState === 'SPEAKING'
      ? outputLevel
      : orbState === 'LISTENING'
        ? inputLevel
        : 0;

  const latestRoseMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'rose') return messages[i].text;
    }
    return null;
  }, [messages]);

  const contextualSubtitle = useMemo(() => {
    if (errorBanner) return errorBanner;
    if (latestRoseMessage) {
      return latestRoseMessage.length > 170
        ? `${latestRoseMessage.slice(0, 167)}...`
        : latestRoseMessage;
    }
    if (settings.proactiveNotifications && insights.length > 0) {
      return `${insights[0].title}: ${insights[0].message}`;
    }
    return STATE_DESCRIPTIONS[orbState];
  }, [errorBanner, latestRoseMessage, settings.proactiveNotifications, insights, orbState]);

  const connectionLabel =
    liveStatus === 'connected'
      ? 'Live Voice Connected'
      : liveStatus === 'connecting' || liveStatus === 'reconnecting'
        ? 'Establishing Voice Link'
        : currentUser
          ? 'Factory Memory OS Ready'
          : 'Initializing';

  return (
    <div
      className="relative flex flex-col w-full h-screen min-h-[600px] bg-[#04060D] text-slate-100 overflow-hidden"
      data-orb-state={orbState}
    >
      {/* Subtle radial studio backdrop glow behind orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(34,211,238,0.09),rgba(139,92,246,0.05)_34%,rgba(4,6,13,0)_68%)]"
      />

      {/* Top Navigation / Operational Header */}
      <header className="relative z-30 flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-800/70 bg-[#050812]/95">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-baseline gap-2.5 shrink-0">
            <h1 className="font-display text-lg font-semibold tracking-tight text-white">
              ROSE
            </h1>
            <span className="hidden md:inline text-xs text-slate-400">
              Responsive Operational Support Entity
            </span>
          </div>

          {profiles.length > 0 && currentUser && (
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
              <label htmlFor="workspace-profile-select" className="sr-only">
                Active Factory Memory OS operator profile
              </label>
              <select
                id="workspace-profile-select"
                value={currentUser.userId}
                onChange={(e) => {
                  void authenticateUser(e.target.value);
                }}
                className="bg-[#0B1222] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:border-cyan-500/60 focus:outline-none max-w-[270px] truncate cursor-pointer"
              >
                {profiles.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name} ({p.title}) — {p.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300 pr-2">
            <Radio
              className={`w-3.5 h-3.5 ${
                liveStatus === 'connected'
                  ? 'text-cyan-400'
                  : errorBanner
                    ? 'text-amber-400'
                    : 'text-slate-400'
              }`}
              aria-hidden="true"
            />
            <span>{connectionLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-expanded={drawerOpen}
            aria-label="Toggle transcript and factory insights panel"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1426] hover:bg-[#15203A] border border-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            <PanelRight className="w-3.5 h-3.5 text-cyan-300" />
            <span>
              Context
              {messages.length > 0 ? ` (${messages.length})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open ROSE settings"
            className="p-2 rounded-lg bg-[#0D1426] hover:bg-[#15203A] border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Unobstructed Center Viewport */}
      <main
        className={`relative z-10 flex-1 flex flex-col items-center justify-between min-h-0 px-4 py-2 transition-[padding] duration-200 ${
          drawerOpen ? 'lg:pr-[426px]' : ''
        }`}
      >
        {/* Mobile profile selector when narrow */}
        {profiles.length > 0 && currentUser && (
          <div className="sm:hidden w-full max-w-md pt-1">
            <label htmlFor="mobile-profile-select" className="sr-only">
              Active Factory Memory OS operator profile
            </label>
            <select
              id="mobile-profile-select"
              value={currentUser.userId}
              onChange={(e) => {
                void authenticateUser(e.target.value);
              }}
              className="w-full bg-[#0B1222] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
            >
              {profiles.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name} ({p.title}) — {p.companyName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Central 3D Holographic Orb */}
        <div className="relative flex-1 w-full max-w-[540px] max-h-[430px] min-h-[250px] flex items-center justify-center my-auto">
          <RoseOrb
            orbState={orbState}
            audioLevel={activeAudioLevel}
            orbQuality={settings.orbQuality}
            animationIntensity={settings.animationIntensity}
          />
        </div>

        {/* Status Readout, Visualizer & Contextual Message */}
        <div className="w-full max-w-2xl flex flex-col items-center text-center gap-2 pb-2">
          <RoseVisualizer
            orbState={orbState}
            inputLevel={inputLevel}
            outputLevel={outputLevel}
          />

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs font-mono text-slate-400 max-w-full px-2">
            <span
              className={
                orbState === 'ERROR'
                  ? 'text-amber-300 font-semibold'
                  : orbState === 'DISCONNECTED'
                    ? 'text-slate-400'
                    : orbState === 'SPEAKING'
                      ? 'text-cyan-300 font-semibold'
                      : orbState === 'LISTENING'
                        ? 'text-rose-300 font-semibold'
                        : orbState === 'THINKING'
                          ? 'text-violet-300 font-semibold'
                          : 'text-cyan-200'
              }
            >
              {orbState}
            </span>
            {currentUser && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[190px] sm:max-w-none">
                  {currentUser.companyName}
                </span>
                {overview && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">
                      {overview.productionAchievementPct}% Target
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <p
            data-testid="rose-contextual-message"
            className={`text-sm leading-relaxed max-w-xl px-3 ${
              errorBanner ? 'text-amber-200' : 'text-slate-200'
            }`}
          >
            {contextualSubtitle}
          </p>
        </div>

        {/* Unified Bottom Voice & Text Control Dock */}
        <RoseVoiceControls
          orbState={orbState}
          isVoiceActive={isVoiceActive}
          isConnecting={liveStatus === 'connecting' || liveStatus === 'reconnecting'}
          isMuted={isMuted}
          isSendingText={isSendingText}
          onToggleVoiceSession={handleToggleVoiceSession}
          onToggleMute={handleToggleMute}
          onInterrupt={handleInterrupt}
          onSendText={(txt) => {
            void handleSendText(txt);
          }}
        />
      </main>

      {/* Slide-Over Context, Insights & Memory Panel */}
      <RoseConversation
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={currentUser}
        overview={overview}
        insights={insights}
        proactiveEnabled={settings.proactiveNotifications}
        messages={messages}
        memory={memory}
        saveMemoryEnabled={settings.saveConversationMemory}
        onQuickPrompt={(prompt) => {
          void handleSendText(prompt);
        }}
        onClearMemory={() => {
          void handleClearMemory();
        }}
      />

      {/* Settings Dialog */}
      <RoseSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        onTestVoice={() => {
          void handleTestVoice();
        }}
        isTestingVoice={isTestingVoice}
        onClearHistory={() => {
          void handleClearMemory();
        }}
      />
    </div>
  );
}
